# LegendMural storefront — READ ME FIRST

**Repository:** `ALKAVisuals/legend-stories-website`  
**Scope:** public LegendMural webshop only  
**Production host:** Netlify  
**Current operational status:** [`CURRENT_PRODUCTION_STATUS_20260903.md`](CURRENT_PRODUCTION_STATUS_20260903.md)  
**Parallel-work coordination:** [`PARALLEL_WORKSTREAM_COORDINATION.md`](PARALLEL_WORKSTREAM_COORDINATION.md)

> **Every new chat working on the public website must start here.**

## Required startup order

1. Read this file.
2. Read [`CURRENT_PRODUCTION_STATUS_20260903.md`](CURRENT_PRODUCTION_STATUS_20260903.md).
3. Read [`PARALLEL_WORKSTREAM_COORDINATION.md`](PARALLEL_WORKSTREAM_COORDINATION.md).
4. Fresh-check the current `main` SHA before making any repository change.
5. Determine whether the requested work belongs to the public website workstream or the separate V3 Commerce / Orders / Invoices workstream.
6. Work one meaningful step at a time.
7. Use a branch for mutations; never write website implementation directly to `main`.
8. Inspect CI before merge.
9. Re-check whether `main` moved before merging because the separate V3 workstream may also have merged non-overlapping changes.
10. Do not deploy or publish to Netlify Production without explicit owner approval for that exact release step.
11. Do not activate PayPal Live, Production email sending, V3 profile 1, production migrations or invoice issuance unless the relevant current handoff says that gate has been reached and the owner explicitly approves it.

## Source-of-truth rule

GitHub is the source of truth. Do not reconstruct current progress from old chat history.

Older dated handoffs, sprint notes and historical Stripe/V3 documents may contain useful history, but they do **not** override the current status file linked above or the parallel-workstream coordination contract.

## Current release direction

The website is technically far advanced, but the final Netlify cutover is currently **paused until the remaining launch-readiness/legal consistency work is closed**.

The next public-website implementation work is not a Production deploy. Follow the **Exact next step** in the current production-status handoff.

## Separate workstreams

Two legitimate workstreams may share this repository:

- **Public website / launch-readiness:** UI, content, legal/privacy, GPSR/product-safety presentation, SEO/final-domain metadata and other customer-facing launch work.
- **V3 Commerce / Orders / Invoices:** commerce backend, invoice lifecycle, immutable snapshots, V3 notification/delivery persistence, PDF/email delivery, claim/retry semantics and later V3 cutover.

The exact ownership boundaries and V3-reserved files are mandatory in [`PARALLEL_WORKSTREAM_COORDINATION.md`](PARALLEL_WORKSTREAM_COORDINATION.md).

A public-website chat must not modify V3-reserved commerce/invoice/delivery code merely because it is in the same repository. If a website task appears to require a reserved file or responsibility, stop and coordinate first.

Dashboard and canonical V3 handoff work belongs in `ALKAVisuals/legendmural-dashboard`; do not reconstruct V3 progress from this storefront handoff.

## Safety

Never commit secrets, customer payloads, database credentials, PayPal secrets or email-provider API keys. Never ask the owner to paste secrets into chat or GitHub documentation.
