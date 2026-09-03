# LegendMural storefront

Public LegendMural e-commerce storefront for matte vinyl wall stickers. The repository contains the storefront, central product data, generated product pages, server-authoritative commerce, Neon Postgres order persistence and Netlify Functions for the PayPal/order flow.

> **New website chat / continuation:** read [`docs/READ_ME_FIRST.md`](docs/READ_ME_FIRST.md) first. The current public-website handoff is [`docs/CURRENT_PRODUCTION_STATUS_20260903.md`](docs/CURRENT_PRODUCTION_STATUS_20260903.md). GitHub is the source of truth.

## Current public website launch state — 3 September 2026

- **Production host:** Netlify.
- **Canonical intended origin:** `https://legendmural.com`.
- **Launch payment provider:** PayPal-only.
- **Order database:** Neon Postgres.
- **Product catalogue:** 111 products / 6 batches.
- **Website-track starting `main` checkpoint:** `c6ee0faf357e4943b4ddc0e92335748c20c00c99`.
- **Netlify Production:** final release not yet intentionally cut over and approved.
- **PayPal Live / Production email:** not part of the current website step.
- **Current overall public website launch-readiness estimate:** about **80%**.

The next website work is **not** a Production deployment. The exact next step is the Privacy/AVG audit defined in the current handoff.

## Parallel V3 workstream

A separate LegendMural V3 chat works in this same repository on Commerce / Orders / Invoices backend and delivery work. This public-website track does not reconstruct or own V3 status.

Without explicit cross-track approval, website work must not modify:

- `server/invoices/**`;
- `server/notifications/**`;
- `server/adapters/neon-order-notification-store.mjs`;
- V3 invoice/notification Neon adapters;
- paid-order finalizer code;
- PayPal capture/webhook reconciliation code;
- Profile-0/Profile-1 routing;
- V3 invoice snapshot/PDF/Resend/retry code;
- V3 order/invoice/notification migrations.

See `docs/READ_ME_FIRST.md` for the full working boundary.

## Current readiness summary

| Area | Readiness |
|---|---:|
| Storefront UI/content core | 96% |
| Company/legal information pages | 90% |
| Privacy / AVG | 80% |
| Cookies / tracking | 90% |
| Returns / statutory withdrawal | 95% |
| Checkout / payment-law presentation | 55% |
| Pricing / shipping / commercial-claim consistency | 95% |
| GPSR / product-safety presentation | 40% |
| Final-domain metadata / SEO | 50% |
| Netlify Production cutover | 0% |
| Controlled Live proof | 0% |

These are internal project-tracking estimates, not legal certification.

## Completed website work

The public website track has already completed or substantially proven:

- 111-product catalogue and generated product-page architecture;
- central public product/variant presentation;
- mobile navigation fix and real iPhone Safari confirmation;
- mobile checkout/WebKit regression coverage;
- About page redesign;
- Company, Terms, Privacy, Shipping and Returns baselines;
- statutory 14-day withdrawal information;
- model withdrawal form;
- dedicated online withdrawal function;
- public pricing/shipping/delivery/returns consistency cleanup via PR #159.

Current public launch rules include:

- **Compact:** €35 incl. VAT;
- **Statement:** €45 incl. VAT;
- **LEGEND10:** 10% discount;
- **Netherlands:** €4.95 shipping;
- **EU:** €9.95 shipping;
- **United States:** €9.95 tracked shipping;
- **free shipping:** from €69 after discount;
- no unsupported fixed `2–4 day` marketing delivery promise;
- no conflicting `30-day return` marketing promise.

## Remaining public website launch gates

Before final Production release, the website track still needs to:

1. finalize Privacy/AVG retention and provider wording;
2. resolve the consumer-facing checkout/payment-obligation and Dutch advance-payment presentation questions without modifying V3-owned backend code;
3. add centralized GPSR/product-safety/manufacturer information;
4. obtain the owner’s separate commercial rights/IP confirmation;
5. replace remaining preview/GitHub Pages canonical/Open Graph references with correct `legendmural.com` handling;
6. run the final relevant website quality/CI gates and freeze an exact release SHA.

Only after those gates and explicit owner approval may the final Netlify Production cutover proceed.

## Exact next website step

> **Perform a read-only audit of the current Privacy page and actual public storefront/runtime provider usage, then define the smallest required Privacy/AVG wording changes.**

Do not change checkout/payment flow, V3 commerce backend, invoice delivery or Production settings during that step.

## Architecture decisions

- Netlify is the intended Production host.
- PayPal is the launch payment provider.
- Neon Postgres is authoritative order persistence.
- Browser prices, totals and payment state are never authoritative.
- A browser URL/session state cannot manufacture `paid`.
- Active Stripe checkout/runtime has been removed; historical compatibility may remain where required.

## Payment/order flow

```text
Browser
  ↓
Netlify Function
  ↓
server-authoritative quote
  ↓
Neon pending order
  ↓
PayPal order / approval
  ↓
capture and/or verified webhook reconciliation
  ↓
Neon authoritative paid state
  ↓
order-status / confirmed return experience
```

Current public API routes include:

- `/api/paypal/checkout`;
- `/api/paypal/capture`;
- `/api/paypal/webhook`;
- `/api/order-status`.

Current `netlify.toml` build contract:

- build: `npm run build && node scripts/generate-commerce-runtime-config.mjs`;
- publish: `dist`;
- functions: `netlify/functions`;
- Node.js 22 on Netlify.

## Development commands

```bash
npm ci
npm run dev
npm test
npm run build
npm run quality
```

Prefer current repository scripts and CI workflows over commands copied from historical handoffs.

## Project structure

```text
.
├── data/                 # Central product/catalogue data
├── docs/                 # Current website handoff, architecture and historical context
├── generated/            # Generated public/runtime assets
├── js/                   # Browser runtime and commerce modules
├── media/                # Storefront/product media
├── netlify/functions/    # Serverless entrypoints
├── server/               # Authoritative commerce/order/payment/runtime logic
├── scripts/              # Generators, audits and validators
├── templates/            # Shared generated product-page templates
├── tests/                # Unit/contract/regression tests
├── *.html                # Storefront pages and generated product pages
├── netlify.toml
├── package.json
└── vite.config.mjs
```

## Documentation hierarchy for public website work

1. [`docs/READ_ME_FIRST.md`](docs/READ_ME_FIRST.md) — scope, parallel-work boundary and working rules;
2. [`docs/CURRENT_PRODUCTION_STATUS_20260903.md`](docs/CURRENT_PRODUCTION_STATUS_20260903.md) — exact website progress, blockers, percentages and next step;
3. [`docs/PROJECT_STATUS.md`](docs/PROJECT_STATUS.md) — broader historical architecture context;
4. architecture/testing documents only as needed for the current website step.

The separate V3 chat maintains its own V3 handoff. Do not use this website README as a V3 source of truth.

## Safety rules

- Never commit or expose secrets, database URLs, PayPal secrets, email-provider API keys or customer payloads.
- Fresh-check `main` before every new website branch and again immediately before merge.
- Use a website-specific branch; never write directly to `main`.
- If `main` changed due to parallel V3 work, compare/rebase and rerun relevant CI before merge.
- Do not hand-edit generated product pages when the generator/template is authoritative.
- Do not activate PayPal Live, Production order emails, V3 Profile 1, production migrations or invoice issuance from the website track.
- Do not update Netlify Production without explicit owner approval for that exact release step.

## License

© 2026 LegendMural / ALKAVisuals. All rights reserved.
