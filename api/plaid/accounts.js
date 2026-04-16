import { getPlaidClient, plaidConfigured } from "./_lib/client";
import { applyCors, notConfigured, serverError } from "./_lib/cors";
import { decrypt } from "./_lib/crypto";
import { kv } from "./_lib/kv";

const CACHE_KEY = "plaid:accounts:cache";
const CACHE_TTL = 60;

export default async function handler(req, res) {
  applyCors(res);
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });
  if (!plaidConfigured()) return notConfigured(res);
  try {
    const bust = req.query?.refresh === "1";
    if (!bust) {
      const cached = await kv.get(CACHE_KEY);
      if (cached) return res.status(200).json(cached);
    }

    const client = getPlaidClient();
    const keys = await kv.keys("plaid:item:*");
    const accounts = [];
    for (const key of keys) {
      const rec = await kv.get(key);
      if (!rec) continue;
      try {
        const token = decrypt(rec.token_encrypted);
        const resp = await client.accountsBalanceGet({ access_token: token });
        for (const a of resp.data.accounts || []) {
          accounts.push({
            account_id: a.account_id,
            item_id: rec.item_id,
            institution_name: rec.institution_name || "",
            name: a.name,
            official_name: a.official_name,
            mask: a.mask,
            type: a.type,
            subtype: a.subtype,
            balance_current: a.balances?.current ?? null,
            balance_available: a.balances?.available ?? null,
            currency: a.balances?.iso_currency_code || "USD",
          });
        }
      } catch (e) {
        console.error("accounts fetch failed for", rec.item_id, e?.message);
        accounts.push({
          item_id: rec.item_id,
          institution_name: rec.institution_name || "",
          error: e?.response?.data?.error_code || "fetch_failed",
        });
      }
    }

    const payload = { accounts, fetched_at: Date.now() };
    await kv.set(CACHE_KEY, payload, { ex: CACHE_TTL });
    return res.status(200).json(payload);
  } catch (e) {
    return serverError(res, e);
  }
}
