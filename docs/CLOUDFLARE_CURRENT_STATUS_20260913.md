# LegendMural Cloudflare — synchronized current status

**Date:** 2026-09-13  
**Repository:** `ALKAVisuals/legend-stories-website`  
**Synchronization baseline `main`:** `9ba150feef49b934d1ec43b15d20f97bf39ea19d`

This document is a compact synchronization layer between the canonical migration handoff and the repository proof files. It does not replace the underlying proofs.

## Proven complete

The following items are already supported by repository evidence and should not be rerun merely because an older status note still describes them as pending:

1. Production R2 resource provisioning and private-state verification.
2. Production Worker bootstrap in a fail-closed state.
3. Gate 0 read-only provider preflight.
4. Cloudflare authoritative DNS cutover.
5. Apex and `www` Worker Custom Domain attachment.
6. Public DNS propagation sufficient for external verification.
7. Preserved mail/service DNS verification: 8/8 PASS.
8. Storefront and static delivery through Cloudflare.
9. HTTPS and canonical `www` -> apex behavior.
10. Unknown API hardening.
11. Stage C known GET-only fail-closed API matrix: 6/6 PASS.
12. Checkout remains paused and returns the expected hardened/no-store response behavior.

Canonical proof files:

- `docs/CLOUDFLARE_PRODUCTION_R2_PROVISION_PROOF_20260910.md`
- `docs/CLOUDFLARE_PRODUCTION_WORKER_BOOTSTRAP_PROOF_20260910.md`
- `docs/CLOUDFLARE_GATE0_READONLY_PREFLIGHT_PROOF_20260911.md`
- `docs/CLOUDFLARE_PHASE4_POST_CUTOVER_PROOF_20260911.md`

The Phase 4 proof explicitly concludes that the Cloudflare hosting/DNS migration is complete for its defined scope.

## Latest repository preparation

Current synchronization baseline `main` is:

```text
9ba150feef49b934d1ec43b15d20f97bf39ea19d
```

The latest relevant merged change is PR #250, which pins the Production PayPal API base needed for the next guarded activation phase.

This is repository/configuration preparation only. It does not prove that provider-side Production payment credentials have been configured, that PayPal Live is enabled, that checkout is open, or that a real payment has been completed.

## Still unproven / not authorized

The following remain separate future gates:

```text
PayPal Stage P1 provider configuration proof    OPEN
PayPal Stage P2 Live-client proof               OPEN
PayPal Stage P3 controlled self-payment proof   OPEN
Customer checkout                               NOT AUTHORIZED
Production order-email sending                  NOT AUTHORIZED
V3 invoice-storage / R2 writes                  NOT AUTHORIZED
Dashboard invoice API activation                NOT AUTHORIZED
Netlify decommission                            NOT AUTHORIZED
```

## Exact next phase

The next infrastructure/runtime phase is **PayPal Live Stage P1** as defined in:

- `docs/CLOUDFLARE_PAYPAL_LIVE_ACTIVATION_PLAN_20260911.md`

P1 still requires explicit owner approval before any Production provider mutation. During P1, checkout and PayPal Live must remain disabled; no order, charge, customer email, invoice-storage write or V3 activation belongs in that stage.

P2 and P3 each require their own later approval. Customer checkout remains a separate gate even after a successful controlled self-payment.

## Continuation rule

For a new migration/runtime chat, read in this order:

1. `docs/READ_ME_FIRST.md`
2. `docs/CLOUDFLARE_CURRENT_STATUS_20260913.md`
3. `docs/CLOUDFLARE_MIGRATION_HANDOFF_20260911.md`
4. `docs/CLOUDFLARE_PHASE4_POST_CUTOVER_PROOF_20260911.md`
5. `docs/CLOUDFLARE_PAYPAL_LIVE_ACTIVATION_PLAN_20260911.md`
6. fresh-check `main` and open PRs

Do not reconstruct completed migration work from screenshots or old chats when repository proof already exists.