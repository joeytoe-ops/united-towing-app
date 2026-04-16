import crypto from "crypto";
import { jwtVerify, importJWK, decodeProtectedHeader } from "jose";
import { getPlaidClient, plaidConfigured } from "./_lib/client";
import { applyCors, serverError } from "./_lib/cors";
import { kv } from "./_lib/kv";

export const config = { api: { bodyParser: false } };

async function readRawBody(req) {
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", c => { data += c; });
    req.on("end", () => resolve(data));
    req.on("error", reject);
  });
}

async function verifyPlaidWebhook(rawBody, verificationHeader) {
  const { kid } = decodeProtectedHeader(verificationHeader);
  if (!kid) throw new Error("missing kid");
  const client = getPlaidClient();
  const keyResp = await client.webhookVerificationKeyGet({ key_id: kid });
  const jwk = keyResp.data.key;
  const publicKey = await importJWK(jwk, "ES256");
  const { payload } = await jwtVerify(verificationHeader, publicKey, { algorithms: ["ES256"] });
  const ageSec = Math.floor(Date.now() / 1000) - (payload.iat || 0);
  if (ageSec > 5 * 60) throw new Error("webhook too old");
  const expected = crypto.createHash("sha256").update(rawBody).digest("hex");
  if (expected !== payload.request_body_sha256) throw new Error("body hash mismatch");
}

export default async function handler(req, res) {
  applyCors(res);
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  if (!plaidConfigured()) return res.status(200).json({ skipped: "plaid not configured" });

  let raw = "";
  try { raw = await readRawBody(req); } catch (e) { return res.status(400).json({ error: "cannot read body" }); }

  const verification = req.headers["plaid-verification"];
  if (verification) {
    try {
      await verifyPlaidWebhook(raw, verification);
    } catch (e) {
      console.error("webhook signature invalid:", e?.message);
      return res.status(401).json({ error: "invalid signature" });
    }
  } else {
    console.warn("webhook received without Plaid-Verification header");
  }

  let payload;
  try { payload = JSON.parse(raw); } catch { return res.status(400).json({ error: "invalid json" }); }

  try {
    const { webhook_type, webhook_code, item_id, error } = payload;
    if (webhook_type === "TRANSACTIONS") {
      await kv.del("plaid:accounts:cache");
    }
    if (webhook_type === "ITEM" && webhook_code === "ERROR") {
      await kv.set("plaid:error_flag", { item_id, error, at: Date.now() });
    }
    return res.status(200).json({ ok: true });
  } catch (e) {
    return serverError(res, e);
  }
}
