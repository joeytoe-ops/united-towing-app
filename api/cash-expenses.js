import { kv, kvConfigured } from "./plaid/_lib/kv";
import { applyCors, serverError } from "./plaid/_lib/cors";

const KEY = "cash_expenses";

function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }

export default async function handler(req, res) {
  applyCors(res);
  if (req.method === "OPTIONS") return res.status(200).end();
  if (!kvConfigured()) return res.status(503).json({ error: "KV not configured yet" });

  try {
    if (req.method === "GET") {
      const list = (await kv.get(KEY)) || [];
      return res.status(200).json({ expenses: list });
    }

    if (req.method === "POST") {
      const { amount, category, date, note } = req.body || {};
      const n = parseFloat(amount);
      if (!n || isNaN(n)) return res.status(400).json({ error: "amount required" });
      const item = {
        id: uid(),
        amount: n,
        category: category || "Uncategorized",
        date: date || new Date().toISOString().split("T")[0],
        note: note || "",
        created_at: Date.now(),
      };
      const list = (await kv.get(KEY)) || [];
      list.push(item);
      await kv.set(KEY, list);
      return res.status(200).json({ status: "ok", item });
    }

    if (req.method === "DELETE") {
      const id = req.query?.id || (req.body && req.body.id);
      if (!id) return res.status(400).json({ error: "id required" });
      const list = (await kv.get(KEY)) || [];
      const next = list.filter(e => e.id !== id);
      await kv.set(KEY, next);
      return res.status(200).json({ status: "ok" });
    }

    return res.status(405).json({ error: "Method not allowed" });
  } catch (e) {
    return serverError(res, e);
  }
}
