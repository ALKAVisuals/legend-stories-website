# LegendMural Cloudflare PayPal Live — Stage P3 controlled payment plan

**Date:** 2026-09-14  
**Repository:** `ALKAVisuals/legend-stories-website`  
**Starting `main`:** `c2e21598aa71096217962804695d3ed26f5cd524`  
**Scope:** define the exact controlled P3 path after completed P1/P2, without yet authorizing a real payment.

> This document is a plan only. It does not authorize opening checkout, creating a real order, charging money, refunding money or changing Production runtime state. Stage P3 still requires a new explicit owner approval immediately before execution.

## 1. Verified starting state

Stage P1 and Stage P2 are complete and recorded in GitHub.

Required guarded Production state before P3 preparation/execution:

```text
PAYPAL_ALLOW_LIVE=true
LEGENDMURAL_CHECKOUT_PAUSED=true
ORDER_EMAILS_ENABLED=false
V3_PROFILE1_ORDER_CREATION_ENABLED=false
V3_INVOICE_RECONCILIATION_ENABLED=false
V3_INVOICE_STORAGE_ENABLED=false
V3_DASHBOARD_INVOICE_API_ENABLED=false
```

Customer checkout remains closed.

## 2. Test amount and isolation decision

The target P3 buyer charge is **EUR 0.01** if the complete current PayPal/LegendMural path accepts that amount.

The existing production catalog uses normal customer prices and the checkout server derives the authoritative quote from server-side product data. P3 must therefore **not** lower the price of an existing customer product and must not trust a client-supplied price.

The preferred implementation is a **temporary server-side P3-only test SKU/product** with an authoritative EUR 0.01 price. It must be isolated from ordinary customer discovery.

Before deployment, tests/review must prove that the temporary test item:

- is not listed on the homepage, shop or collection pages;
- has no ordinary public product page;
- is not added to sitemap, structured product data, feeds or normal storefront navigation;
- cannot change the prices of existing products;
- is accepted only by the controlled checkout path needed for P3;
- produces an authoritative server-side quote of exactly EUR 0.01;
- can be removed cleanly after the test.

If the current architecture cannot guarantee that isolation, stop before Production deployment and choose a safer test mechanism.

EUR 0.01 is a target, not an assumption. If the Live provider or current checkout path rejects EUR 0.01 during safe preflight/execution, do not retry repeatedly. Re-pause/keep checkout paused, inspect the exact failure, then choose the next-lowest supported test amount under a separately reviewed change.

## 3. P3 preparation phase — still no payment

Preparation is allowed only after a task-specific implementation PR is reviewed and CI is green.

Preparation sequence:

1. implement the temporary isolated P3-only test item/mechanism;
2. add regression tests proving its EUR 0.01 quote and non-discoverability;
3. keep all real customer products/prices unchanged;
4. deploy the prepared code while `LEGENDMURAL_CHECKOUT_PAUSED=true`;
5. verify `GET /api/paypal/checkout` still returns `CHECKOUT_PAUSED`;
6. verify order emails and all V3 activation flags remain off;
7. record the exact Production Worker version/deployment and storefront `main` SHA;
8. stop and obtain explicit owner authorization for the real P3 payment window.

No PayPal order, buyer approval, capture or deliberate Production Neon order write should occur in the preparation phase.

## 4. Controlled real-payment window

After explicit owner approval for Stage P3:

1. confirm the guarded state again immediately before opening checkout;
2. prepare exactly one controlled EUR 0.01 test checkout using the temporary P3-only item;
3. set `LEGENDMURAL_CHECKOUT_PAUSED=false` only for the create-order window;
4. initiate exactly one intended checkout;
5. verify a single Live PayPal order and one durable Neon `payment_pending` order are created with the expected internal reference and EUR 0.01 amount;
6. immediately restore `LEGENDMURAL_CHECKOUT_PAUSED=true` **before buyer approval when operationally possible**;
7. verify new checkout creation is blocked again;
8. continue only the already-created PayPal buyer approval;
9. complete capture;
10. allow webhook/order-status reconciliation to finish while checkout remains paused;
11. verify exact amount/currency match, durable Neon `paid` state, webhook signature acceptance and idempotent reconciliation.

Do not initiate a second checkout after a partial failure until PayPal and Neon have first been checked for an already-created order.

## 5. Buyer account and payment method

Use a controlled buyer identity/payment method that is separate from the LegendMural merchant receiving account where practical.

Do not store buyer credentials, PayPal account details, card details, full provider transaction IDs or customer PII in GitHub documentation.

## 6. Refund handling

After the P3 payment proof is complete and evidence is captured, the intended cleanup is a **full refund of the buyer-paid gross amount**.

Because a refund is itself a money-moving Production mutation, execute it only after an explicit confirmation at that step.

Record only sanitized refund evidence. Provider processing fees may remain a LegendMural test cost even if the buyer receives the full gross amount back; do not encode an assumed fee amount in the repository proof.

The refund must not be used as a substitute for verifying the original capture and paid-state chain first.

## 7. Mandatory cleanup after P3

After the payment/refund proof:

1. keep `LEGENDMURAL_CHECKOUT_PAUSED=true`;
2. remove the temporary P3-only test item/mechanism from production code/config;
3. deploy the cleanup through the normal reviewed GitHub/CI path;
4. verify the EUR 0.01 test item can no longer be quoted or discovered;
5. verify all ordinary customer prices remain unchanged;
6. verify checkout remains paused;
7. keep `ORDER_EMAILS_ENABLED=false` and all V3 activation flags false;
8. do not delete the legitimate PayPal/Neon order/payment/refund records merely to hide the test — retain them as audit history;
9. write a sanitized P3 proof document and update the current handoff/status.

## 8. Immediate NO-GO conditions

Reapply/keep checkout paused and stop if any of the following occurs:

- amount or currency differs from the intended test amount;
- more than one PayPal order is created;
- more than one durable LegendMural order is created;
- no matching Neon pending record appears after create-order;
- buyer approval/capture references do not reconcile to the same internal order;
- webhook verification fails unexpectedly;
- final durable state does not become `paid` after successful capture;
- duplicate reconciliation is not idempotent;
- checkout cannot be re-paused immediately;
- the temporary test item becomes publicly discoverable;
- any secret/customer/payment identifier leaks into logs, chat or repository documentation.

Do not repeatedly retry after a NO-GO until the existing provider/database state has been inspected.

## 9. P3 acceptance evidence

Record, without secrets or full customer/payment identifiers:

- timestamp/timezone;
- exact storefront `main` SHA;
- exact Worker version/deployment;
- target test amount and currency;
- confirmation that exactly one checkout/order was intentionally created;
- durable Neon pending-state confirmation;
- checkout re-pause confirmation;
- buyer approval success;
- capture success and exact amount/currency match;
- durable Neon paid-state confirmation;
- webhook verification/reconciliation result;
- duplicate/idempotency result;
- sanitized refund result if refund is executed;
- confirmation that the temporary P3 test mechanism was subsequently removed;
- confirmation that customer checkout remains paused after cleanup.

## 10. Boundaries that remain unchanged

P3 does not authorize:

- general customer checkout;
- Production order-email sending;
- V3 Profile 1 order creation;
- V3 invoice reconciliation;
- V3 invoice storage/R2 writes;
- dashboard invoice API activation;
- Netlify decommission;
- changes to Technisch Bouwadvies;
- unrelated LegendMural dashboard changes.

A successful P3 payment proof is not permission to launch customer commerce.

## 11. Exact next action

After this plan is merged, the next engineering step is **P3 preparation only**: inspect the current checkout/catalog/build path and implement the smallest temporary server-side EUR 0.01 test mechanism that cannot be exposed to ordinary customers, with tests proving quote integrity and non-discoverability.

Do not unpause checkout or create a real PayPal order during that preparation step. The real-payment window remains separately gated by explicit owner approval.
