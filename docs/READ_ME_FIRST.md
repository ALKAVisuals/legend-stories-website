# LegendMural storefront — READ ME FIRST

**Repository:** `ALKAVisuals/legend-stories-website`  
**Scope:** public LegendMural webshop / launch-readiness only  
**Production host:** Netlify  
**Current operational website status:** [`CURRENT_PRODUCTION_STATUS_20260903.md`](CURRENT_PRODUCTION_STATUS_20260903.md)  
**Cross-track coordination:** [`PARALLEL_WORKSTREAM_COORDINATION.md`](PARALLEL_WORKSTREAM_COORDINATION.md)

> **Every new chat working on the public website must start here.**

## Required startup order

1. Read this file.
2. Read [`CURRENT_PRODUCTION_STATUS_20260903.md`](CURRENT_PRODUCTION_STATUS_20260903.md).
3. Read [`PARALLEL_WORKSTREAM_COORDINATION.md`](PARALLEL_WORKSTREAM_COORDINATION.md).
4. Fresh-check the current `main` SHA before making any repository change.
5. Work one meaningful website step at a time.
6. Use a website-specific branch for mutations; never write directly to `main`.
7. Inspect relevant CI before merge.
8. Immediately before merge, fresh-check `main` again because the separate V3 track may have merged in parallel.
9. If `main` changed, compare/rebase first and rerun relevant CI.
10. Do not deploy or publish to Netlify Production without explicit owner approval for that exact release step.
11. Do not activate PayPal Live, Production email sending, V3 Profile 1, production migrations or V3 invoice issuance from this website track.

## Source-of-truth rule

GitHub is the source of truth. Do not reconstruct current website progress from old chat history.

Older dated website handoffs and sprint notes may contain useful history, but they do **not** override the current status file or the parallel-workstream coordination contract linked above.

The separate LegendMural V3 chat maintains its own V3 handoff and decisions. Do not reconstruct or overwrite V3 status from this website track.

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

If a website task appears to require one of those files or systems, stop and report the exact dependency before changing it.

## Current release direction

The public website is technically far advanced, but the final Netlify cutover remains paused until the remaining website/legal launch-readiness blockers are closed.

The next website step is **not** a Production deploy. Follow **Exact next step** in `CURRENT_PRODUCTION_STATUS_20260903.md`.

## Separate workstreams

- Public website/launch-readiness work belongs to this track in `ALKAVisuals/legend-stories-website`.
- V3 Commerce / Orders / Invoices backend and delivery work belongs to the separate V3 chat, even though it uses the same repository.
- Dashboard work belongs in `ALKAVisuals/legendmural-dashboard` and must not be mixed into this track.

## Required report after website work

Always report:

- files changed;
- whether V3-owned/protected files remained untouched;
- branch + PR;
- starting `main` SHA;
- whether `main` changed during the work;
- tests/CI result;
- exact next website step.

## Safety

Never commit secrets, customer payloads, database credentials, PayPal secrets or email-provider API keys. Never ask the owner to paste secrets into chat or GitHub documentation.
