import { getPlaidClient, plaidConfigured } from "./_lib/client";
import { applyCors, notConfigured, serverError } from "./_lib/cors";
import { encrypt } from "./_lib/crypto";
import { kv } from "./_lib/kv";

export default async function handler(req, res) {
  applyCors(res);
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  if (!plaidConfigured()) return notConfigured(res);
  try {
    const client = getPlaidClient();
    const { public_token } = req.body || {};
    if (!public_token) return res.status(400).json({ error: "public_token required" });

    const exch = await client.itemPublicTokenExchange({ public_token });
    const access_token = exch.data.access_token;
    const item_id = exch.data.item_id;

    /* Pull account metadata + institution so we can label things without decrypting the token on every read */
    const acctResp = await client.accountsGet({ access_token });
    const itemResp = await client.itemGet({ access_token });
    let institutionName = "";
    try {
      const instId = itemResp.data.item?.institution_id;
      if (instId) {
        const inst = await client.institutionsGetById({ institution_id: instId, country_codes: ["US"] });
        institutionName = inst.data.institution?.name || "";
      }
    } catch {}

    const accounts = (acctResp.data.accounts || []).map(a => ({
      account_id: a.account_id,
      name: a.name,
      official_name: a.official_name,
      mask: a.mask,
      type: a.type,
      subtype: a.subtype,
    }));

    const record = {
      item_id,
      token_encrypted: encrypt(access_token),
      institution_name: institutionName,
      accounts,
      connected_at: Date.now(),
    };
    await kv.set(`plaid:item:${item_id}`, record);
    await kv.del("plaid:accounts:cache");

    return res.status(200).json({ status: "ok", item_id, institution_name: institutionName, accounts });
  } catch (e) {
    return serverError(res, e);
  }
}
