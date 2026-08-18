# LegendMural production environment context matrix

Last reviewed: 18 August 2026.

Purpose: make the Netlify Production environment review deterministic before the first current production deployment. This file contains no credentials and does not authorize PayPal Live or Resend production activation.

## Rules

1. Treat **Production** and **Deploy Previews** as separate environments.
2. Never copy the historical Deploy Preview `NEON_DATABASE_URL` into Production; that preview value belongs to the isolated staging model.
3. Never use `neondb_owner` or `legendmural_runtime` as the application login. Production runtime uses `legendmural_app`.
4. Secret values are verified by **presence, deploy context and intended app/role identity**, not by pasting/revealing them in chat or documentation.
5. A changed Netlify environment value is not considered runtime-proven until a fresh deployment consumes it.
6. During Gate 6 infrastructure validation PayPal stays Sandbox-only.
7. Resend stays inactive until the separate Gate 3 activation is explicitly approved.

## Production matrix

| Variable | Production expectation before first current deploy | Secret? | Current readiness |
| --- | --- | --- | --- |
| `NEON_DATABASE_URL` | Full pooled production URL for `legendmural_app` → production branch → `neondb`, with required TLS parameters | **Yes** | **Stored in Production by owner; runtime proof waits for deploy** |
| `CHECKOUT_ALLOWED_ORIGINS` | Must include `https://legendmural.com` exactly; no obsolete GitHub Pages origin should be authoritative | No | **Verify in Netlify Production** |
| `CHECKOUT_SUCCESS_URL` | `https://legendmural.com/order-success.html` | No | **Verify in Netlify Production** |
| `CHECKOUT_CANCEL_URL` | `https://legendmural.com/order-cancelled.html` | No | **Verify in Netlify Production** |
| `PAYPAL_API_BASE` | `https://api-m.sandbox.paypal.com` during Gate 6 | No | **Verify in Netlify Production** |
| `PAYPAL_ALLOW_LIVE` | absent or exactly `false` during Gate 6 | No | **Verify before deploy** |
| `PAYPAL_CLIENT_ID` | Client ID for the intended **Sandbox** REST app | **Yes** | **Verify presence/context/app identity; do not expose value** |
| `PAYPAL_CLIENT_SECRET` | Secret for the same intended **Sandbox** REST app | **Yes** | **Verify presence/context/app identity; do not expose value** |
| `PAYPAL_WEBHOOK_ID` | Webhook ID belonging to the intended **Sandbox** app/listener used for Gate 6 validation | **Yes / sensitive identifier** | **Verify presence/context/app identity; do not expose value** |
| `LEGENDMURAL_CHECKOUT_PAUSED` | absent or `false` for normal Gate 6 smoke validation; `true` only for deliberate containment testing/incident response | No | **Do not add casually** |
| `RESEND_API_KEY` | absent during Gate 6; add only after Gate 3 approval | **Yes** | **Keep inactive** |
| `RESEND_FROM` | absent during Gate 6; later must use the final verified LegendMural sending domain | No | **Keep inactive** |
| `RESEND_REPLY_TO` | absent during Gate 6; later must be an approved monitored customer-operations mailbox | No | **Keep inactive** |

## Why the PayPal variables must remain Sandbox-only

The tracked PayPal client accepts only the official Sandbox or Live PayPal API origins. If the Live origin is configured while `PAYPAL_ALLOW_LIVE` is not explicitly `true`, the runtime fails closed rather than silently using Live.

This means Gate 6 can safely verify configuration and runtime behavior against Sandbox without granting Live payment authority.

## Function dependency map

### `/api/paypal/checkout`

Needs:

- `NEON_DATABASE_URL`;
- checkout origin/success/cancel configuration;
- PayPal client ID/secret;
- PayPal API base;
- `PAYPAL_ALLOW_LIVE` safety flag.

`LEGENDMURAL_CHECKOUT_PAUSED=true` intentionally short-circuits only this new-checkout path.

### `/api/paypal/capture`

Needs:

- `NEON_DATABASE_URL`;
- PayPal client ID/secret;
- PayPal API base;
- `PAYPAL_ALLOW_LIVE` safety flag.

Do not disable capture merely to stop new orders; an already-approved in-flight order may still require reconciliation.

### `/api/paypal/webhook`

Needs:

- PayPal client ID/secret;
- PayPal API base;
- `PAYPAL_ALLOW_LIVE` safety flag;
- `PAYPAL_WEBHOOK_ID`;
- `NEON_DATABASE_URL` for durable reconciliation.

Webhook ID and PayPal credentials must all belong to the same intended Sandbox/Live app environment.

### `/api/order-status`

Needs:

- `NEON_DATABASE_URL`;
- allowed-origin configuration for browser CORS behavior.

This is the preferred first read-only production connectivity smoke path after a fresh deploy.

### withdrawal Function

Needs for durable registration:

- `NEON_DATABASE_URL`;
- allowed-origin configuration.

Resend delivery is activated only when both `RESEND_API_KEY` and `RESEND_FROM` are configured. Optional `RESEND_REPLY_TO` controls reply routing when Resend is active.

## Safe manual review procedure in Netlify

Before deploy capacity resumes, review one variable at a time:

1. Open the variable.
2. Keep **Different value for each deploy context** when Production and Deploy Preview must remain isolated.
3. For non-secret values, compare the visible Production value against this matrix.
4. For secrets, only confirm:
   - Production has a value;
   - Deploy Preview value is not accidentally being reused as Production unless intentionally designed for that exact environment;
   - the secret belongs to the intended role/app/environment.
5. Save only if a correction is actually needed.
6. Do not trigger PayPal Live or Resend activation as part of this review.

## Required evidence before Gate 6 GO

The release record must be able to state, without recording secret values:

- Production database runtime role: `legendmural_app`;
- Production database branch: `production` / `br-misty-cloud-as0rofc8`;
- database: `neondb`;
- PayPal mode during Gate 6: Sandbox/test;
- definitive origin: `https://legendmural.com`;
- PayPal Live safety flag remained disabled;
- Resend remained inactive;
- fresh production deployment ID/SHA;
- no-charge smoke outcomes;
- Function-log review outcome.

After those checks pass, Gate 6 may move to GO. PayPal Live remains a separate Gate 8 decision.
