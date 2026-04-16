async function req(path, opts = {}) {
  const r = await fetch(path, opts);
  const data = await r.json().catch(() => ({}));
  return { ok: r.ok, status: r.status, data };
}

export async function listCashExpenses() {
  return req("/api/cash-expenses");
}

export async function addCashExpense({ amount, category, date, note }) {
  return req("/api/cash-expenses", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ amount, category, date, note }),
  });
}

export async function deleteCashExpense(id) {
  return req(`/api/cash-expenses?id=${encodeURIComponent(id)}`, { method: "DELETE" });
}
