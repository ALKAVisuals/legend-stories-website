# LegendMural storefront

Public LegendMural e-commerce storefront for matte vinyl wall stickers. The repository contains the storefront, central product data, generated product pages, server-authoritative commerce, Neon Postgres order persistence and Netlify Functions for the PayPal/order flow.

> **New chat / continuation:** read [`docs/READ_ME_FIRST.md`](docs/READ_ME_FIRST.md) first. The current operational handoff is [`docs/CURRENT_PRODUCTION_STATUS_20260901.md`](docs/CURRENT_PRODUCTION_STATUS_20260901.md). GitHub is the source of truth; older chat history and dated handoffs do not override those files.

## Current launch state — 1 September 2026

- **Production host:** Netlify.
- **Canonical intended origin:** `https://legendmural.com`.
- **Launch payment provider:** PayPal-only.
- **Order database:** Neon Postgres.
- **Product catalogue:** 111 products / 6 batches.
- **Current `main` at the latest documented handoff:** `39345bba9c1196ea68bad9c2a83f3aed5c1b3d8e`.
- **PR #153:** merged; V3 Gate 2 foundation is present, but profile 1 remains inactive by default and production migrations/live invoice issuance are not activated.
- **Netlify Production:** final current release not yet intentionally cut over and approved.
- **PayPal Live:** not yet proven for this final release.
- **Production order emails:** reserved for the controlled final proof.
- **Current overall internal launch-readiness estimate:** about **74%**.

The next work is **not** a Production deployment. First close the remaining launch-readiness/legal consistency blockers described in the current status handoff.

## Current readiness summary

| Area | Readiness |
|---|---:|
| Storefront UI/content core | 95% |
| Commerce backend / PayPal / Neon pre-production architecture | 95% |
| Company/legal information pages | 90% |
| Privacy / AVG | 80% |
| Cookies / tracking | 90% |
| Returns / statutory withdrawal | 95% |
| Checkout / payment-law readiness | 55% |
| Pricing / shipping / commercial-claim consistency | 35% |
| GPSR / product-safety presentation | 40% |
| Netlify Production cutover | 0% |
| Controlled PayPal Live + email proof | 0% |

These are internal project-tracking estimates, not legal certification.

## Exact next step

Create a focused storefront branch/PR that fixes only the known inconsistent public pricing, shipping, delivery and returns claims. In particular, make the public storefront consistent with the authoritative launch rules:

- Compact: €35;
- Statement: €45;
- free shipping from €69 after discount;
- NL shipping €4.95;
- EU shipping €9.95;
- US shipping €9.95 tracked;
- no unsupported fixed 2–4 day delivery promise;
- no conflicting 30-day return promise against the statutory withdrawal flow.

After that: test, review, update the readiness handoff, merge only with owner approval, then continue to privacy/checkout legal finalization and GPSR.

## Architecture decisions

- Netlify is the only intended Production host.
- PayPal is the launch payment provider.
- Neon Postgres is authoritative order persistence.
- Browser prices, totals and payment state are never authoritative.
- Capture/webhook paths are designed to reconcile safely and idempotently.
- A browser URL/session state cannot manufacture `paid`.
- Active Stripe checkout/runtime has been removed; historical database/audit compatibility may remain where required.
- V3 Gate 2 code is merged but its profile-1 runtime is inactive by default.

## Commerce rules

Current launch catalogue rules:

- **Compact:** 30 cm longest side — **€35 incl. VAT**;
- **Statement:** 45 cm longest side — **€45 incl. VAT**;
- **LEGEND10:** 10% discount;
- **Netherlands:** €4.95 shipping;
- **EU:** €9.95 shipping;
- **United States:** €9.95 tracked shipping;
- **free shipping:** from €69 after discount;
- unsupported destinations are blocked.

The central/server-side commerce model is authoritative. Public marketing copy must match it exactly.

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

## What has already been proven

The project has extensive pre-production evidence, including:

- server-authoritative pricing/order creation;
- PayPal Sandbox create/approval/capture;
- isolated Neon order persistence;
- verified PayPal webhook processing;
- duplicate/retry idempotency;
- capture-vs-webhook convergence;
- browser return to server-authoritative paid confirmation;
- mobile/WebKit checkout regression coverage;
- real iPhone Safari mobile navigation confirmation;
- current Company, Terms, Privacy, Shipping and Returns baselines;
- an online statutory withdrawal function;
- relevant release CI and quality gates from earlier release work;
- V3 Gate 2 isolated finalizer/convergence proof while profile 1 remains off.

Do not repeat solved investigations without new regression evidence.

## Remaining launch gates

Before the final Netlify cutover:

1. fix conflicting pricing/shipping/delivery/returns copy;
2. finalize privacy retention wording and actual provider disclosures;
3. resolve checkout/payment-obligation and Dutch advance-payment compliance;
4. add centralized GPSR/product-safety/manufacturer information;
5. owner confirms required commercial IP/portrait/trademark rights outside the repository;
6. replace remaining GitHub Pages canonical/Open Graph production URLs with `legendmural.com` handling;
7. run the full relevant quality/CI gates;
8. freeze a new exact release SHA.

Then:

9. perform exactly one controlled Netlify Production cutover;
10. run safe Production smoke tests without a real payment first;
11. only after Production approval, perform exactly one controlled PayPal Live order and verify Neon, webhook/capture, emails, no duplicates and funds received.

## Development commands

```bash
npm ci
npm run dev
npm test
npm run build
npm run quality
```

Useful targeted validation commands are defined in `package.json` and the current CI workflows. Prefer the repository’s current scripts over commands copied from historical documentation.

## Project structure

```text
.
├── data/                 # Central product/catalogue data
├── docs/                 # Current handoff, architecture and historical context
├── generated/            # Generated public/runtime assets
├── js/                   # Browser runtime and commerce modules
├── media/                # Storefront/product media
├── netlify/functions/    # PayPal, order-status and related serverless entrypoints
├── server/               # Authoritative commerce/order/payment/runtime logic
├── scripts/              # Generators, audits and validators
├── templates/            # Shared generated product-page templates
├── tests/                # Unit/contract/regression tests
├── *.html                # Storefront pages and generated product pages
├── netlify.toml
├── package.json
└── vite.config.mjs
```

## Documentation hierarchy

Use this order when continuing work:

1. [`docs/READ_ME_FIRST.md`](docs/READ_ME_FIRST.md) — stable entrypoint and working rules;
2. [`docs/CURRENT_PRODUCTION_STATUS_20260901.md`](docs/CURRENT_PRODUCTION_STATUS_20260901.md) — exact current progress, blockers, percentages and next step;
3. [`docs/PROJECT_STATUS.md`](docs/PROJECT_STATUS.md) — broader historical/architectural roadmap context;
4. architecture/testing documents only as needed for the current step.

Older dated release handoffs are historical snapshots unless the current status file explicitly points to them.

## Safety rules

- Never commit or expose secrets, database URLs, PayPal secrets, email-provider API keys or customer payloads.
- Use a branch for repository mutations; never write directly to `main`.
- Inspect CI before merge.
- Do not hand-edit generated product pages when the generator/template is authoritative.
- Do not activate PayPal Live, Production order emails, V3 profile 1, production migrations or invoice issuance early.
- Do not update Netlify Production without explicit owner approval for the exact release step.
- Keep dashboard work out of this repository release track unless the owner explicitly changes scope.

## License

© 2026 LegendMural / ALKAVisuals. All rights reserved.
