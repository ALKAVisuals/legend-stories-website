# Sprint 1C–1F — Scalable Storefront Foundation

## Definition of done

Sprint 1 establishes safe boundaries, repeatable audits and validated proofs of concept. It does not yet replace all 118 live HTML pages or rewrite the current cart UI. Those production migrations belong to Sprint 2.

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

- two real batch-3 products represented as structured data;
- batch metadata remains separate from category and collection;
- one shared static template generates proof-of-concept pages;
- schema, source pages, media paths and generated output are validated;
- existing live pages, URLs and batch media paths remain unchanged.

## Sprint 1F — Media observability and budgets

- media budgets and warning thresholds;
- repeatable human-readable and JSON inventories;
- source artwork remains separate from future web derivatives;
- batch/year metadata is preserved;
- no source artwork is moved or overwritten.

## Full quality gate

`npm run quality` performs:

1. repository link, metadata and file audit;
2. CSS audit;
3. media inventory;
4. product POC generation;
5. product-data and generated-output validation;
6. commerce unit tests;
7. production build and output validation.

GitHub Actions runs this command on every pull request to `main`. A pull request is not merged until the latest-head gate is green.

## Sprint 2 boundary

The following are intentionally Sprint 2 work:

- replacing live product pages with generated pages after parity testing;
- wiring the pure commerce modules into the live cart runtime;
- consolidating CSS with visual regression evidence;
- generating and deploying optimized image/video derivatives;
- removing placeholder links and the documented `portfolio.html` baseline exception.
