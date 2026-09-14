# LegendMural Cloudflare — current status after P3

**Date:** 2026-09-14  
**Repository:** `ALKAVisuals/legend-stories-website`  
**Current synchronized baseline `main`:** `df44f94c762e543f9fb2540f7cd2447cef6094a1`

## Completed

- Cloudflare hosting/DNS migration: complete.
- Post-cutover verification: complete.
- PayPal Stage P1: complete.
- PayPal Stage P2: complete.
- PayPal Stage P3 controlled Live payment proof: **complete**.
- Exactly one controlled Live PayPal order at **EUR 0.01** was proven end to end.
- Durable Neon `payment_pending` state was verified before buyer approval.
- Final durable Neon state became `paid`.
- Exactly one distinct PayPal order and one distinct capture were observed for the controlled proof.
- `CHECKOUT.ORDER.APPROVED` and `PAYMENT.CAPTURE.COMPLETED` webhook reconciliation was observed for the same order chain.
- Provider identity and checked final-order invariants passed.

Canonical P3 proof:

`docs/CLOUDFLARE_PAYPAL_P3_PROOF_20260914.md`

## Current guarded Production state

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

Customer checkout remains deliberately paused and is **not authorized** by the successful P3 proof.

## Production Neon repair performed during P3

The first controlled create-order attempt failed with `CHECKOUT_PERSISTENCE_FAILED` because the current order-store adapter expected `document_profile_version`, while the Production `legend_commerce.orders` table did not yet contain that column.

After temporary-branch validation and explicit owner approval, Production received the minimal repair:

```sql
ALTER TABLE legend_commerce.orders
ADD COLUMN IF NOT EXISTS document_profile_version smallint NOT NULL DEFAULT 0;
```

The schema and runtime insert permission were verified afterward. The controlled retry then persisted successfully as `payment_pending` and later reconciled to `paid`.

Do not infer that the remainder of V3 migration 011 was activated; all V3 runtime flags remain off.

## P3 internal test harness decision

The earlier P3 plan described the EUR 0.01 mechanism as temporary and required removal after proof.

After the successful proof, the owner explicitly chose to **retain the mechanism as a disabled internal regression/test harness** for future controlled tests, including possible dashboard integration testing.

Safety contract:

- keep `P3_TEST_CHECKOUT_ENABLED=false` by default;
- keep the P3 token encrypted server-side and never expose it in GitHub, chat, logs or client code;
- the internal test product must remain absent from the public catalog/navigation/sitemap/ordinary product pages;
- discovering the internal slug alone must not enable a test checkout;
- any future real-money use requires a separately authorized controlled test window.

This owner decision supersedes the earlier mandatory-removal instruction in the P3 plan for the current project state.

## Refund status

The EUR 0.01 payment has **not been recorded as refunded** in the current proof.

A refund remains a separate money-moving Production action and requires explicit owner approval immediately before execution.

## Still not authorized

- general customer checkout;
- Production order-email sending;
- V3 Profile 1 order creation;
- V3 invoice reconciliation;
- V3 invoice storage / Production R2 writes;
- dashboard invoice API activation;
- Netlify decommission;
- unrelated dashboard changes;
- changes to Technisch Bouwadvies.

## Exact next gate

P3 is complete. The next step is **not** another payment test.

Before public customer checkout can be opened, the project must separately resolve the remaining customer-commerce launch gates, including the existing legal/launch-readiness blockers. Dashboard/V3 testing may use the retained P3 harness later, but only through a separately scoped and authorized test window.

## Startup order for the next chat

1. `docs/READ_ME_FIRST.md`
2. `docs/CLOUDFLARE_CURRENT_STATUS_20260914.md`
3. `docs/CLOUDFLARE_PAYPAL_P3_PROOF_20260914.md`
4. `docs/CLOUDFLARE_PAYPAL_P3_CONTROLLED_PAYMENT_PLAN_20260914.md`
5. `docs/CLOUDFLARE_PAYPAL_P2_PROOF_20260914.md`
6. `docs/CLOUDFLARE_PAYPAL_P1_PROOF_20260914.md`
7. `docs/CLOUDFLARE_MIGRATION_HANDOFF_20260911.md`
8. `docs/CLOUDFLARE_PAYPAL_LIVE_ACTIVATION_PLAN_20260911.md`
9. fresh-check current `main`, open PRs and Production runtime state before any mutation
