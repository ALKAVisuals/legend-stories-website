# Sprint 1C–1F — Scalable Storefront Foundation

## Definition of done

Sprint 1 established safe boundaries, repeatable audits and validated proofs of concept. It did not replace all 118 live HTML pages or rewrite the current cart UI. Those production migrations belong to Sprint 2.

## Sprint 1C — JavaScript boundaries

- pure pricing and shipping modules;
- deterministic unit tests;
- commerce tests in the GitHub quality gate;
- the existing `js/app.js` remains the compatibility runtime until incremental migration.

Browser calculations remain display estimates. A future payment backend must validate prices, discounts, shipping and totals.

## Sprint 1D — CSS ownership

- `config/style-ownership.json` defines ownership boundaries;
- `scripts/css-audit.mjs` reports stylesheet size and repeated selectors;
- no visual CSS is removed without screenshot or deploy-preview evidence.

## Sprint 1E — Batch-aware product proof of concept

At Sprint 1 completion:

- two real Batch 3 products were represented as structured data;
- batch metadata remained separate from category and collection;
- one shared static template generated proof-of-concept pages;
- schema, source pages, media paths and generated output were validated;
- existing live pages, URLs and batch media paths remained unchanged.

Sprint 2B promoted this proof of concept into the complete 20-product Batch 3 catalog. The current implementation is documented in `docs/SPRINT-2B-BATCH3-CATALOG.md`.

## Sprint 1F — Media observability and budgets

- media budgets and warning thresholds;
- repeatable human-readable and JSON inventories;
- source artwork remains separate from future web derivatives;
- batch/year metadata is preserved;
- no source artwork is moved or overwritten.

## Current full quality gate

`npm run quality` performs:

1. repository link, metadata and file audit;
2. CSS audit;
3. media inventory;
4. complete product-page inventory and cart parity checks;
5. Batch 3 preview generation;
6. central Batch 3 catalog and live-page parity validation;
7. commerce and parser unit tests;
8. production build and output validation.

GitHub Actions runs this command on every pull request to `main` and every push to `main`. A pull request is not merged until the latest-head gate is green.

## Remaining Sprint 2 boundary

The following remain Sprint 2 work:

- replacing live product pages with generated pages after structural and visual parity testing;
- wiring the pure commerce modules into the live cart runtime;
- consolidating CSS with visual regression evidence;
- generating and deploying optimized image/video derivatives;
- removing placeholder links and the documented `portfolio.html` baseline exception.
