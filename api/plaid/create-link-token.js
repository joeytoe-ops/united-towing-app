import { getPlaidClient, plaidConfigured, plaidProducts, plaidCountryCodes } from "./_lib/client";
import { applyCors, notConfigured, serverError } from "./_lib/cors";

export default async function handler(req, res) {
  applyCors(res);
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  if (!plaidConfigured()) return notConfigured(res);
  try {
    const client = getPlaidClient();
    const redirect = process.env.PLAID_REDIRECT_URI || undefined;
    const resp = await client.linkTokenCreate({
      user: { client_user_id: "joey" },
      client_name: "United Towing",
      products: plaidProducts(),
      country_codes: plaidCountryCodes(),
      language: "en",
      ...(redirect ? { redirect_uri: redirect } : {}),
    });
    return res.status(200).json({ link_token: resp.data.link_token, expiration: resp.data.expiration });
  } catch (e) {
    return serverError(res, e);
  }
}
