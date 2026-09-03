# LegendMural project status — historical roadmap context

> **This file is not the operational source of truth for current website work.**
>
> For every new public-website chat, read [`READ_ME_FIRST.md`](READ_ME_FIRST.md) and then [`CURRENT_PRODUCTION_STATUS_20260903.md`](CURRENT_PRODUCTION_STATUS_20260903.md).

The older versions of this document described broader August 2026 commerce, PayPal, Neon and launch-roadmap history. That history remains available in Git history, but accumulated status statements became outdated as later storefront and V3 work landed.

## Current public website facts that remain relevant

- Netlify is the intended Production host.
- PayPal is the launch payment provider.
- Neon Postgres is authoritative order persistence.
- Browser prices, totals and paid status are not authoritative.
- Active Stripe checkout/runtime has been removed; historical schema/audit compatibility may remain where required.
- The 111-product catalogue and generated product-page architecture remain central.
- Final Netlify Production cutover is still gated by the remaining public website launch-readiness work and explicit owner approval.

## Parallel V3 workstream

A separate LegendMural V3 chat owns Commerce / Orders / Invoices backend and delivery work in this same repository. This historical project-status file does not define or reconstruct V3 progress.

Public website work must follow the scope boundary and protected-file rules in [`READ_ME_FIRST.md`](READ_ME_FIRST.md).

## Current website release order

The exact current website release order is maintained only in [`CURRENT_PRODUCTION_STATUS_20260903.md`](CURRENT_PRODUCTION_STATUS_20260903.md).

At this handoff point, the next public website step is the Privacy/AVG audit and provider/retention wording finalization. It is **not** a Production deployment.

Do not use older Sprint, Stripe, PayPal staging, V3 or dated pre-deploy documents to infer the exact current website step unless the current website handoff explicitly references them.
