# LegendMural storefront — Cloudflare Preview B2 Status

**Date:** 2026-09-08  
**Repository:** `ALKAVisuals/legend-stories-website`  
**Workstream:** Netlify → Cloudflare  
**Phase:** B2 — real Cloudflare preview + isolated Neon + PayPal Sandbox  
**Status:** the browser runtime config is proven and the checkout request reaches the Worker. The current live preview response is now proven to be fail-closed with `HTTP 503 / CHECKOUT_PAUSED`. The exact next Cloudflare action is to verify the active preview deployment and restore only the owner-approved preview checkout flag to `false` before one new Sandbox checkout attempt.

## 1. Canonical current checkpoints

```text
storefront main: 19466976948bd3fcd82e729c0f7cd755e208130d
Cloudflare Worker: legendmural-cloudflare-preview
workers.dev: https://legendmural-cloudflare-preview.lively-bonus-08da.workers.dev
last recorded active Worker version: cddf4f08
```

The exact current Worker deployment/version must be rechecked in Cloudflare before changing any runtime variable because storefront `main` has advanced since `cddf4f08` was recorded.

For the Cloudflare migration, this storefront repository is the primary technical source of truth. Older dashboard handoff documents may remain historical, but new Cloudflare continuation work should read this file first and then fresh-check current storefront `main`.

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

Secret values are not stored in GitHub or chat.

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

## 6. Preview runtime locks — current observed state

The repository-safe preview defaults remain:

```text
LEGENDMURAL_DEPLOY_CONTEXT=preview
LEGENDMURAL_CHECKOUT_PAUSED=true
PAYPAL_ALLOW_LIVE=false
ORDER_EMAILS_ENABLED=false
V3_PROFILE1_ORDER_CREATION_ENABLED=false
V3_INVOICE_RECONCILIATION_ENABLED=false
V3_INVOICE_STORAGE_ENABLED=false
V3_DASHBOARD_INVOICE_API_ENABLED=false
```

Earlier in B2, the owner explicitly approved a **preview-only Sandbox checkout unpause** and Cloudflare runtime was manually set to:

```text
LEGENDMURAL_CHECKOUT_PAUSED=false
```

A later live browser proof on 2026-09-08 now shows the preview is paused again. The exact deployment/version that reapplied the fail-closed state is not yet verified because Cloudflare dashboard access is deferred until the owner is on the already-authenticated computer.

Do not change the repository-safe default to `false` merely to make preview checkout persistent. Production and repository defaults must remain fail-closed.

PayPal Live remains blocked. Emails remain disabled. All V3 activation flags remain disabled.

## 7. Browser commerce runtime build gap — fixed in PR #212

Storefront PR #212 permanently fixed the Cloudflare browser runtime-config generation gap by:

- adding the Cloudflare runtime-config generator wrapper;
- running it through Wrangler `build.command` before deploy;
- adding a regression test.

PR #212 merged at:

```text
2a526f027bcdeb27a974ca280d05279bbc110cec
```

The public browser module was runtime-proven to contain exactly:

```text
hostedCheckoutEndpoint: /api/paypal/checkout
orderStatusEndpoint: /api/order-status
paypalCaptureEndpoint: /api/paypal/capture
```

The former browser-side message:

```text
Secure online payment is not enabled on this deployment yet.
```

is no longer the relevant failure.

## 8. Current runtime proof — exact checkout failure diagnosed

A fresh checkout attempt on the public Cloudflare preview was captured in Chrome DevTools Network.

Request:

```text
POST /api/paypal/checkout
```

Observed response:

```text
HTTP 503
error.code: CHECKOUT_PAUSED
```

The UI correspondingly showed:

```text
Secure payment could not be started. Your cart is still saved. Please try again.
```

This proves:

- browser → `/api/paypal/checkout` wiring is active;
- the Worker receives the checkout request;
- this specific failure occurs at the checkout pause guard before PayPal/Neon create-order behavior can be evaluated;
- there is currently no evidence from this request of a PayPal authentication failure, Neon failure, or Worker crash.

The checked-in `wrangler.jsonc` also confirms the preview-safe default is `LEGENDMURAL_CHECKOUT_PAUSED=true`.

## 9. Exact next step — one Cloudflare action, then one test

When Cloudflare dashboard access is available:

1. open `legendmural-cloudflare-preview` and identify the exact active deployment/version;
2. verify these safety locks are still unchanged:
   - `PAYPAL_ALLOW_LIVE=false`
   - `ORDER_EMAILS_ENABLED=false`
   - all V3 activation flags remain `false`;
3. change **only** the preview runtime variable:

```text
LEGENDMURAL_CHECKOUT_PAUSED=false
```

4. do not alter Production or `wrangler.jsonc` safe defaults;
5. after the variable change is active, perform exactly one new Sandbox checkout attempt;
6. inspect the next `/api/paypal/checkout` response before making any further change.

Expected next success boundary: the Worker should proceed beyond `CHECKOUT_PAUSED` and attempt PayPal Sandbox order creation. Stop and diagnose if a new error code appears.

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

For current execution status, this B2 file overrides older migration-status wording that still points to pre-B2, dashboard-centric, or pre-`CHECKOUT_PAUSED` diagnosis checkpoints.
