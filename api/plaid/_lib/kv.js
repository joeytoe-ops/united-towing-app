import { kv } from "@vercel/kv";

export function kvConfigured() {
  return !!(process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN);
}

export { kv };
