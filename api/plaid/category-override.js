import { kv, kvConfigured } from "./_lib/kv";
import { applyCors, serverError } from "./_lib/cors";

export default async function handler(req, res) {
  applyCors(res);
  if (req.method === "OPTIONS") return res.status(200).end();
  if (!kvConfigured()) return res.status(503).json({ error: "KV not configured yet" });

  try {
    if (req.method === "POST") {
      const { transaction_id, category } = req.body || {};
      if (!transaction_id) return res.status(400).json({ error: "transaction_id required" });
      const key = `plaid:cat_override:${transaction_id}`;
      if (category) await kv.set(key, category);
      else await kv.del(key);
      return res.status(200).json({ status: "ok" });
    }
    return res.status(405).json({ error: "Method not allowed" });
  } catch (e) {
    return serverError(res, e);
  }
}
