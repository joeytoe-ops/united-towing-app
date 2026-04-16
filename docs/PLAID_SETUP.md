# Plaid Setup Checklist

All code is already merged. These steps are what it takes to go from "Finances tab shows a placeholder" → "Finances tab shows real bank data."

## 1. Sign up for Plaid

1. Go to https://dashboard.plaid.com and create an account.
2. Complete company verification (KYC for United Towing & Transport LLC). This is required before you can hit real bank accounts, but sandbox works without it.

## 2. Get sandbox credentials

1. In the Plaid dashboard: **Team Settings → Keys**
2. Copy:
   - `client_id`
   - `Sandbox` secret
3. Leave `Development` and `Production` blank until later.

## 3. Enable Vercel KV

Vercel KV (Upstash Redis) stores the encrypted Plaid access tokens + transaction cache + cash expenses.

1. In Vercel dashboard → your project → **Storage** tab → **Create Database** → **KV**.
2. Name it `united-towing-kv` (or whatever), create.
3. Vercel auto-injects `KV_REST_API_URL` and `KV_REST_API_TOKEN` into your project's environment. Confirm under **Settings → Environment Variables**.

## 4. Generate an encryption key

On your laptop:

```
openssl rand -hex 32
```

Copy the 64-character hex string.

## 5. Add environment variables in Vercel

In **Settings → Environment Variables**, add (scope: Production + Preview + Development):

| Name | Value |
|---|---|
| `PLAID_CLIENT_ID` | from step 2 |
| `PLAID_SECRET` | sandbox secret from step 2 |
| `PLAID_ENV` | `sandbox` |
| `PLAID_PRODUCTS` | `transactions,auth,identity` |
| `PLAID_COUNTRY_CODES` | `US` |
| `PLAID_REDIRECT_URI` | `https://app.unitedtowtruck.com/plaid-callback` |
| `TOKEN_ENCRYPTION_KEY` | hex string from step 4 |

`KV_REST_API_URL` and `KV_REST_API_TOKEN` should already be there from step 3.

**Do not commit any of these values to git.** `.env` and `.env.local` are already gitignored.

## 6. Register the redirect URI with Plaid

In the Plaid dashboard: **Team Settings → API → Allowed redirect URIs** → add:

```
https://app.unitedtowtruck.com/plaid-callback
```

This is required for OAuth institutions like Chase.

## 7. Redeploy

Push a dummy commit, or in Vercel dashboard click **Redeploy**. The new env vars need a fresh build to take effect.

## 8. Test with Plaid sandbox

Open https://app.unitedtowtruck.com, log in with `united149`, go to **Finances**. Click **Connect bank account**. In the Plaid popup:

- Select any bank
- Username: `user_good`
- Password: `pass_good`
- MFA code (if prompted): `1234`

After connect, Finances should show mock balances and transactions. Disconnect and reconnect as needed.

## 9. Set up the Plaid webhook (optional but recommended)

In the Plaid dashboard: **Team Settings → Webhooks** → add URL:

```
https://app.unitedtowtruck.com/api/plaid/webhook
```

Plaid will ping this when new transactions arrive so the in-app cache refreshes.

## 10. Moving to real bank data (production)

Sandbox uses fake institutions. To connect the real Chase accounts:

1. In Plaid dashboard: **Team Settings → Account** → request **Production access**.
2. Complete additional verification if prompted. Typical approval: 3–7 business days.
3. Once approved, copy the **Production secret** from Team Settings → Keys.
4. In Vercel env vars, update:
   - `PLAID_SECRET` = production secret
   - `PLAID_ENV` = `production`
5. Redeploy.
6. On the Finances tab, click **Disconnect** on any sandbox item, then reconnect — this time Plaid Link will show real banks.

## Troubleshooting

- **"Bank connection not yet configured"** on Finances tab → `PLAID_CLIENT_ID` env var is missing or empty. Check Vercel env vars.
- **"Enable Vercel KV to track cash expenses"** → KV database not provisioned. See step 3.
- **Plaid Link popup closes immediately** → Check browser console. Usually means the redirect URI isn't registered (step 6) or doesn't match the env var.
- **OAuth loop / never completes** → `PLAID_REDIRECT_URI` env var and the URI registered in Plaid must match exactly, scheme and all.
- **Transactions empty after connecting** → Transactions endpoint runs `/transactions/sync`; it may return zero on first call for new sandbox items. Re-open the tab after a few seconds.

## Rotating the encryption key

If the `TOKEN_ENCRYPTION_KEY` is ever exposed:

1. Disconnect all connected banks from the Finances tab (this deletes the encrypted tokens).
2. Generate a new key with `openssl rand -hex 32`.
3. Update `TOKEN_ENCRYPTION_KEY` in Vercel env.
4. Redeploy.
5. Reconnect banks.

Because tokens are encrypted with the current key, rotating without disconnect-first will leave the existing tokens unreadable.

## What the code does

- `/api/plaid/create-link-token` — issues a short-lived token the browser uses to open Plaid Link.
- `/api/plaid/exchange-token` — trades the public token from Link for a permanent access token, encrypts it, stores it in KV.
- `/api/plaid/accounts` — reads all encrypted tokens, calls Plaid for real-time balances, caches 60s.
- `/api/plaid/transactions` — incremental sync via `/transactions/sync`, stores cursor + list in KV per item.
- `/api/plaid/disconnect` — revokes the token on Plaid's side and deletes KV entries.
- `/api/plaid/webhook` — receives Plaid push updates, verifies signature, clears cache on transaction updates.
- `/api/plaid/category-override` — stores per-transaction category overrides.
- `/api/cash-expenses` — CRUD for manually-entered cash expenses (stored in KV, not Plaid).

All Plaid access tokens are encrypted with AES-256-GCM before storage. The encryption key lives only in Vercel env vars — not in code, not in git.
