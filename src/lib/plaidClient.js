async function req(path, opts = {}) {
  const r = await fetch(path, opts);
  const data = await r.json().catch(() => ({}));
  return { ok: r.ok, status: r.status, data };
}

export async function createLinkToken() {
  return req("/api/plaid/create-link-token", { method: "POST" });
}

export async function exchangePublicToken(public_token) {
  return req("/api/plaid/exchange-token", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ public_token }),
  });
}

export async function getAccounts({ refresh = false } = {}) {
  return req(`/api/plaid/accounts${refresh ? "?refresh=1" : ""}`);
}

export async function getTransactions(days = 90) {
  return req(`/api/plaid/transactions?days=${days}`);
}

export async function disconnectItem(item_id) {
  return req("/api/plaid/disconnect", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ item_id }),
  });
}

export async function setCategoryOverride(transaction_id, category) {
  return req("/api/plaid/category-override", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ transaction_id, category }),
  });
}

/* "not configured" means 503 from the server (missing Plaid env vars). */
export function isNotConfigured(resp) {
  return resp?.status === 503 && (resp?.data?.error || "").toLowerCase().includes("not configured");
}
