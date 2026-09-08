# LegendMural storefront — Cloudflare Preview B2 Status

**Date:** 2026-09-08  
**Repository:** `ALKAVisuals/legend-stories-website`  
**Workstream:** Netlify → Cloudflare  
**Phase:** B2 — real Cloudflare preview + isolated Neon + PayPal Sandbox  
**Status:** browser runtime config is proven; the first real Sandbox checkout now reaches `/api/paypal/checkout` but fails at the backend. The exact next step is to inspect that failed response before changing configuration.

## 1. Canonical current checkpoints

```text
storefront main: 2a526f027bcdeb27a974ca280d05279bbc110cec
Cloudflare Worker: legendmural-cloudflare-preview
workers.dev: https://legendmural-cloudflare-preview.lively-bonus-08da.workers.dev
active Worker version: cddf4f08
```

For the Cloudflare migration, this storefront repository is now the primary technical source of truth. Older dashboard handoff documents may remain historical, but new Cloudflare continuation work should read this file first and then fresh-check the current storefront `main`.

## 2. B1 real Cloudflare preview proof — complete

Proven on the actual `workers.dev` Worker:

- storefront renders;
- images render;
- browser JavaScript works;
- cart/shipping flow works;
- private R2 binding `V3_INVOICE_PDFS` points to `legendmural-v3-invoice-pdfs-preview`;
- R2 public access is disabled;
- unknown `/api/*` fails closed with `API_ROUTE_NOT_FOUND`;
- no custom domain, DNS, or Production cutover was performed.

## 3. Isolated Neon B2 branch — complete

Preview branch:

```text
project: Legendmural
branch: cloudflare-preview-b2-20260908
branch id: br-little-feather-aspahbm7
database: neondb
parent: production
```

At creation, the schema diff versus the parent was empty.

Approved preview runtime role:

```text
legendmural_cloudflare_preview_runtime
```

Verified least-privilege posture:

```text
superuser: false
create role: false
create database: false
inherit: false
replication: false
bypass RLS: false
role memberships: none
```

Allowed B2 commerce access is limited to the existing order/payment notification tables needed for preview commerce. Negative checks proved no read access to withdrawal requests or dashboard order-status tables.

The temporary over-privileged Neon role created earlier during setup was rejected, never connected to Cloudflare, and deleted after owner approval.

No password or database connection string is stored in GitHub.

## 4. Worker → isolated Neon proof — green

`NEON_DATABASE_URL` is configured in Cloudflare as a Secret for the isolated preview branch and least-privilege role.

A real non-mutating request to:

```text
POST /api/order-status
```

returned:

```text
HTTP 404
error.code: ORDER_NOT_FOUND
message: No matching order was found.
```

That proves the actual Cloudflare Worker reached the isolated Neon order store successfully.

## 5. PayPal Sandbox reuse — configured

The existing PayPal Sandbox app is reused:

```text
LegendMural Sandbox
```

No new PayPal app was created.

Configured in Cloudflare as Secrets:

```text
PAYPAL_CLIENT_ID
PAYPAL_CLIENT_SECRET
PAYPAL_WEBHOOK_ID
```

The secret values are not stored in GitHub or chat.

A dedicated Cloudflare Sandbox webhook exists at:

```text
https://legendmural-cloudflare-preview.lively-bonus-08da.workers.dev/api/paypal/webhook
```

It tracks exactly:

```text
Checkout order approved
Payment capture completed
Payment capture declined
Payment capture pending
```

The old Netlify Sandbox webhook was retained unchanged for rollback/reference.

## 6. Preview runtime locks

Current controlled preview state:

```text
LEGENDMURAL_DEPLOY_CONTEXT=preview
LEGENDMURAL_CHECKOUT_PAUSED=false
PAYPAL_ALLOW_LIVE=false
ORDER_EMAILS_ENABLED=false
V3_PROFILE1_ORDER_CREATION_ENABLED=false
V3_INVOICE_RECONCILIATION_ENABLED=false
V3_INVOICE_STORAGE_ENABLED=false
V3_DASHBOARD_INVOICE_API_ENABLED=false
```

The checkout unpause was explicitly owner-approved only for the Cloudflare preview Sandbox proof.

PayPal Live remains blocked. Emails remain disabled. All V3 activation flags remain disabled.

## 7. Browser commerce runtime build gap — fixed in PR #212

The first preview checkout attempt remained browser-side fail-closed because Cloudflare Builds ran `npm run build` but did not execute the existing deploy-time commerce runtime-config generator.

Storefront PR #212 fixed that permanently by:

- adding the Cloudflare runtime-config generator wrapper;
- running it through Wrangler `build.command` before deploy;
- adding a regression test.

PR #212 merged to storefront `main` at:

```text
2a526f027bcdeb27a974ca280d05279bbc110cec
```

Cloudflare then successfully deployed active Worker version:

```text
cddf4f08
```

The public browser module is now runtime-proven to contain exactly:

```text
hostedCheckoutEndpoint: /api/paypal/checkout
orderStatusEndpoint: /api/order-status
paypalCaptureEndpoint: /api/paypal/capture
```

The earlier message:

```text
Secure online payment is not enabled on this deployment yet.
```

is no longer the active failure.

## 8. Current blocker — checkout backend response not yet diagnosed

After the browser runtime fix, checkout advances further and the frontend now shows:

```text
Secure payment could not be started. Your cart is still saved. Please try again.
```

This means the browser is now attempting the real:

```text
POST /api/paypal/checkout
```

but the backend response is failing.

Do not retry checkout repeatedly and do not change secrets, PayPal settings, Neon settings, runtime flags, DNS, or Production configuration before reading the exact failed response.

## 9. Exact next step — one action only

Open Chrome DevTools on the Cloudflare preview and inspect the failed request:

```text
Network
→ POST /api/paypal/checkout
→ Response
```

Capture only:

1. HTTP status;
2. response body / `error.code`.

Then diagnose that exact backend failure before making any change.

## 10. Still forbidden

Do not:

- use Production Neon credentials or write Production data;
- use PayPal Live credentials;
- set `PAYPAL_ALLOW_LIVE=true`;
- enable Resend/order emails;
- activate V3 Profile 1, reconciliation, invoice storage, or dashboard invoice API;
- create/write Production R2 invoice storage;
- attach `legendmural.com` to Cloudflare;
- change LegendMural DNS;
- remove or alter Netlify Production;
- modify or publish the LegendMural dashboard as part of this storefront migration step;
- modify Technisch Bouwadvies.

Production cutover remains a separate later approval.

## 11. New-chat continuation rule

A new Cloudflare-migration chat should start with this storefront repository and read:

```text
docs/CLOUDFLARE_MIGRATION_NOTICE_20260907.md
docs/CLOUDFLARE_TARGET_ARCHITECTURE_AND_MIGRATION_PLAN_20260907.md
docs/CLOUDFLARE_ENVIRONMENT_AND_SECRET_MAP.md
docs/CLOUDFLARE_CUTOVER_AND_ROLLBACK_CHECKLIST.md
docs/CLOUDFLARE_PREVIEW_ACCOUNT_PROOF_20260908.md
docs/CLOUDFLARE_PREVIEW_B2_STATUS_20260908.md
```

Then fresh-check storefront `main`, open storefront PRs, and the actual Cloudflare preview before continuing.

For current execution status, this B2 file overrides older migration-status wording that still points to pre-B2 or dashboard-centric handoffs.
