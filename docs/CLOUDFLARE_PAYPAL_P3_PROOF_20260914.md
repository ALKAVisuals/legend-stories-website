# LegendMural Cloudflare PayPal Live — Stage P3 proof

**Date:** 2026-09-14  
**Repository:** `ALKAVisuals/legend-stories-website`  
**Storefront `main` used for P3:** `df44f94c762e543f9fb2540f7cd2447cef6094a1`

This document records the sanitized result of the controlled EUR 0.01 Live PayPal proof. It contains no secrets, customer PII or full provider identifiers.

## Result

Stage P3 is **technically successful** for its defined controlled-payment proof.

Verified with exactly one intended Live PayPal order:

- authoritative server-side amount: **EUR 0.01**;
- durable Neon state reached `payment_pending` before buyer approval;
- checkout was re-paused before continuing the already-created PayPal approval flow;
- buyer approval completed;
- final Production Neon state became `paid`;
- exactly one distinct PayPal order and one distinct capture were observed;
- provider order identity matched the stored LegendMural payment session;
- webhook reconciliation recorded `CHECKOUT.ORDER.APPROVED` and `PAYMENT.CAPTURE.COMPLETED` for the same order chain;
- checked paid-order invariants and provider-identity checks passed;
- no manual second capture was needed.

Customer checkout is still **not authorized**.

## Post-proof guarded state

```text
PAYPAL_ALLOW_LIVE=true
LEGENDMURAL_CHECKOUT_PAUSED=true
P3_TEST_CHECKOUT_ENABLED=false
ORDER_EMAILS_ENABLED=false
V3_PROFILE1_ORDER_CREATION_ENABLED=false
V3_INVOICE_RECONCILIATION_ENABLED=false
V3_INVOICE_STORAGE_ENABLED=false
V3_DASHBOARD_INVOICE_API_ENABLED=false
```

`P3_TEST_CHECKOUT_TOKEN` remains an encrypted server-side secret and must never be copied into GitHub, chat, logs or client-side code.

## Internal P3 harness retained by owner decision

The P3-only mechanism remains isolated from the public storefront. The fixed EUR 0.01 test item is server-side only and is not part of the public catalog, ordinary product pages, sitemap or storefront navigation. Activation requires both `P3_TEST_CHECKOUT_ENABLED=true` and the exact private P3 token, and the request must match the strict controlled shape.

After the successful proof the owner explicitly chose to **retain this mechanism as a disabled internal regression/test harness** for future controlled end-to-end tests, including possible dashboard integration checks. This supersedes the earlier cleanup-plan requirement to remove the mechanism immediately after P3.

Permanent rule: keep `P3_TEST_CHECKOUT_ENABLED=false` except during a separately authorized controlled test window.

## Initial persistence failure and repair

The first controlled create-order attempt returned `CHECKOUT_PERSISTENCE_FAILED`. Because the PayPal order is created before the durable pending order is persisted, the request was not retried blindly.

Production Neon inspection showed that `legend_commerce.orders` lacked the `document_profile_version` column expected by the current order-store adapter. A minimal schema repair was prepared on a temporary Neon branch, tested, and then applied to Production after explicit owner approval:

```sql
ALTER TABLE legend_commerce.orders
ADD COLUMN IF NOT EXISTS document_profile_version smallint NOT NULL DEFAULT 0;
```

The Production schema and runtime insert permission were then re-checked.

The same controlled request was retried once. The PayPal create path uses a deterministic reference-derived idempotency key, preserving the intended provider idempotency contract. The retry succeeded and the durable order was stored as `payment_pending`.

## Pending-state proof

Before buyer approval the order-status path returned:

```text
mode     : live
status   : payment_pending
paid     : false
terminal : false
version  : 0
```

Production Neon also showed one Live PayPal EUR 0.01 pending order and zero paid EUR 0.01 orders at that point.

## Paid-state proof

After buyer approval, Production Neon showed the controlled payment as `paid`, `EUR`, Live PayPal, amount 1 cent. Sanitized reconciliation checks confirmed one distinct controlled order, one PayPal order, one capture, matching provider identity, present paid timestamp, unique webhook events and valid final order invariants.

Observed webhook event types:

```text
CHECKOUT.ORDER.APPROVED
PAYMENT.CAPTURE.COMPLETED
```

## Return-page note

This P3 order was created from local PowerShell rather than the normal storefront checkout flow. The browser therefore did not contain the normal `sessionStorage` values used by the return page to match the PayPal token to the browser-created checkout. The return page showed verification unavailable, while Production Neon independently confirmed the durable `paid` result.

## Refund status

No refund is recorded here. A refund is a separate money-moving Production action and still requires explicit owner approval immediately before execution.

## Remaining boundaries

P3 success does not authorize general customer checkout, Production order emails, any V3 activation flag, Production R2 invoice writes, dashboard invoice API activation, Netlify decommission, unrelated dashboard changes or Technisch Bouwadvies changes.

The public customer-commerce gate remains separate and must still respect the remaining legal and launch-readiness blockers.
