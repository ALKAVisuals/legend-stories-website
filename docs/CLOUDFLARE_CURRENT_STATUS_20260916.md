# LegendMural Cloudflare — current status after Production order-email activation

**Date:** 2026-09-16  
**Repository:** `ALKAVisuals/legend-stories-website`  
**Deployed Production source commit:** `553fa04ca56c856721040f0748d3dea5a2f193e3`  
**Guarded deploy run:** `https://github.com/ALKAVisuals/legend-stories-website/actions/runs/35065848714`  
**Cloudflare Worker version after deploy:** `ca90ece9-71b9-4c35-8759-b99c6d080cfc`

## Completed

- Cloudflare hosting/DNS migration: complete.
- Post-cutover verification: complete.
- PayPal Stage P1: complete.
- PayPal Stage P2: complete.
- PayPal Stage P3 controlled Live payment proof: complete.
- Production order-email runtime activation: complete.
- PR #263 enabled `ORDER_EMAILS_ENABLED=true` in the intended Production repository config.
- PR #264 corrected the guarded Production deploy verifier so preflight requires order emails off and postdeploy requires them on.
- Guarded Production deployment run `35065848714` completed successfully from exact commit `553fa04ca56c856721040f0748d3dea5a2f193e3`.

## Proven Production runtime state

The guarded deploy performed and passed:

1. exact owner confirmation + exact `main` commit pin;
2. required Cloudflare credential-name presence check without printing secret values;
3. repository contract tests;
4. storefront Production build;
5. remote Production preflight;
6. Wrangler dry-run;
7. one real Cloudflare Production Worker deploy;
8. remote postdeploy verification;
9. live proof that public checkout remains paused.

Preflight proved the previously deployed runtime still had:

```text
ORDER_EMAILS_ENABLED=false
P3_TEST_CHECKOUT_ENABLED=false
```

Postdeploy verification proved the new Production runtime has:

```text
PAYPAL_ALLOW_LIVE=true
LEGENDMURAL_CHECKOUT_PAUSED=true
P3_TEST_CHECKOUT_ENABLED=false
ORDER_EMAILS_ENABLED=true
V3_PROFILE1_ORDER_CREATION_ENABLED=false
V3_INVOICE_RECONCILIATION_ENABLED=false
V3_INVOICE_STORAGE_ENABLED=false
V3_DASHBOARD_INVOICE_API_ENABLED=false
```

The same verification also proved:

- Worker: `legendmural-cloudflare-production`;
- Custom Domains: `legendmural.com` and `www.legendmural.com`;
- PayPal Live endpoint contract present;
- required secret names present without exposing secret values;
- Production R2 binding: `V3_INVOICE_PDFS -> legendmural-v3-invoice-pdfs-prod`;
- no public R2 exposure detected;
- public checkout still returns the fail-closed `CHECKOUT_PAUSED` state.

## Important interpretation

Production is now configured to send order emails when the already-existing paid-order path reaches the email-delivery step.

This deploy **does not prove a newly sent real Production order email**, because public checkout remains deliberately paused and no additional real-money order was created during this activation. Do not claim end-to-end email delivery from a new customer order until a separately authorized proof exists.

The email activation also does **not** authorize customer commerce by itself.

## Customer checkout remains paused

Customer checkout is still deliberately fail-closed:

```text
LEGENDMURAL_CHECKOUT_PAUSED=true
```

The guarded deploy's final live check required HTTP `503` with error code `CHECKOUT_PAUSED` and passed.

Do not open public checkout without a separate launch decision and explicit Production approval.

## Retained internal P3 harness

The controlled EUR 0.01 P3 mechanism remains retained as a disabled internal regression/test harness.

Safety contract remains:

- `P3_TEST_CHECKOUT_ENABLED=false` by default;
- the P3 token stays encrypted server-side and never enters GitHub/chat/client code;
- the internal test item stays absent from public catalog/navigation/sitemap/ordinary product pages;
- discovering the internal slug does not authorize a controlled checkout;
- any future real-money use requires a separately authorized controlled test window.

## V3 remains disabled

No V3 runtime activation occurred in this deployment:

```text
V3_PROFILE1_ORDER_CREATION_ENABLED=false
V3_INVOICE_RECONCILIATION_ENABLED=false
V3_INVOICE_STORAGE_ENABLED=false
V3_DASHBOARD_INVOICE_API_ENABLED=false
```

Do not infer V3 invoice generation, reconciliation, R2 invoice writes or dashboard invoice API activation from the successful email deploy.

## Production boundaries preserved

The guarded deployment did not authorize or intentionally perform:

- opening general customer checkout;
- enabling the P3 test checkout;
- enabling any V3 runtime flag;
- DNS/custom-domain mutation commands;
- R2 object writes;
- Netlify Production changes;
- unrelated LegendMural dashboard changes;
- changes to Technisch Bouwadvies.

## Remaining launch gates

Before general customer checkout can be opened, the project must still resolve the remaining customer-commerce launch gates recorded in the public-website handoff, including:

- **Blocker C:** Dutch 100%-upfront consumer-payment legal gate remains open/parked pending written specialist verification;
- **Blocker D part 2B:** remains intentionally deferred pending required production/material facts;
- **Blocker E:** remains partially evidenced/deferred; do not repeatedly reopen the recognizable-person/title commercial-use question unless the owner does so.

Do not manufacture technical work to bypass these launch gates.

## Exact next step

The Production order-email activation gate is complete.

The next work should return to the remaining customer-launch gates before public checkout is opened. Do not run another payment test, email activation deploy, V3 activation or unrelated Production mutation merely because an older status document says it is pending.

## Startup order for the next chat

1. `docs/READ_ME_FIRST.md`
2. `docs/CLOUDFLARE_CURRENT_STATUS_20260916.md`
3. `docs/CLOUDFLARE_PAYPAL_P3_PROOF_20260914.md`
4. `docs/CLOUDFLARE_PAYPAL_P3_CONTROLLED_PAYMENT_PLAN_20260914.md`
5. `docs/CLOUDFLARE_PAYPAL_P2_PROOF_20260914.md`
6. `docs/CLOUDFLARE_PAYPAL_P1_PROOF_20260914.md`
7. `docs/CLOUDFLARE_MIGRATION_HANDOFF_20260911.md`
8. `docs/CLOUDFLARE_PAYPAL_LIVE_ACTIVATION_PLAN_20260911.md`
9. fresh-check current `main`, open PRs and Production runtime state before any mutation
