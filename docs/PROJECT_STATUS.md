# LegendMural project status — historical roadmap context

> **This file is no longer the operational source of truth.**
>
> For every new website chat, read [`READ_ME_FIRST.md`](READ_ME_FIRST.md) and then [`CURRENT_PRODUCTION_STATUS_20260901.md`](CURRENT_PRODUCTION_STATUS_20260901.md).

The older version of this document described the broader August 2026 PayPal/Neon migration roadmap and contains valuable development history, but it accumulated status statements that became outdated as later PRs were merged and the launch-readiness/legal audit changed the release order.

The full historical content is preserved in Git history.

## Current architectural facts that remain relevant

- Netlify is the intended Production host.
- PayPal is the launch payment provider.
- Neon Postgres is authoritative order persistence.
- The browser is not authoritative for prices, totals or paid status.
- PayPal capture/webhook processing is designed for idempotent reconciliation.
- Active Stripe checkout/runtime has been removed; historical schema/audit compatibility may remain.
- The 111-product catalogue and generated product-page architecture remain central.
- V3 Gate 2 has been merged, but profile 1 remains inactive by default and Production migrations/live invoice issuance are not activated.

## Current release order

The current release order is maintained only in [`CURRENT_PRODUCTION_STATUS_20260901.md`](CURRENT_PRODUCTION_STATUS_20260901.md). At the time this redirect was written, the immediate priority is to close storefront launch-readiness/legal consistency blockers before any final Netlify Production cutover.

Do not use older Sprint, Stripe, PayPal staging or dated pre-deploy documents to infer the exact next step unless the current handoff explicitly references them.
