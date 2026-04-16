import { getPlaidClient, plaidConfigured } from "./_lib/client";
import { applyCors, notConfigured, serverError } from "./_lib/cors";
import { decrypt } from "./_lib/crypto";
import { kv } from "./_lib/kv";

export default async function handler(req, res) {
  applyCors(res);
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  if (!plaidConfigured()) return notConfigured(res);
  try {
    const { item_id } = req.body || {};
    if (!item_id) return res.status(400).json({ error: "item_id required" });
    const key = `plaid:item:${item_id}`;
    const rec = await kv.get(key);
    if (!rec) return res.status(404).json({ error: "item not found" });

    try {
      const client = getPlaidClient();
      const token = decrypt(rec.token_encrypted);
      await client.itemRemove({ access_token: token });
    } catch (e) {
      console.error("itemRemove failed:", e?.message);
    }
    await kv.del(key);
    await kv.del(`plaid:cursor:${item_id}`);
    await kv.del(`plaid:txns:${item_id}`);
    await kv.del("plaid:accounts:cache");
    return res.status(200).json({ status: "ok" });
  } catch (e) {
    return serverError(res, e);
  }
}
