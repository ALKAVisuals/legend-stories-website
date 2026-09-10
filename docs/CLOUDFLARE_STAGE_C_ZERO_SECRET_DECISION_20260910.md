# LegendMural — Cloudflare Stage C zero-secret decision

**Date:** 2026-09-10  
**Repository base:** `cbfc525b47f4b29e71278b5d8784e7d883f9b0f1`  
**Scope:** initial Cloudflare Production hosting cutover only; no commerce/V3 activation.

## Decision

Stage C requires **zero LegendMural application secrets** in the Cloudflare Production Worker.

This is intentional. Stage C changes the storefront hosting/runtime only while every payment, notification and V3 activation switch remains fail-closed. Do not install Sandbox credentials in Production merely to make disabled routes look configured, and do not install Live credentials before the separately approved activation stage that actually needs them.

The Cloudflare account credential used by guarded GitHub Actions workflows is CI/deployment infrastructure and is not a LegendMural application runtime secret covered by this decision.

## Required Stage C Production state

```text
LEGENDMURAL_DEPLOY_CONTEXT=production
LEGENDMURAL_CHECKOUT_PAUSED=true
PAYPAL_ALLOW_LIVE=false
ORDER_EMAILS_ENABLED=false
V3_PROFILE1_ORDER_CREATION_ENABLED=false
V3_INVOICE_RECONCILIATION_ENABLED=false
V3_INVOICE_STORAGE_ENABLED=false
V3_DASHBOARD_INVOICE_API_ENABLED=false
```

Expected application-secret inventory at Stage C:

```text
NEON_DATABASE_URL: absent
PAYPAL_CLIENT_ID: absent
PAYPAL_CLIENT_SECRET: absent
PAYPAL_WEBHOOK_ID: absent
RESEND_API_KEY: absent
LEGENDMURAL_DASHBOARD_INVOICE_TOKEN: absent
```

The existing private R2 binding may remain attached, but `V3_INVOICE_STORAGE_ENABLED=false` means no Production invoice object writes are authorized.

## Fail-closed API contract with zero application secrets

The Stage C smoke test must use non-mutating `GET` requests only. The expected matrix is:

| Route | Expected HTTP | Expected code |
|---|---:|---|
| `/api/paypal/checkout` | 503 | `CHECKOUT_PAUSED` |
| `/api/paypal/capture` | 503 | `PAYPAL_CAPTURE_SERVICE_NOT_CONFIGURED` |
| `/api/paypal/webhook` | 503 | `PAYPAL_WEBHOOK_SERVICE_NOT_CONFIGURED` |
| `/api/order-status` | 503 | `ORDER_STATUS_SERVICE_NOT_CONFIGURED` |
| `/api/invoice-download` | 405 | `METHOD_NOT_ALLOWED` |
| `/api/internal/dashboard-invoice` | 405 | `METHOD_NOT_ALLOWED` |

Each response must remain JSON and `no-store`.

The 503 configuration responses on capture/webhook/status are expected because those runtime adapters require Neon and/or PayPal credentials before their downstream method handlers are reached. This is a safe Stage C condition: the routes are present, but the inactive services cannot start.

## Why no application secrets are needed yet

- Checkout is intentionally intercepted by `LEGENDMURAL_CHECKOUT_PAUSED=true`.
- PayPal Live is forbidden by `PAYPAL_ALLOW_LIVE=false` and has no Stage C activation approval.
- Order email delivery is disabled.
- V3 invoice storage and reconciliation are disabled.
- The dashboard invoice API is disabled.
- Stage C verification can prove route presence and fail-closed behavior through GET-only probes without creating orders, capturing payments, processing webhooks, mutating Neon, sending email or writing R2 objects.

## Future secret activation rule

Secrets are added only when the corresponding future activation stage is separately approved:

- `NEON_DATABASE_URL`: when an active Production order/persistence path that needs Neon is approved.
- `PAYPAL_CLIENT_ID` and `PAYPAL_CLIENT_SECRET`: when the approved Production payment mode requires them.
- `PAYPAL_WEBHOOK_ID`: when the Production PayPal webhook endpoint is separately configured and approved.
- `RESEND_API_KEY`: only with Production email activation.
- `LEGENDMURAL_DASHBOARD_INVOICE_TOKEN`: only with dashboard invoice API activation.

Secret values must only enter Cloudflare secret storage; never GitHub, `wrangler.jsonc`, docs, screenshots or chat.

## Safety boundary

This decision and its regression test authorize **no Production mutation**. They do not authorize:

- DNS/custom-domain changes;
- Production Worker redeployment;
- adding Production secrets;
- PayPal Live activation;
- Resend Production activation;
- Neon Production mutation;
- Production R2 object writes;
- V3 activation;
- Netlify Production changes.

## Next step after repository proof

Once this decision is merged and CI proves the zero-secret fail-closed contract, the next migration step is **Section C read-only DNS inventory** from `docs/CLOUDFLARE_CUTOVER_AND_ROLLBACK_CHECKLIST.md`.

That inventory must record the current LegendMural DNS/Netlify attachment state without modifying any DNS record, domain attachment or hosting provider setting.
