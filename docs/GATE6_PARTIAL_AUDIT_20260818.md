# Gate 6 partial production configuration audit — 18 August 2026

## Purpose

Record the read-only Gate 6 findings that can be proven before LegendMural has a new Netlify production deploy available. This document does not activate production commerce, change Netlify secrets, enable Resend, or enable PayPal Live.

## Reviewed baseline

- Repository: `ALKAVisuals/legend-stories-website`
- Reviewed `main`: `239a0d473b53e7b419f1ea0055d0a2c6b28ac39a`
- Production origin in tracked config: `https://legendmural.com`
- Neon production branch: `production`
- Gate 5 production bootstrap: complete

## Existing Deploy Preview database configuration

The existing Netlify `NEON_DATABASE_URL` value under **Deploy Previews** must be treated as staging-only and must not be copied into Production.

This follows the historical staging contract and actual validation record in `docs/PAYPAL_STAGING.md`:

- real PayPal Sandbox tests ran against Netlify Deploy Preview #85/#86;
- those tests used the isolated Neon `order-store-integration` branch;
- staging explicitly required an isolated Neon staging/test environment;
- production Neon credentials were explicitly forbidden in that Deploy Preview staging context.

The owner-confirmed current Netlify environment view shows `NEON_DATABASE_URL` populated for Deploy Previews and empty for Production. Therefore the existing secret is not evidence of a production database credential and must remain isolated from production.

## Code/configuration items already verified

### Commerce routes

Tracked `netlify.toml` maps the intended public routes to the intended Netlify Functions:

- `/api/paypal/checkout` -> `create-paypal-order`
- `/api/paypal/capture` -> `capture-paypal-order`
- `/api/paypal/webhook` -> `paypal-webhook`
- `/api/order-status` -> `order-status`

The build config continues to generate the browser commerce runtime routes and uses Node.js 22.

### PayPal fail-closed boundary

Tracked configuration does not hardcode `LEGENDMURAL_CHECKOUT_PAUSED=true`.

The create-order Function treats the checkout as paused only when `LEGENDMURAL_CHECKOUT_PAUSED` is explicitly equal to `true`. Capture, webhook reconciliation, and order-status remain separate paths so incident containment of new checkout does not destroy in-flight reconciliation capability.

PayPal API code defaults to Sandbox. The Live API origin is rejected unless `PAYPAL_ALLOW_LIVE=true` is explicitly present. No PayPal Live activation is authorized by this audit.

### Database runtime contract

The Netlify commerce runtime requires `NEON_DATABASE_URL` and fails closed when it is missing. The Neon adapter requires a Neon Postgres URL with username, password, database name, and TLS.

Production must eventually use the least-privilege `legendmural_app` login path and must never use `neondb_owner` as the application credential.

### Production build

The exact PR #99 head was green for Quality checks, Accessibility / purchase-flow, Neon integration harness, unit tests, Vite production build/output validation, and Netlify Deploy Preview. PR #99 was merged to `main` as `239a0d473b53e7b419f1ea0055d0a2c6b28ac39a`; its changes were documentation-only relative to the exact validated commerce code.

## Gate 6 items that remain external / intentionally open

Gate 6 is still **NO-GO** for production runtime activation. The remaining work is deliberately deferred until a production deploy can actually be made:

1. establish a production-only least-privilege Neon credential for `legendmural_app` without exposing it in GitHub, logs, or chat;
2. store the production runtime URL only in the Netlify Production context as `NEON_DATABASE_URL`;
3. verify the Production-context PayPal variables and keep `PAYPAL_ALLOW_LIVE` disabled during infrastructure validation;
4. verify `CHECKOUT_ALLOWED_ORIGINS`, fallback success URL, and fallback cancel URL against the final deployed `https://legendmural.com` origin;
5. deploy the reviewed current build when Netlify production deploy capacity is available;
6. run same-origin API smoke checks without a real charge;
7. inspect Function logs for secret/PII leakage;
8. configure statutory withdrawal email only after Gate 3 is ready.

## Explicit non-actions

This audit does not:

- copy the existing Deploy Preview Neon secret into Production;
- reset or expose a Neon password;
- change a Netlify environment variable;
- change PayPal credentials;
- set `PAYPAL_ALLOW_LIVE=true`;
- configure Resend production sending;
- perform a new production deploy;
- delete any Neon branch or recovery checkpoint.
