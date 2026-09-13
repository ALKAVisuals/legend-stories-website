# LegendMural storefront — READ ME FIRST

**Repository:** `ALKAVisuals/legend-stories-website`  
**Scope:** public LegendMural webshop / launch-readiness only  
**Current public hosting transition:** Cloudflare hosting/DNS migration is complete; customer commerce remains fail-closed and the next gated infrastructure phase is PayPal Live Stage P1  
**Synchronized Cloudflare status:** [`CLOUDFLARE_CURRENT_STATUS_20260913.md`](CLOUDFLARE_CURRENT_STATUS_20260913.md)  
**Active Cloudflare migration handoff:** [`CLOUDFLARE_MIGRATION_HANDOFF_20260911.md`](CLOUDFLARE_MIGRATION_HANDOFF_20260911.md)  
**Canonical Cloudflare post-cutover proof:** [`CLOUDFLARE_PHASE4_POST_CUTOVER_PROOF_20260911.md`](CLOUDFLARE_PHASE4_POST_CUTOVER_PROOF_20260911.md)  
**PayPal Live activation plan:** [`CLOUDFLARE_PAYPAL_LIVE_ACTIVATION_PLAN_20260911.md`](CLOUDFLARE_PAYPAL_LIVE_ACTIVATION_PLAN_20260911.md)  
**Newest general website next-chat handoff:** [`NEXT_CHAT_HANDOFF_20260905_V2.md`](NEXT_CHAT_HANDOFF_20260905_V2.md)  
**Current operational website status:** [`CURRENT_PRODUCTION_STATUS_20260903.md`](CURRENT_PRODUCTION_STATUS_20260903.md)  
**Final pre-release checklist:** [`FINAL_PRE_RELEASE_CHECKLIST_20260904.md`](FINAL_PRE_RELEASE_CHECKLIST_20260904.md)  
**Cross-track coordination:** [`PARALLEL_WORKSTREAM_COORDINATION.md`](PARALLEL_WORKSTREAM_COORDINATION.md)  
**Blocker C legal request package:** [`BLOCKER_C_DUTCH_CONSUMER_LAW_REQUEST_20260905.md`](BLOCKER_C_DUTCH_CONSUMER_LAW_REQUEST_20260905.md)

> **Every new chat working on the public website must start here.**

## Active Cloudflare migration checkpoint — synchronized 13 September 2026

The compact current status is in **`docs/CLOUDFLARE_CURRENT_STATUS_20260913.md`**. The detailed Netlify-to-Cloudflare continuation state remains in **`docs/CLOUDFLARE_MIGRATION_HANDOFF_20260911.md`**. If the chat is specifically about the Cloudflare migration or Production runtime activation, read both immediately after this file.

The Cloudflare hosting/DNS migration is now **100% complete for its defined scope**. The canonical live proof is `docs/CLOUDFLARE_PHASE4_POST_CUTOVER_PROOF_20260911.md` and records successful authoritative Cloudflare delegation, Worker Custom Domains, storefront/static delivery, apex/`www` HTTPS behavior, public 8/8 mail/service DNS preservation, unknown-API hardening, the 6/6 Stage C fail-closed API matrix, checkout-paused behavior and expected no-store/security response headers.

Repository synchronization baseline at this checkpoint:

```text
main: 9ba150feef49b934d1ec43b15d20f97bf39ea19d
latest merged migration/runtime preparation: PR #250
change: pin Production PAYPAL_API_BASE=https://api-m.paypal.com for P1 preparation
```

PR #250 is configuration preparation only. It did **not** enable PayPal Live, open checkout, add Production credentials, create an order, mutate Neon, send email, write R2 objects or activate V3.

The exact next infrastructure/runtime phase is **PayPal Live Stage P1**, and it still requires explicit owner authorization before any Production credential/configuration mutation. P1 is limited to safely configuring the prepared Production payment/database credentials and canonical checkout/Live API configuration in Cloudflare while keeping both `LEGENDMURAL_CHECKOUT_PAUSED=true` and `PAYPAL_ALLOW_LIVE=false`. P2, P3, customer checkout, Resend/order-email, V3/R2 activation and Netlify decommission remain separate later gates.

Do **not** rerun Gate 0 or Phase 4 merely because an older status file says they are pending. The synchronized status, proof files and active migration handoff supersede that older checkpoint language.

The older `docs/CLOUDFLARE_MIGRATION_HANDOFF_20260909.md` is historical only.

The Cloudflare migration is an explicitly separate infrastructure/runtime workstream. Its handoff may authorize inspection or narrowly scoped changes to migration-required PayPal/webhook/runtime integration code that the ordinary public-website track would otherwise treat as V3/backend-owned. That exception applies only when the owner has explicitly scoped the chat to the Cloudflare migration, and the migration handoff's guardrails remain mandatory.

## Current continuation checkpoint — 5 September 2026

The newest detailed general website continuation state is in **`docs/NEXT_CHAT_HANDOFF_20260905_V2.md`**. It supersedes the earlier same-day handoff and records the Blocker E audit plus the owner's latest rights-status confirmations.

**Website state:**

> `index.html` and `shop.html` already express the authoritative €35/€45 price context, €69-after-discount free-shipping rule, no fixed delivery-time marketing promise, 14-day statutory withdrawal summary and canonical 30/45-cm source variant identity directly in tracked source. `tests/tracked-source-commercial-contract.test.mjs` protects that contract. The public website remains approximately **88% launch-ready** by the project tracking estimate.

Blocker E now has three owner-confirmed facts recorded: the final sticker artworks are owner-created rather than literal copies/traces of third-party internet artwork, the final sticker artworks do not contain official brand/club/team/league logos, and they do not reproduce literal song lyrics or long third-party quotations. The remaining recognizable-person/title commercial-use question is intentionally deferred and must **not** be added to the public storefront as a disclaimer or rights-status statement. Do not repeatedly ask for that deferred question until the owner reopens it.

Blocker C now has a **ready-to-send Dutch consumer-law verification package** in `docs/BLOCKER_C_DUTCH_CONSUMER_LAW_REQUEST_20260905.md`. The package records the exact LegendMural 100%-upfront PayPal model, the current official-source conflict and the questions a qualified Dutch consumer-law adviser must answer. Do **not** redo generic research or redesign payment code merely to progress this gate. The next Blocker C action is to obtain a written opinion on the exact model and then record that conclusion in GitHub.

There is **no further independently identified storefront source-cleanup task**. Blocker C (Dutch 100%-upfront consumer payment legal gate) remains open/parked pending that written opinion, Blocker D part 2B remains intentionally deferred because the production/material facts are not available, Blocker E remains open/partially evidenced/deferred, and final customer launch remains unauthorized.

Do **not** repeatedly ask for the Blocker D vinyl/ink/laminate/packaging facts unless the owner says they are now available. Do **not** invent warnings. Do **not** redesign the PayPal/V3 flow merely to close Blocker C.

Always fresh-check `main` before starting because the separate V3 workstream may have merged since this checkpoint. Newer GitHub state overrides any recorded checkpoint SHA.

## Required startup order

1. Read this file.
2. If the chat is about the Netlify-to-Cloudflare migration or Production runtime activation, read [`CLOUDFLARE_CURRENT_STATUS_20260913.md`](CLOUDFLARE_CURRENT_STATUS_20260913.md) next.
3. Read [`CLOUDFLARE_MIGRATION_HANDOFF_20260911.md`](CLOUDFLARE_MIGRATION_HANDOFF_20260911.md) for the detailed migration/runtime continuation contract.
4. Read [`CLOUDFLARE_PHASE4_POST_CUTOVER_PROOF_20260911.md`](CLOUDFLARE_PHASE4_POST_CUTOVER_PROOF_20260911.md) before questioning or rerunning completed hosting/DNS proof.
5. For PayPal activation work, read [`CLOUDFLARE_PAYPAL_LIVE_ACTIVATION_PLAN_20260911.md`](CLOUDFLARE_PAYPAL_LIVE_ACTIVATION_PLAN_20260911.md) and obey the P1 -> P2 -> P3 approval boundaries.
6. For general public-website/launch-readiness work, read [`NEXT_CHAT_HANDOFF_20260905_V2.md`](NEXT_CHAT_HANDOFF_20260905_V2.md).
7. Read [`CURRENT_PRODUCTION_STATUS_20260903.md`](CURRENT_PRODUCTION_STATUS_20260903.md) when general operational website status is relevant.
8. Read [`FINAL_PRE_RELEASE_CHECKLIST_20260904.md`](FINAL_PRE_RELEASE_CHECKLIST_20260904.md) when launch-readiness is relevant.
9. Read [`PARALLEL_WORKSTREAM_COORDINATION.md`](PARALLEL_WORKSTREAM_COORDINATION.md).
10. For Blocker C work, read [`BLOCKER_C_DUTCH_CONSUMER_LAW_REQUEST_20260905.md`](BLOCKER_C_DUTCH_CONSUMER_LAW_REQUEST_20260905.md) before doing any further legal/payment analysis.
11. Fresh-check the current `main` SHA before making any repository change.
12. Work one meaningful website or migration step at a time.
13. Use a task-specific branch for mutations; never write directly to `main`.
14. Inspect relevant CI before merge.
15. Immediately before merge, fresh-check `main` again because separate workstreams may have merged in parallel.
16. If `main` changed, compare/rebase first and rerun relevant CI.
17. Do not deploy or publish to production without explicit owner approval for that exact release step.
18. Do not activate PayPal Live, Production email sending, V3 Profile 1, production migrations or V3 invoice issuance unless the explicitly scoped workstream and owner approval authorize that exact action.

## Source-of-truth rule

GitHub is the source of truth. Do not reconstruct current website or Cloudflare migration progress from old chat history.

For Cloudflare migration/runtime work, `CLOUDFLARE_CURRENT_STATUS_20260913.md`, the active migration handoff and their cited proof documents override older dated status notes. In particular, older statements saying Phase 4 or DNS propagation is still pending are historical and must not cause completed migration proofs to be rerun.

Older dated website handoffs and sprint notes may contain useful history, but they do **not** override the active Cloudflare migration handoff for migration work, or the newest general website next-chat handoff/current status/parallel-workstream coordination contract for ordinary website work.

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

If a website task appears to require one of those files or systems, stop and report the exact dependency before changing it. For an explicitly scoped Cloudflare migration chat, follow the narrower migration-specific exception and guardrails recorded in `docs/CLOUDFLARE_MIGRATION_HANDOFF_20260911.md`.

## Current release direction

The public website is technically far advanced, but final customer launch remains paused until the remaining website/legal/product launch gates and the PayPal Production proofs are resolved. The Cloudflare hosting/DNS migration itself is no longer an open launch blocker.

There is currently no independently identified ordinary storefront source-cleanup step. Blocker C's next step is external legal verification using the prepared request package; Blocker D part 2B and the remaining Blocker E question stay deferred until the owner reopens them. Do not manufacture technical work to bypass those gates.

## Separate workstreams

- Public website/launch-readiness work belongs to this track in `ALKAVisuals/legend-stories-website`.
- Cloudflare migration/runtime activation work has its synchronized status in `docs/CLOUDFLARE_CURRENT_STATUS_20260913.md` and detailed handoff in `docs/CLOUDFLARE_MIGRATION_HANDOFF_20260911.md`; hosting/DNS is complete and PayPal P1 is the next gated infrastructure phase.
- V3 Commerce / Orders / Invoices backend and delivery work belongs to the separate V3 chat, even though it uses the same repository.
- Dashboard work belongs in `ALKAVisuals/legendmural-dashboard` and must not be mixed into this track except for explicitly required migration integration points.

## Required report after website or migration work

Always report:

- files changed;
- whether V3-owned/protected files remained untouched or, for migration work, exactly which approved integration file was touched;
- branch + PR;
- starting `main` SHA;
- whether `main` changed during the work;
- tests/CI result;
- exact next step.

## Safety

Never commit secrets, customer payloads, database credentials, PayPal secrets or email-provider API keys. Never ask the owner to paste secrets into chat or GitHub documentation.