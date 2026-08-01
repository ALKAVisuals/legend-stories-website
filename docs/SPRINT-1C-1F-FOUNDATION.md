# Sprint 1C–1F — Scalable Storefront Foundation

## Definition of done

Sprint 1 establishes safe boundaries, repeatable audits and validated proofs of concept. It does not yet replace all 118 live HTML pages or rewrite the current cart UI. Those production migrations belong to Sprint 2 and will use the foundations introduced here.

## Sprint 1C — JavaScript boundaries

### Added

- pure pricing functions in `js/commerce/pricing.mjs`;
- pure shipping functions in `js/commerce/shipping.mjs`;
- deterministic unit tests using Node's built-in test runner;
- commerce tests added to the GitHub quality gate.

### Boundary

The existing `js/app.js` remains the compatibility runtime for the live storefront. Migrating its DOM rendering and state management in one large change would create unnecessary checkout risk. Sprint 2 can now extract behavior incrementally against tested pure rules.

### Security note

Browser calculations remain display estimates. A future payment or commerce backend must authoritatively validate product prices, discounts, shipping and final totals before payment.

## Sprint 1D — CSS ownership

### Added

- `config/style-ownership.json` defines which layer owns tokens, utilities, components and effects;
- `scripts/css-audit.mjs` reports stylesheet size and repeated selectors;
- the quality gate generates a CSS audit artifact.

### Boundary

No visual CSS consolidation is performed without screenshot or deploy-preview comparison. Existing patch styles remain visible technical debt, but new patch stylesheets and Tailwind-like custom utilities are prohibited.

## Sprint 1E — Batch-aware product generation proof of concept

### Added

- `data/products/2026-batch-3-poc.json` with two real products from batch 3;
- batch metadata kept separate from category and collection metadata;
- `templates/product-poc.html` as a shared static template;
- `scripts/generate-product-poc.mjs` to generate pages from product data;
- `scripts/validate-products.mjs` to validate schema, prices, source pages, media paths and generated output.

### Preserved

- existing year and batch organization;
- existing media paths, including current capitalization and spaces;
- existing live product pages and URLs.

### Boundary

The generated proof-of-concept pages are written to ignored `generated/` output and do not replace production pages. Sprint 2 will compare full visual and functional parity before migrating any live batch.

## Sprint 1F — Media observability and budgets

### Added

- `config/media-budgets.json` with delivery targets and repository warning thresholds;
- `scripts/media-audit.mjs` with human-readable and JSON reports;
- reporting by media type, total size and largest files;
- policy requiring source assets to remain separate from web derivatives;
- policy preserving batch/year metadata.

### Boundary

No source artwork or batch folder is moved or overwritten. Actual AVIF/WebP/video derivative generation is deferred until the production media pipeline is designed and visual quality can be compared.

## Full quality gate

`npm run quality` now performs:

1. repository link, metadata and file audit;
2. CSS ownership audit;
3. media inventory and budget report;
4. product proof-of-concept generation;
5. product-data and generated-output validation;
6. commerce unit tests;
7. production build and output validation.

GitHub Actions runs this command on every pull request to `main` and uploads the reports as artifacts. A pull request is not merged until this gate has completed successfully on its latest head commit.

## Sprint 1 exit criteria

Sprint 1 is complete when:

- Sprint 1A audit tooling is in `main`;
- Sprint 1B build validation is in `main`;
- this branch's full quality gate is green;
- the 1C–1F pull request is merged;
- all remaining production migrations are explicitly tracked as Sprint 2 work rather than implied to be complete.
