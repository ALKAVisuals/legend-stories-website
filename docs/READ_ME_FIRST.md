# LegendMural storefront — READ ME FIRST

**Repository:** `ALKAVisuals/legend-stories-website`  
**Scope:** public LegendMural webshop / launch-readiness only  
**Current public hosting transition:** Cloudflare hosting/DNS migration is complete; PayPal P1/P2 are complete; customer checkout remains fail-closed and the next gated infrastructure phase is PayPal Stage P3 preparation  
**Synchronized Cloudflare status:** [`CLOUDFLARE_CURRENT_STATUS_20260914.md`](CLOUDFLARE_CURRENT_STATUS_20260914.md)  
**P2 proof:** [`CLOUDFLARE_PAYPAL_P2_PROOF_20260914.md`](CLOUDFLARE_PAYPAL_P2_PROOF_20260914.md)  
**P3 controlled-payment plan:** [`CLOUDFLARE_PAYPAL_P3_CONTROLLED_PAYMENT_PLAN_20260914.md`](CLOUDFLARE_PAYPAL_P3_CONTROLLED_PAYMENT_PLAN_20260914.md)  
**Active Cloudflare migration handoff:** [`CLOUDFLARE_MIGRATION_HANDOFF_20260911.md`](CLOUDFLARE_MIGRATION_HANDOFF_20260911.md)  
**Canonical Cloudflare post-cutover proof:** [`CLOUDFLARE_PHASE4_POST_CUTOVER_PROOF_20260911.md`](CLOUDFLARE_PHASE4_POST_CUTOVER_PROOF_20260911.md)  
**PayPal Live activation plan:** [`CLOUDFLARE_PAYPAL_LIVE_ACTIVATION_PLAN_20260911.md`](CLOUDFLARE_PAYPAL_LIVE_ACTIVATION_PLAN_20260911.md)  
**Newest general website next-chat handoff:** [`NEXT_CHAT_HANDOFF_20260905_V2.md`](NEXT_CHAT_HANDOFF_20260905_V2.md)  
**Current operational website status:** [`CURRENT_PRODUCTION_STATUS_20260903.md`](CURRENT_PRODUCTION_STATUS_20260903.md)  
**Final pre-release checklist:** [`FINAL_PRE_RELEASE_CHECKLIST_20260904.md`](FINAL_PRE_RELEASE_CHECKLIST_20260904.md)  
**Cross-track coordination:** [`PARALLEL_WORKSTREAM_COORDINATION.md`](PARALLEL_WORKSTREAM_COORDINATION.md)  
**Blocker C legal request package:** [`BLOCKER_C_DUTCH_CONSUMER_LAW_REQUEST_20260905.md`](BLOCKER_C_DUTCH_CONSUMER_LAW_REQUEST_20260905.md)

> **Every new chat working on the public website must start here.**

## Active Cloudflare runtime checkpoint — synchronized 14 September 2026

The compact current state is in **`docs/CLOUDFLARE_CURRENT_STATUS_20260914.md`**. The detailed Netlify-to-Cloudflare continuation state remains in **`docs/CLOUDFLARE_MIGRATION_HANDOFF_20260911.md`**. If the chat is specifically about Cloudflare or Production payment/runtime activation, read the current status, P2 proof and P3 plan immediately after this file.

The Cloudflare hosting/DNS migration is **100% complete for its defined scope**. PayPal Stage P1 and Stage P2 are also complete for their defined scopes. Customer checkout is still deliberately paused.

Repository synchronization baseline before the P3 plan branch:

```text
main: c2e21598aa71096217962804695d3ed26f5cd524
latest merged payment proof: PR #253
state: PAYPAL_ALLOW_LIVE=true while LEGENDMURAL_CHECKOUT_PAUSED=true
```

Current guarded Production state recorded by the P2 proof:

```text
PAYPAL_ALLOW_LIVE=true
LEGENDMURAL_CHECKOUT_PAUSED=true
ORDER_EMAILS_ENABLED=false
V3_PROFILE1_ORDER_CREATION_ENABLED=false
V3_INVOICE_RECONCILIATION_ENABLED=false
V3_INVOICE_STORAGE_ENABLED=false
V3_DASHBOARD_INVOICE_API_ENABLED=false
```

The exact next engineering phase is **P3 preparation only**. The current target is one controlled real-payment proof at **EUR 0.01**, using a temporary server-side P3-only test item/mechanism that must remain undiscoverable to ordinary customers and must be removed after the proof. Do not lower the price of an existing customer product.

The detailed rules are in `docs/CLOUDFLARE_PAYPAL_P3_CONTROLLED_PAYMENT_PLAN_20260914.md`. Preparation must keep checkout paused. The actual real-payment window still requires a new, separate explicit owner approval immediately before execution.

Do **not** interpret P3 preparation as permission to open customer checkout. Do not enable Production emails, any V3 activation flag, R2 writes, or Netlify decommission as part of P3.

Do **not** rerun Gate 0 or Phase 4 merely because an older status file says they are pending. The synchronized status and proof files supersede older checkpoint language.

The older `docs/CLOUDFLARE_MIGRATION_HANDOFF_20260909.md` and `docs/CLOUDFLARE_CURRENT_STATUS_20260913.md` are historical for current runtime continuation.

The Cloudflare migration/runtime workstream is explicitly separate from ordinary website work. Its handoff may authorize inspection or narrowly scoped changes to migration/payment integration code that the ordinary public-website track would otherwise treat as V3/backend-owned. That exception applies only when the owner has explicitly scoped the chat to this runtime work, and the migration/payment guardrails remain mandatory.

## Current continuation checkpoint — 5 September 2026

The newest detailed general website continuation state is in **`docs/NEXT_CHAT_HANDOFF_20260905_V2.md`**. It supersedes the earlier same-day handoff and records the Blocker E audit plus the owner's latest rights-status confirmations.

**Website state:**

> `index.html` and `shop.html` already express the authoritative €35/€45 price context, €69-after-discount free-shipping rule, no fixed delivery-time marketing promise, 14-day statutory withdrawal summary and canonical 30/45-cm source variant identity directly in tracked source. `tests/tracked-source-commercial-contract.test.mjs` protects that contract. The public website remains approximately **88% launch-ready** by the project tracking estimate.

Blocker E now has three owner-confirmed facts recorded: the final sticker artworks are owner-created rather than literal copies/traces of third-party internet artwork, the final sticker artworks do not contain official brand/club/team/league logos, and they do not reproduce literal song lyrics or long third-party quotations. The remaining recognizable-person/title commercial-use question is intentionally deferred and must **not** be added to the public storefront as a disclaimer or rights-status statement. Do not repeatedly ask for that deferred question until the owner reopens it.

Blocker C now has a **ready-to-send Dutch consumer-law verification package** in `docs/BLOCKER_C_DUTCH_CONSUMER_LAW_REQUEST_20260905.md`. The package records the exact LegendMural 100%-upfront PayPal model, the current official-source conflict and the questions a qualified Dutch consumer-law adviser must answer. Do **not** redo generic research or redesign payment code merely to progress this gate. The next Blocker C action is to obtain a written opinion on the exact model and then record that conclusion in GitHub.

There is **no further independently identified storefront source-cleanup task**. Blocker C (Dutch 100%-upfront consumer payment legal gate) remains open/parked pending that written opinion, Blocker D part 2B remains intentionally deferred because the production/material facts are not available, Blocker E remains open/partially evidenced/deferred, and final customer launch remains unauthorized.

Do **not** repeatedly ask for the Blocker D vinyl/ink/laminate/packaging facts unless the owner says they are now available. Do **not** invent warnings. Do **not** redesign the PayPal/V3 flow merely to close Blocker C.

Always fresh-check `main` before starting because separate workstreams may have merged since this checkpoint. Newer GitHub state overrides any recorded checkpoint SHA.

## Required startup order

1. Read this file.
2. If the chat is about Cloudflare/Production runtime activation, read [`CLOUDFLARE_CURRENT_STATUS_20260914.md`](CLOUDFLARE_CURRENT_STATUS_20260914.md) next.
3. Read [`CLOUDFLARE_PAYPAL_P2_PROOF_20260914.md`](CLOUDFLARE_PAYPAL_P2_PROOF_20260914.md) before changing the current guarded PayPal state.
4. For P3 work, read [`CLOUDFLARE_PAYPAL_P3_CONTROLLED_PAYMENT_PLAN_20260914.md`](CLOUDFLARE_PAYPAL_P3_CONTROLLED_PAYMENT_PLAN_20260914.md) and obey the preparation/payment/refund/cleanup gates.
5. Read [`CLOUDFLARE_MIGRATION_HANDOFF_20260911.md`](CLOUDFLARE_MIGRATION_HANDOFF_20260911.md) for the detailed migration/runtime continuation contract.
6. Read [`CLOUDFLARE_PHASE4_POST_CUTOVER_PROOF_20260911.md`](CLOUDFLARE_PHASE4_POST_CUTOVER_PROOF_20260911.md) before questioning or rerunning completed hosting/DNS proof.
7. Keep [`CLOUDFLARE_PAYPAL_LIVE_ACTIVATION_PLAN_20260911.md`](CLOUDFLARE_PAYPAL_LIVE_ACTIVATION_PLAN_20260911.md) as the high-level P1 -> P2 -> P3 approval contract.
8. For general public-website/launch-readiness work, read [`NEXT_CHAT_HANDOFF_20260905_V2.md`](NEXT_CHAT_HANDOFF_20260905_V2.md).
9. Read [`CURRENT_PRODUCTION_STATUS_20260903.md`](CURRENT_PRODUCTION_STATUS_20260903.md) when general operational website status is relevant.
10. Read [`FINAL_PRE_RELEASE_CHECKLIST_20260904.md`](FINAL_PRE_RELEASE_CHECKLIST_20260904.md) when launch-readiness is relevant.
11. Read [`PARALLEL_WORKSTREAM_COORDINATION.md`](PARALLEL_WORKSTREAM_COORDINATION.md).
12. For Blocker C work, read [`BLOCKER_C_DUTCH_CONSUMER_LAW_REQUEST_20260905.md`](BLOCKER_C_DUTCH_CONSUMER_LAW_REQUEST_20260905.md) before doing any further legal/payment analysis.
13. Fresh-check the current `main` SHA before making any repository change.
14. Work one meaningful website or runtime step at a time.
15. Use a task-specific branch for mutations; never write directly to `main`.
16. Inspect relevant CI before merge.
17. Immediately before merge, fresh-check `main` again because separate workstreams may have merged in parallel.
18. If `main` changed, compare/rebase first and rerun relevant CI.
19. Do not deploy or publish to Production without explicit owner approval for that exact release step.
20. Do not open the real P3 payment window, customer checkout, Production email sending, V3 Profile 1, production migrations or V3 invoice issuance unless the explicitly scoped workstream and owner approval authorize that exact action.

## Source-of-truth rule

GitHub is the source of truth. Do not reconstruct current website or Cloudflare/payment progress from old chat history.

For Cloudflare/payment runtime work, `CLOUDFLARE_CURRENT_STATUS_20260914.md`, the P2 proof, P3 controlled-payment plan and active migration handoff override older dated status notes. In particular, older statements saying Phase 4, DNS propagation, P1 or P2 are still pending are historical and must not cause completed proofs to be rerun.

Older dated website handoffs and sprint notes may contain useful history, but they do **not** override the active Cloudflare/runtime handoff for migration/payment work, or the newest general website next-chat handoff/current status/parallel-workstream coordination contract for ordinary website work.

The separate LegendMural V3 chat maintains its own V3 handoff and decisions. Do not reconstruct or overwrite V3 status from the ordinary website track.

## Public website scope

This track may work on:

- storefront UI/UX, homepage, shop and product presentation;
- responsive/mobile improvements;
- general public content;
- Privacy, Terms, Shipping and Returns;
- AVG/privacy launch-readiness;
- GPSR/product-safety presentation;
- SEO, canonical/Open Graph metadata and `legendmural.com` metadata;
- general visual website improvements;
- launch-readiness blockers that do not modify the V3 commerce backend.

## V3/backend boundary

Without explicit cross-track approval, this website track must not modify:

- `server/invoices/**`;
- `server/notifications/**`;
- `server/adapters/neon-order-notification-store.mjs`;
- V3 invoice/notification Neon adapters;
- paid-order finalizer code;
- PayPal capture/webhook reconciliation code;
- Profile-0/Profile-1 routing;
- V3 invoice snapshot/PDF/Resend/retry code;
- V3 order/invoice/notification migrations.

The full responsibility-based boundary is mandatory in `docs/PARALLEL_WORKSTREAM_COORDINATION.md`.

If a website task appears to require one of those files or systems, stop and report the exact dependency before changing it. For an explicitly scoped Cloudflare/payment runtime chat, follow the narrower migration/runtime exception and guardrails recorded in `docs/CLOUDFLARE_MIGRATION_HANDOFF_20260911.md` and the active P3 plan.

## Current release direction

The public website is technically far advanced, but final customer launch remains paused until the remaining website/legal/product launch gates and the PayPal Production proofs are resolved. The Cloudflare hosting/DNS migration itself is no longer an open launch blocker.

There is currently no independently identified ordinary storefront source-cleanup step. Blocker C's next step is external legal verification using the prepared request package; Blocker D part 2B and the remaining Blocker E question stay deferred until the owner reopens them. Do not manufacture technical work to bypass those gates.

## Separate workstreams

- Public website/launch-readiness work belongs to this track in `ALKAVisuals/legend-stories-website`.
- Cloudflare migration/runtime activation work has its synchronized status in `docs/CLOUDFLARE_CURRENT_STATUS_20260914.md`; hosting/DNS, P1 and P2 are complete, and P3 preparation is next.
- V3 Commerce / Orders / Invoices backend and delivery work belongs to the separate V3 chat, even though it uses the same repository.
- Dashboard work belongs in `ALKAVisuals/legendmural-dashboard` and must not be mixed into this track except for explicitly required migration integration points.

## Required report after website or migration/runtime work

Always report:

- files changed;
- whether V3-owned/protected files remained untouched or, for migration/runtime work, exactly which approved integration file was touched;
- branch + PR;
- starting `main` SHA;
- whether `main` changed during the work;
- tests/CI result;
- exact next step.

## Safety

Never commit secrets, customer payloads, database credentials, PayPal secrets or email-provider API keys. Never ask the owner to paste secrets into chat or GitHub documentation.
