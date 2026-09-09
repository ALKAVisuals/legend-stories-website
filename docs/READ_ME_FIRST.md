# LegendMural storefront — READ ME FIRST

**Repository:** `ALKAVisuals/legend-stories-website`  
**Scope:** public LegendMural webshop / launch-readiness only  
**Production host:** Netlify  
**Active Cloudflare migration handoff:** [`CLOUDFLARE_MIGRATION_HANDOFF_20260909.md`](CLOUDFLARE_MIGRATION_HANDOFF_20260909.md)  
**Newest general website next-chat handoff:** [`NEXT_CHAT_HANDOFF_20260905_V2.md`](NEXT_CHAT_HANDOFF_20260905_V2.md)  
**Current operational website status:** [`CURRENT_PRODUCTION_STATUS_20260903.md`](CURRENT_PRODUCTION_STATUS_20260903.md)  
**Final pre-release checklist:** [`FINAL_PRE_RELEASE_CHECKLIST_20260904.md`](FINAL_PRE_RELEASE_CHECKLIST_20260904.md)  
**Cross-track coordination:** [`PARALLEL_WORKSTREAM_COORDINATION.md`](PARALLEL_WORKSTREAM_COORDINATION.md)  
**Blocker C legal request package:** [`BLOCKER_C_DUTCH_CONSUMER_LAW_REQUEST_20260905.md`](BLOCKER_C_DUTCH_CONSUMER_LAW_REQUEST_20260905.md)

> **Every new chat working on the public website must start here.**

## Active Cloudflare migration checkpoint — 9 September 2026

The current Netlify-to-Cloudflare migration continuation state is in **`docs/CLOUDFLARE_MIGRATION_HANDOFF_20260909.md`**. If the chat is specifically about the Cloudflare migration, read that file immediately after this one and treat it as the canonical migration handoff.

It records the resolved PayPal webhook-ID/signature-verification blocker, the successful HTTP `200` Cloudflare preview delivery proof, the newly isolated duplicate-webhook/Neon least-privilege blocker, the exact evidence in current source, and the minimal next code/test step. Do not reconstruct that migration state from screenshots or older chats when the handoff is available.

The Cloudflare migration is an explicitly separate infrastructure/runtime workstream. Its handoff may authorize inspection or narrowly scoped changes to migration-required PayPal/webhook/runtime integration code that the ordinary public-website track would otherwise treat as V3/backend-owned. That exception applies only when the owner has explicitly scoped the chat to the Cloudflare migration, and the migration handoff's guardrails remain mandatory.

## Current continuation checkpoint — 5 September 2026

The newest detailed general website continuation state is in **`docs/NEXT_CHAT_HANDOFF_20260905_V2.md`**. It supersedes the earlier same-day handoff and records the Blocker E audit plus the owner's latest rights-status confirmations.

**Website state:**

> `index.html` and `shop.html` already express the authoritative €35/€45 price context, €69-after-discount free-shipping rule, no fixed delivery-time marketing promise, 14-day statutory withdrawal summary and canonical 30/45-cm source variant identity directly in tracked source. `tests/tracked-source-commercial-contract.test.mjs` protects that contract. The public website remains approximately **88% launch-ready** by the project tracking estimate.

Blocker E now has three owner-confirmed facts recorded: the final sticker artworks are owner-created rather than literal copies/traces of third-party internet artwork, the final sticker artworks do not contain official brand/club/team/league logos, and they do not reproduce literal song lyrics or long third-party quotations. The remaining recognizable-person/title commercial-use question is intentionally deferred and must **not** be added to the public storefront as a disclaimer or rights-status statement. Do not repeatedly ask for that deferred question until the owner reopens it.

Blocker C now has a **ready-to-send Dutch consumer-law verification package** in `docs/BLOCKER_C_DUTCH_CONSUMER_LAW_REQUEST_20260905.md`. The package records the exact LegendMural 100%-upfront PayPal model, the current official-source conflict and the questions a qualified Dutch consumer-law adviser must answer. Do **not** redo generic research or redesign payment code merely to progress this gate. The next Blocker C action is to obtain a written opinion on the exact model and then record that conclusion in GitHub.

There is **no further independently identified storefront source-cleanup task**. Blocker C (Dutch 100%-upfront consumer payment legal gate) remains open/parked pending that written opinion, Blocker D part 2B remains intentionally deferred because the production/material facts are not available, Blocker E remains open/partially evidenced/deferred, and Netlify Production remains unauthorized.

Do **not** repeatedly ask for the Blocker D vinyl/ink/laminate/packaging facts unless the owner says they are now available. Do **not** invent warnings. Do **not** redesign the PayPal/V3 flow merely to close Blocker C.

Always fresh-check `main` before starting because the separate V3 workstream may have merged since this checkpoint. Newer GitHub state overrides any recorded checkpoint SHA.

## Required startup order

1. Read this file.
2. If the chat is about the Netlify-to-Cloudflare migration, read [`CLOUDFLARE_MIGRATION_HANDOFF_20260909.md`](CLOUDFLARE_MIGRATION_HANDOFF_20260909.md) next and follow its exact continuation step.
3. For general public-website/launch-readiness work, read [`NEXT_CHAT_HANDOFF_20260905_V2.md`](NEXT_CHAT_HANDOFF_20260905_V2.md).
4. Read [`CURRENT_PRODUCTION_STATUS_20260903.md`](CURRENT_PRODUCTION_STATUS_20260903.md) when general operational website status is relevant.
5. Read [`FINAL_PRE_RELEASE_CHECKLIST_20260904.md`](FINAL_PRE_RELEASE_CHECKLIST_20260904.md) when launch-readiness is relevant.
6. Read [`PARALLEL_WORKSTREAM_COORDINATION.md`](PARALLEL_WORKSTREAM_COORDINATION.md).
7. For Blocker C work, read [`BLOCKER_C_DUTCH_CONSUMER_LAW_REQUEST_20260905.md`](BLOCKER_C_DUTCH_CONSUMER_LAW_REQUEST_20260905.md) before doing any further legal/payment analysis.
8. Fresh-check the current `main` SHA before making any repository change.
9. Work one meaningful website or migration step at a time.
10. Use a task-specific branch for mutations; never write directly to `main`.
11. Inspect relevant CI before merge.
12. Immediately before merge, fresh-check `main` again because separate workstreams may have merged in parallel.
13. If `main` changed, compare/rebase first and rerun relevant CI.
14. Do not deploy or publish to production without explicit owner approval for that exact release step.
15. Do not activate PayPal Live, Production email sending, V3 Profile 1, production migrations or V3 invoice issuance unless the explicitly scoped workstream and owner approval authorize that exact action.

## Source-of-truth rule

GitHub is the source of truth. Do not reconstruct current website or Cloudflare migration progress from old chat history.

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

If a website task appears to require one of those files or systems, stop and report the exact dependency before changing it. For an explicitly scoped Cloudflare migration chat, follow the narrower migration-specific exception and guardrails recorded in `docs/CLOUDFLARE_MIGRATION_HANDOFF_20260909.md`.

## Current release direction

The public website is technically far advanced, but the final production cutover remains paused until the remaining website/legal/product launch gates and Cloudflare migration proofs are resolved.

There is currently no independently identified ordinary storefront source-cleanup step. Blocker C's next step is external legal verification using the prepared request package; Blocker D part 2B and the remaining Blocker E question stay deferred until the owner reopens them. Do not manufacture technical work to bypass those gates.

## Separate workstreams

- Public website/launch-readiness work belongs to this track in `ALKAVisuals/legend-stories-website`.
- Cloudflare migration work has its own current handoff in `docs/CLOUDFLARE_MIGRATION_HANDOFF_20260909.md` and may cross narrowly into migration-required runtime integrations.
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
