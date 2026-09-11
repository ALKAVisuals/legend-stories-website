# LegendMural Cloudflare PayPal Live activation plan

**Date:** 2026-09-11  
**Repository:** `ALKAVisuals/legend-stories-website`  
**Starting `main`:** `194209185bb9ee2fc7ab07f5872737b6a980afc0`  
**Scope:** plan the first PayPal Live activation on the Cloudflare Production Worker after the completed hosting/DNS migration.  

> This document is a plan only. It authorizes no Production mutation. PayPal Live, Production secrets, Production Neon writes and customer checkout remain unchanged until the owner gives explicit approval for the exact stage below.

## 1. Current verified baseline

Cloudflare hosting/DNS is complete and Phase 4 is green. The Production Worker is still deliberately fail-closed:

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

Current Production target:

```text
Worker: legendmural-cloudflare-production
Known/current cutover Worker version: 5d05b26d-4179-4ab0-a7b3-35cb990de854
Public origin: https://legendmural.com
Webhook endpoint: https://legendmural.com/api/paypal/webhook
```

Do not combine PayPal activation with Resend/order email, V3 invoice storage, R2 writes, dashboard activation, Netlify decommission or Technisch Bouwadvies.

## 2. Read-only audit findings

The Cloudflare commerce runtime requires these Production inputs for a real PayPal order flow:

### Secrets

```text
NEON_DATABASE_URL
PAYPAL_CLIENT_ID
PAYPAL_CLIENT_SECRET
PAYPAL_WEBHOOK_ID
```

`NEON_DATABASE_URL` is required because create-order persists the authoritative pending order before returning the PayPal approval URL, and capture/webhook reconciliation use the same durable order store.

### Non-secret Production configuration

```text
CHECKOUT_SUCCESS_URL=https://legendmural.com/order-success.html
CHECKOUT_CANCEL_URL=https://legendmural.com/order-cancelled.html
CHECKOUT_ALLOWED_ORIGINS=https://legendmural.com
PAYPAL_API_BASE=https://api-m.paypal.com
PAYPAL_ALLOW_LIVE=<controlled stage value>
LEGENDMURAL_CHECKOUT_PAUSED=<controlled stage value>
```

The checkout handler also accepts the same request origin automatically, but the explicit Production values remain the canonical configuration and must be preserved.

## 3. Existing authoritative source values

A read-only Netlify environment inventory on 2026-09-11 confirms that the old LegendMural Netlify Production context already contains prepared Production values for:

- `NEON_DATABASE_URL` — secret, present;
- `PAYPAL_CLIENT_ID` — secret, present;
- `PAYPAL_CLIENT_SECRET` — secret, present;
- `PAYPAL_WEBHOOK_ID` — secret, present;
- `PAYPAL_API_BASE=https://api-m.paypal.com`;
- `CHECKOUT_SUCCESS_URL=https://legendmural.com/order-success.html`;
- `CHECKOUT_CANCEL_URL=https://legendmural.com/order-cancelled.html`;
- `CHECKOUT_ALLOWED_ORIGINS=https://legendmural.com`.

The secret values remain masked and must never be copied into GitHub, chat, screenshots, logs or PR text.

The old Netlify Production context currently reports `PAYPAL_ALLOW_LIVE=true`. **Do not copy that flag blindly to Cloudflare.** Cloudflare remains the active runtime and must keep its own staged activation sequence below.

Repository production-readiness evidence also records that the dedicated PayPal Live app is `LegendMural Production`, its Live webhook listener is already registered at `https://legendmural.com/api/paypal/webhook`, and the Production Neon schema/runtime role were prepared previously. These provider-side facts must be fresh-checked before activation rather than assumed indefinitely.

## 4. Why checkout must stay paused during configuration

`cloudflare/worker.mjs` returns `503 CHECKOUT_PAUSED` before loading the active checkout runtime whenever:

```text
LEGENDMURAL_CHECKOUT_PAUSED=true
```

This is the containment boundary for new orders. Capture, webhook and order-status routes remain available independently, so a pending order can still finish/reconcile after checkout is re-paused.

This allows Production dependencies to be configured and verified before any new customer checkout can start.

## 5. Stage P1 — configure Production dependencies, checkout still paused

**Requires separate explicit owner approval before execution.**

Allowed mutations for P1 only:

1. Add these values to the Cloudflare Production Worker without exposing their contents:
   - secret `NEON_DATABASE_URL`;
   - secret `PAYPAL_CLIENT_ID`;
   - secret `PAYPAL_CLIENT_SECRET`;
   - secret `PAYPAL_WEBHOOK_ID`;
   - `CHECKOUT_SUCCESS_URL=https://legendmural.com/order-success.html`;
   - `CHECKOUT_CANCEL_URL=https://legendmural.com/order-cancelled.html`;
   - `CHECKOUT_ALLOWED_ORIGINS=https://legendmural.com`;
   - `PAYPAL_API_BASE=https://api-m.paypal.com`.
2. Keep `LEGENDMURAL_CHECKOUT_PAUSED=true`.
3. Keep `PAYPAL_ALLOW_LIVE=false` during the initial secret/config transfer.
4. Keep `ORDER_EMAILS_ENABLED=false` and every V3 activation flag false.
5. Do not write Production Neon data merely to test secret presence.
6. Do not alter DNS, Custom Domains, GoDaddy or Netlify.
7. Fresh-check that the PayPal Live app/webhook still target the exact final endpoint before any Live activation flag changes.

P1 success criterion: required names/config are present in the Cloudflare Production Worker, values are not leaked, checkout still returns `503 CHECKOUT_PAUSED`, and no payment/order/database mutation has occurred.

## 6. Stage P2 — enable Live client while checkout remains paused

**Requires a separate explicit owner approval after P1 evidence is green.**

Allowed P2 mutation:

```text
PAYPAL_ALLOW_LIVE=true
```

while keeping:

```text
LEGENDMURAL_CHECKOUT_PAUSED=true
```

This deliberately makes the Live PayPal client configuration usable by non-checkout reconciliation routes while still refusing all new checkout creation.

Read-only/no-charge verification after P2 should confirm:

- `GET /api/paypal/checkout` still returns `503 CHECKOUT_PAUSED`;
- PayPal capture/webhook/order-status routes no longer fail because their Production service dependencies are missing;
- no secrets appear in responses/logs;
- `ORDER_EMAILS_ENABLED=false` and all V3 activation flags remain false.

Do not interpret P2 as customer checkout approval.

## 7. Stage P3 — one controlled real self-payment

**Requires another separate explicit owner approval.**

The kill switch blocks only new checkout creation. Therefore the safest controlled Live proof is:

1. confirm P1/P2 are green;
2. prepare one intended low-value LegendMural test cart/order;
3. set `LEGENDMURAL_CHECKOUT_PAUSED=false` only for the controlled create-order window;
4. initiate exactly one intended checkout and verify a single Live PayPal order + durable Neon `payment_pending` record is created;
5. immediately restore `LEGENDMURAL_CHECKOUT_PAUSED=true` **before continuing buyer approval when operationally possible**;
6. complete that already-created PayPal order;
7. allow capture/webhook/order-status reconciliation to finish while new checkout remains paused;
8. verify amount, currency, internal reference, PayPal order/capture identity, Neon durable `paid` state, webhook signature acceptance and idempotency;
9. leave checkout paused after the proof.

Any mismatch is an immediate NO-GO: keep/reapply checkout pause and investigate before retrying. Do not perform repeated checkout attempts after a partial create/persistence failure without first checking whether PayPal already created the order.

## 8. P3 acceptance evidence

Record without secret/customer/payment identifiers:

- timestamp/timezone;
- exact storefront `main` SHA;
- exact Worker version/deployment used;
- confirmation that customer checkout was re-paused;
- test product/amount at a non-sensitive summary level;
- create-order success;
- durable Neon pending state;
- PayPal buyer approval;
- capture success and exact amount/currency match;
- durable Neon paid state;
- webhook verification/reconciliation result;
- duplicate/idempotency outcome;
- relevant sanitized Cloudflare/PayPal/Neon monitoring observations.

Do not store full PayPal order IDs, capture IDs, customer data, connection strings or credentials in the public repository.

## 9. Customer checkout remains a later gate

Even after one controlled P3 payment is green, leave:

```text
LEGENDMURAL_CHECKOUT_PAUSED=true
```

until the owner separately authorizes opening customer checkout.

That later decision must also respect the ordinary launch-readiness/legal/customer-operations gates. A successful technical payment proof is not by itself permission to launch commerce publicly.

## 10. Resend/V3/Netlify boundaries

This PayPal phase does not authorize:

- `ORDER_EMAILS_ENABLED=true`;
- Resend Production secret migration to Cloudflare;
- V3 Profile 1 order creation;
- V3 invoice reconciliation;
- V3 invoice storage/R2 writes;
- dashboard invoice API activation;
- Netlify decommission;
- changes to Technisch Bouwadvies or the LegendMural dashboard.

## 11. Exact next action

The next permitted action before any Production mutation is to review this plan and obtain explicit owner authorization for **Stage P1 only**:

> Configure the prepared Production Neon + PayPal secrets and canonical checkout/Live API configuration in the Cloudflare Production Worker while keeping both `LEGENDMURAL_CHECKOUT_PAUSED=true` and `PAYPAL_ALLOW_LIVE=false`, with no order, payment, email, V3, R2, DNS or Netlify mutation.

After P1 is proven, P2 and P3 each require their own explicit approval.