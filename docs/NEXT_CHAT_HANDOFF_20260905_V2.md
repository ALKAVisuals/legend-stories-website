# LegendMural public website — next-chat handoff v2

**Date:** 5 September 2026  
**Repository:** `ALKAVisuals/legend-stories-website`  
**Scope:** public storefront / website launch-readiness only  
**Production host:** Netlify  
**Canonical intended public origin:** `https://legendmural.com`

> This file supersedes `NEXT_CHAT_HANDOFF_20260905.md` for the public-website continuation state. Read `READ_ME_FIRST.md`, then this file, then `CURRENT_PRODUCTION_STATUS_20260903.md`, `FINAL_PRE_RELEASE_CHECKLIST_20260904.md` and `PARALLEL_WORKSTREAM_COORDINATION.md`.

GitHub is the source of truth. Always fresh-check current `main` before a new branch and immediately before merge because the separate V3 workstream shares this repository.

## Latest website checkpoint

Latest completed website work before this handoff:

- PR #194 — tracked-source commercial cleanup;
- PR #198 — website next-chat handoff;
- PR #199 — Blocker E IP/commercial-rights audit.

PR #199 was merged at `main` commit `1e96407d78f2b78f33f5c59b7ac8ef5d608e4894` before the owner confirmations below were recorded.

No Netlify Production deployment, PayPal Live activation, Production email activation, V3 Profile 1 activation, Production migration or real live payment/email proof is authorized by this handoff.

## Blocker E — latest owner confirmations

On 5 September 2026, the owner explicitly confirmed:

1. all final sticker artworks are created by LegendMural/Alka Group and are not literal copies or traces of third-party internet photographs/artwork for commercial sale;
2. no official brand, club, team or league logos are included in the final sticker artworks;
3. no literal song lyrics or long third-party quotations are included in the final sticker artworks.

These three owner-information questions are therefore recorded as complete for the current launch review.

The remaining commercial-use question for recognizable people / associated titles is **intentionally deferred by the owner** and will be revisited later. Do not repeatedly ask for it before the owner reopens that topic. Do not add public storefront wording, disclaimers or rights-status notices about this internal gate.

Canonical detailed audit: `docs/IP_COMMERCIAL_RIGHTS_AUDIT_20260905.md`.

Blocker E is therefore **open / partially evidenced / intentionally deferred**, not closed.

## Other remaining launch gates

### Blocker C — Dutch 100%-upfront payment legal gate

Still open/parked. Canonical owner decision remains PayPal-only, 100% paid when the order is placed, production after verified full payment, delivery later, no split/deposit/later balance and no extra provider merely to solve this gate.

Do not redesign PayPal/V3 behavior from the website track. A specific Dutch consumer-law basis/opinion is still required before treating the unchanged Dutch consumer launch model as cleared.

### Blocker D part 2B — GPSR material/product-safety completion

Still intentionally deferred until exact vinyl/media, ink, laminate/coating and final packaging/physical-marking facts exist. Do not repeatedly ask for these facts unless the owner says they are now available. Do not invent warnings or stronger material claims.

### Final-domain / Production

Tracked `legendmural.com` metadata and source/build readiness are complete to the pre-release baseline. Live domain/DNS/TLS/metadata/smoke proof can only happen after an explicitly authorized Netlify Production cutover.

Production remains unauthorized.

## Current readiness estimate

Overall public website launch-readiness remains approximately **88%**. The owner confirmations improve the evidence quality inside Blocker E but do not close the remaining recognizable-person/title clearance gate, so the overall percentage is not materially increased.

## Exact next website handling

There is currently no independently identified storefront source-cleanup task left after PR #194.

Until the owner reopens one of the deferred/legal gates, the website track should:

- not re-ask the deferred Blocker E recognizable-person/title question;
- not re-ask Blocker D part 2B material facts;
- not redesign the unchanged PayPal/V3 flow to force-close Blocker C;
- not deploy Netlify Production without explicit owner approval for that exact release step;
- continue only with a newly identified, evidence-based public-site defect that is independent of those gates.

If no such defect exists, report that the remaining work is gate-dependent rather than inventing technical work.

## Workstream boundary

Do not modify V3-reserved files/responsibilities without explicit coordination, including:

```text
server/invoices/**
server/notifications/**
server/adapters/neon-order-notification-store.mjs
server/adapters/neon-paid-order-finalizer.mjs
server/netlify/paid-order-notification-runtime.mjs
server/api/capture-paypal-order.mjs
server/payments/paypal-webhook-reconciliation.mjs
```

Also reserved to V3: order/invoice identity, immutable invoice snapshots, V3 migrations, PDF/email delivery, claim-token/lease/artifact logic, Profile-0/Profile-1 routing and V3 retry/reconciliation semantics.

## Required report after website work

Always report exact files changed, whether V3-protected files remained untouched, branch + PR, starting `main` SHA, whether `main` moved during work, tests/CI, updated readiness and exact next website step.

Never commit or request secrets.
