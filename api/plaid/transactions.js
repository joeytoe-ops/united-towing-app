import { getPlaidClient, plaidConfigured } from "./_lib/client";
import { applyCors, notConfigured, serverError } from "./_lib/cors";
import { decrypt } from "./_lib/crypto";
import { kv } from "./_lib/kv";

async function syncItem(client, token, itemId) {
  let cursor = (await kv.get(`plaid:cursor:${itemId}`)) || "";
  let stored = (await kv.get(`plaid:txns:${itemId}`)) || [];
  let hasMore = true;
  const added = [], modified = [], removed = [];
  while (hasMore) {
    const resp = await client.transactionsSync({ access_token: token, cursor });
    added.push(...(resp.data.added || []));
    modified.push(...(resp.data.modified || []));
    removed.push(...(resp.data.removed || []));
    cursor = resp.data.next_cursor;
    hasMore = resp.data.has_more;
  }
  if (removed.length) {
    const rmIds = new Set(removed.map(r => r.transaction_id));
    stored = stored.filter(t => !rmIds.has(t.transaction_id));
  }
  if (modified.length) {
    const byId = new Map(modified.map(m => [m.transaction_id, m]));
    stored = stored.map(t => byId.get(t.transaction_id) || t);
    for (const m of modified) {
      if (!stored.find(t => t.transaction_id === m.transaction_id)) stored.push(m);
    }
  }
  if (added.length) stored.push(...added);

  await kv.set(`plaid:txns:${itemId}`, stored);
  await kv.set(`plaid:cursor:${itemId}`, cursor);
  return stored;
}

export default async function handler(req, res) {
  applyCors(res);
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });
  if (!plaidConfigured()) return notConfigured(res);
  try {
    const days = Math.max(1, Math.min(365, parseInt(req.query?.days || "90", 10)));
    const cutoff = new Date(Date.now() - days * 86400000).toISOString().split("T")[0];

    const client = getPlaidClient();
    const itemKeys = await kv.keys("plaid:item:*");
    const allTxns = [];
    for (const key of itemKeys) {
      const rec = await kv.get(key);
      if (!rec) continue;
      try {
        const token = decrypt(rec.token_encrypted);
        const txns = await syncItem(client, token, rec.item_id);
        allTxns.push(...txns);
      } catch (e) {
        console.error("txns sync failed for", rec.item_id, e?.message);
      }
    }

    /* Apply category overrides stored per-transaction */
    const overrideKeys = await kv.keys("plaid:cat_override:*");
    const overrides = {};
    for (const k of overrideKeys) {
      const v = await kv.get(k);
      const id = k.replace("plaid:cat_override:", "");
      if (v) overrides[id] = v;
    }

    const filtered = allTxns
      .filter(t => !t.date || t.date >= cutoff)
      .map(t => ({
        transaction_id: t.transaction_id,
        account_id: t.account_id,
        date: t.date,
        name: t.name,
        merchant_name: t.merchant_name || null,
        amount: t.amount,
        iso_currency_code: t.iso_currency_code,
        pending: t.pending,
        category: t.category || [],
        personal_finance_category: t.personal_finance_category || null,
        override_category: overrides[t.transaction_id] || null,
      }))
      .sort((a, b) => (b.date || "").localeCompare(a.date || ""));

    return res.status(200).json({ transactions: filtered, count: filtered.length });
  } catch (e) {
    return serverError(res, e);
  }
}
