# Sprint 2E — Runtime Product Registry

## Goal

Remove the second hand-maintained product database from `js/app.js` and make the validated product inventory authoritative for browser features such as the related-products carousel.

## Problem removed

The legacy runtime contained a `PRODUCTS` array with 111 manually maintained records. Those records duplicated page, product, collection and media information already present in the live product pages. This duplication had already produced incorrect hard-coded routes and made every product addition require edits in several places.

Sprint 2E removes that array completely.

## Generated runtime registry

`npm run generate:runtime-products` builds:

`generated/public/data/product-registry.json`

The registry is generated from the complete product inventory and contains:

- slug;
- page;
- product name;
- image path;
- category;
- collection;
- batch identifier.

Products are sorted by page for deterministic output. Vite serves the generated file as `data/product-registry.json` in development and production.

## Validation

`npm run validate:runtime-products` proves:

- schema version and product count are correct;
- all 111 products match the source inventory exactly;
- pages, slugs and images are unique;
- ordering is deterministic;
- no inventory product is missing.

`npm run validate:related-products` additionally blocks:

- a new hard-coded `PRODUCTS` array in `app.js`;
- removal of the dynamic catalog-module import;
- bypassing the generated registry;
- missing catalog-module exports;
- an absent or incomplete generated registry.

## First browser module

`js/catalog/related-products.mjs` is the first focused browser module in the runtime migration. It provides:

- registry URL resolution relative to the current document;
- same-origin registry loading with request caching;
- current-product resolution by page before product name;
- related-product selection by collection;
- cache reset support for tests.

Page-first resolution avoids ambiguity for products sharing a name in different collections.

## Compatibility runtime

`js/app.js` remains the classic compatibility entry for now. Its related-products initializer dynamically imports the catalog module and retains the existing carousel classes, arrow controls, smooth scrolling and auto-scroll behavior.

This reduces architectural duplication without converting all 118 pages to modules in one risky change.

## Build integration

- `predev` generates the registry before the Vite development server starts;
- the production build generates the registry before Vite runs;
- Vite copies generated public data into `dist/data/`;
- the browser runtime copy step includes `.js` and `.mjs` files;
- production output validation verifies the registry and module exports;
- build validation now writes Markdown and JSON reports for diagnosable CI failures.

## Verified scope

The quality gate validates:

- 111 runtime products across all six batches;
- complete Batch 3 parity for 20 products;
- catalog module behavior through unit tests;
- generated runtime authority through anti-regression checks;
- 118 production HTML pages;
- the registry and catalog module in the final build output.

## Safety boundary

This sprint does not change product prices, product URLs, batch folders, media paths, cart calculations or checkout rules. Related-product markup and interaction remain visually compatible with the previous implementation.

## Next runtime work

The remaining compatibility baseline is still measurable through `npm run audit:runtime`:

- classic script references;
- inline executable scripts;
- inline event handlers;
- script-order variants.

Future runtime sprints should migrate one responsibility at a time while reducing those counts and preserving the global contracts required by the current pages.
