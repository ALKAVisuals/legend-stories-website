# LegendMural public website — next-chat handoff v2

**Date:** 5 September 2026  
**Repository:** `ALKAVisuals/legend-stories-website`  
**Scope:** public storefront / website launch-readiness only  
**Production host:** Netlify  
**Canonical intended public origin:** `https://legendmural.com`

> This file supersedes `NEXT_CHAT_HANDOFF_20260905.md` for the public-website continuation state. Read `READ_ME_FIRST.md`, then this file, then `CURRENT_PRODUCTION_STATUS_20260903.md`, `FINAL_PRE_RELEASE_CHECKLIST_20260904.md` and `PARALLEL_WORKSTREAM_COORDINATION.md`.

GitHub is the source of truth. Always fresh-check current `main` before a new branch and immediately before merge because the separate V3 workstream shares this repository.

## Latest website checkpoint

Latest completed website work before the Blocker C request preparation:

- PR #194 — tracked-source commercial cleanup;
- PR #198 — website next-chat handoff;
- PR #199 — Blocker E IP/commercial-rights audit;
- PR #201 — Blocker E owner confirmations recorded; recognizable-person/title question intentionally deferred.

After PR #201, the shared repository `main` moved again through separate V3 PR #200. The Blocker C request package work therefore started from fresh `main` commit `15ae768cd3ea7677b045668e5a465b2a3f0f95d4`. That V3 work is outside website scope and must not be modified from this track.

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

## Blocker C — Dutch 100%-upfront payment legal gate

Still open. Canonical owner decision remains PayPal-only, 100% paid when the order is placed, production after verified full payment, delivery later, no split/deposit/later balance and no extra provider merely to solve this gate.

A dedicated ready-to-send legal verification package now exists:

`docs/BLOCKER_C_DUTCH_CONSUMER_LAW_REQUEST_20260905.md`

That package records:

- the exact LegendMural checkout/payment model to be assessed;
- the exact legal question under Article 7:26(2) BW;
- the required sub-questions and requested `CLEARED / CLEARED WITH CONDITIONS / NOT CLEARED` conclusion;
- current official ACM ConsuWijzer guidance;
- a 2026 Dutch Government source confirming that the 50%-advance-payment rule remains in place after government review;
- a ready-to-send Dutch message for a qualified consumer-law adviser.

Current official-source evidence does **not** provide a basis to close Blocker C internally. Do not redo generic research and do not redesign PayPal/V3 code simply to progress this gate.

A concrete jurist shortlist is also prepared in:

`docs/BLOCKER_C_JURIST_SHORTLIST_20260905.md`

Current recommended contact order is:

1. VLDW Advocaten — Cora Blaak-Looij, because the firm's public practice specifically covers consumer rights in internet sales;
2. Kennedy Van der Laan — Kirsten Gerhards, advocaat with explicit e-commerce and consumer-law work;
3. Brinkhof — Hanneke Kooijman, advocaat advising on consumer law with a digital-sector focus.

**Exact next Blocker C action:** contact the first suitable adviser from that shortlist, ask for a fixed/capped fee and short written opinion on the exact model in the request package, and obtain a written `CLEARED / CLEARED WITH CONDITIONS / NOT CLEARED` conclusion. When received, record the conclusion in GitHub and only then decide whether any implementation change is required.

## Blocker D part 2B — GPSR material/product-safety completion

Still intentionally deferred until exact vinyl/media, ink, laminate/coating and final packaging/physical-marking facts exist. Do not repeatedly ask for these facts unless the owner says they are now available. Do not invent warnings or stronger material claims.

## Final-domain / Production

Tracked `legendmural.com` metadata and source/build readiness are complete to the pre-release baseline. Live domain/DNS/TLS/metadata/smoke proof can only happen after an explicitly authorized Netlify Production cutover.

Production remains unauthorized.

## Current readiness estimate

Overall public website launch-readiness remains approximately **88%**. Preparing the Blocker C legal request and jurist shortlist improves process readiness but does not close the legal gate, so the overall percentage is not materially increased.

## Exact next website handling

There is currently no independently identified storefront source-cleanup task left after PR #194.

The next actionable website release step is now external rather than code:

> **Use `docs/BLOCKER_C_JURIST_SHORTLIST_20260905.md` and `docs/BLOCKER_C_DUTCH_CONSUMER_LAW_REQUEST_20260905.md` to obtain a short written Dutch consumer-law opinion on the exact mandatory 100%-upfront PayPal model.**

Until that answer arrives, the website track should:

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
