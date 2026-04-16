import { Configuration, PlaidApi, PlaidEnvironments } from "plaid";

export function plaidConfigured() {
  return !!(process.env.PLAID_CLIENT_ID && process.env.PLAID_SECRET);
}

export function getPlaidClient() {
  if (!plaidConfigured()) return null;
  const env = process.env.PLAID_ENV || "sandbox";
  const basePath = PlaidEnvironments[env] || PlaidEnvironments.sandbox;
  const config = new Configuration({
    basePath,
    baseOptions: {
      headers: {
        "PLAID-CLIENT-ID": process.env.PLAID_CLIENT_ID,
        "PLAID-SECRET": process.env.PLAID_SECRET,
      },
    },
  });
  return new PlaidApi(config);
}

export function plaidProducts() {
  const raw = process.env.PLAID_PRODUCTS || "transactions";
  return raw.split(",").map(s => s.trim()).filter(Boolean);
}

export function plaidCountryCodes() {
  const raw = process.env.PLAID_COUNTRY_CODES || "US";
  return raw.split(",").map(s => s.trim()).filter(Boolean);
}
