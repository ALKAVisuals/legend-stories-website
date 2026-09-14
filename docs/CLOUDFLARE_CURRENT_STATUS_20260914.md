# LegendMural Cloudflare — current status after P2

**Date:** 2026-09-14  
**Repository:** `ALKAVisuals/legend-stories-website`  
**Current pre-plan `main`:** `c2e21598aa71096217962804695d3ed26f5cd524`

## Completed

- Cloudflare hosting/DNS migration: complete.
- Post-cutover verification: complete.
- PayPal Stage P1: complete and recorded.
- PayPal Stage P2: complete and recorded.
- PayPal Live client is enabled for the Production Worker.
- Customer checkout remains paused after P2 verification.

Current guarded Production state confirmed during P2:

```text
PAYPAL_ALLOW_LIVE=true
LEGENDMURAL_CHECKOUT_PAUSED=true
ORDER_EMAILS_ENABLED=false
V3_PROFILE1_ORDER_CREATION_ENABLED=false
V3_INVOICE_RECONCILIATION_ENABLED=false
V3_INVOICE_STORAGE_ENABLED=false
V3_DASHBOARD_INVOICE_API_ENABLED=false
```

Evidence:

- `docs/CLOUDFLARE_PAYPAL_P1_PROOF_20260914.md`
- `docs/CLOUDFLARE_PAYPAL_P2_PROOF_20260914.md`

## P3 decision recorded

The owner wants the controlled P3 proof to use the lowest practical real amount rather than a normal EUR 35/EUR 45 customer product.

The current target is **EUR 0.01**, subject to the full PayPal/LegendMural path accepting that amount.

Do not lower an existing customer product price. The preferred P3 preparation is a temporary **server-side P3-only test SKU/product** that:

- is quoted authoritatively at EUR 0.01 by the server;
- is not listed or discoverable in the public storefront;
- does not enter ordinary navigation, sitemap, structured product data or feeds;
- cannot alter normal product pricing;
- can be fully removed after the controlled test.

The detailed execution/cleanup contract is in:

`docs/CLOUDFLARE_PAYPAL_P3_CONTROLLED_PAYMENT_PLAN_20260914.md`

## Open / not authorized yet

- P3 preparation implementation: open.
- P3 real self-payment window: **not yet authorized**; requires a new explicit approval immediately before execution.
- P3 refund: not yet executed; treat as a separately confirmed money-moving cleanup action.
- Temporary P3 test mechanism removal: required after proof.
- Customer checkout: not authorized.
- Production order-email sending: not authorized.
- V3 storage/reconciliation/dashboard activation: not authorized.
- Netlify decommission: not authorized.

## Exact next gate

After the P3 plan PR is merged, the next engineering action is **P3 preparation only**:

1. inspect the current checkout/catalog/build path;
2. implement the smallest temporary server-side EUR 0.01 test mechanism;
3. add tests proving exact quote integrity and public non-discoverability;
4. keep `LEGENDMURAL_CHECKOUT_PAUSED=true` throughout preparation and deployment;
5. verify checkout is still paused after deployment;
6. stop before any real PayPal order and obtain explicit owner authorization for the P3 payment window.

No real order or payment is authorized merely by merging the plan or preparing the test mechanism.

## Cleanup contract after P3

After the controlled proof:

- customer checkout must remain/revert to paused;
- the temporary EUR 0.01 test mechanism must be removed from production code/config;
- normal customer prices must remain unchanged;
- PayPal/Neon payment records should remain as legitimate audit history rather than being deleted;
- sanitized P3 evidence must be recorded in GitHub;
- customer commerce still remains a separate later launch gate.

## Startup order for the next chat

1. `docs/READ_ME_FIRST.md`
2. `docs/CLOUDFLARE_CURRENT_STATUS_20260914.md`
3. `docs/CLOUDFLARE_PAYPAL_P2_PROOF_20260914.md`
4. `docs/CLOUDFLARE_PAYPAL_P3_CONTROLLED_PAYMENT_PLAN_20260914.md`
5. `docs/CLOUDFLARE_PAYPAL_P1_PROOF_20260914.md`
6. `docs/CLOUDFLARE_MIGRATION_HANDOFF_20260911.md`
7. `docs/CLOUDFLARE_PAYPAL_LIVE_ACTIVATION_PLAN_20260911.md`
8. fresh-check current `main`, open PRs and Production runtime state before any mutation
