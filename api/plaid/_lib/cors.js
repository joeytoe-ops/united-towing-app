export function applyCors(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

export function notConfigured(res) {
  return res.status(503).json({ error: "Plaid not configured yet" });
}

export function serverError(res, e) {
  console.error("plaid endpoint error:", e?.response?.data || e?.message || e);
  return res.status(500).json({ error: e?.response?.data?.error_message || e?.message || "Internal error" });
}
