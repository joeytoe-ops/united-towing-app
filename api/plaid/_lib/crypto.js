import crypto from "crypto";

const ALGO = "aes-256-gcm";

function getKey() {
  const hex = process.env.TOKEN_ENCRYPTION_KEY;
  if (!hex) throw new Error("TOKEN_ENCRYPTION_KEY not set");
  const buf = Buffer.from(hex, "hex");
  if (buf.length !== 32) throw new Error("TOKEN_ENCRYPTION_KEY must be 32 bytes (64 hex chars)");
  return buf;
}

export function encrypt(plaintext) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGO, getKey(), iv);
  const ct = Buffer.concat([cipher.update(String(plaintext), "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [iv.toString("base64"), tag.toString("base64"), ct.toString("base64")].join(":");
}

export function decrypt(encoded) {
  const [ivB64, tagB64, ctB64] = String(encoded).split(":");
  const iv = Buffer.from(ivB64, "base64");
  const tag = Buffer.from(tagB64, "base64");
  const ct = Buffer.from(ctB64, "base64");
  const decipher = crypto.createDecipheriv(ALGO, getKey(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ct), decipher.final()]).toString("utf8");
}
