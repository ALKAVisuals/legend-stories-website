# LegendMural storefront — READ ME FIRST

**Repository:** `ALKAVisuals/legend-stories-website`  
**Scope:** public LegendMural webshop only  
**Production host:** Netlify  
**Current operational status:** [`CURRENT_PRODUCTION_STATUS_20260901.md`](CURRENT_PRODUCTION_STATUS_20260901.md)

> **Every new chat working on the public website must start here.**

## Required startup order

1. Read this file.
2. Read [`CURRENT_PRODUCTION_STATUS_20260901.md`](CURRENT_PRODUCTION_STATUS_20260901.md).
3. Fresh-check the current `main` SHA before making any repository change.
4. Work one meaningful step at a time.
5. Use a branch for mutations; never write directly to `main`.
6. Inspect CI before merge.
7. Do not deploy or publish to Netlify Production without explicit owner approval for that exact release step.
8. Do not activate PayPal Live, Production email sending, V3 profile 1, production migrations or invoice issuance unless the current handoff explicitly says that gate has been reached and the owner approves it.

## Source-of-truth rule

GitHub is the source of truth. Do not reconstruct current progress from old chat history.

Older dated handoffs, sprint notes and historical Stripe/V3 documents may contain useful history, but they do **not** override the current status file linked above.

## Current release direction

The website is technically far advanced, but the final Netlify cutover is currently **paused until the remaining launch-readiness/legal consistency work is closed**.

The next implementation work is not a Production deploy. The next work is the controlled storefront cleanup described under **Exact next step** in the current status file.

## Separate workstreams

- Public website release work belongs in this repository.
- Dashboard work belongs in `ALKAVisuals/legendmural-dashboard` and must not be mixed into this track.
- V3 Gate 2 code has been merged into this repository, but profile 1 remains inactive by default. Do not continue V3 implementation merely because those files exist unless the owner explicitly changes scope.

## Safety

Never commit secrets, customer payloads, database credentials, PayPal secrets or email-provider API keys. Never ask the owner to paste secrets into chat or GitHub documentation.
