# Sprint 2A — Catalog Inventory and Parity Gate

## Goal

Create a trustworthy bridge from the current hand-authored product pages to a batch-aware central product catalog without replacing live pages before parity is proven.

## Why this comes first

Each current product page contains several independently editable copies of the same product facts:

- Product JSON-LD;
- visible H1 and product content;
- add-to-cart button attributes;
- canonical and offer URLs;
- image and batch folder paths.

A direct template migration would be unsafe while these sources can silently drift. Sprint 2A makes that drift measurable.

## Added

- `scripts/product-inventory.mjs` scans all root HTML pages;
- product pages are identified through Product JSON-LD rather than filename assumptions;
- legacy absolute GitHub Pages media URLs are normalized to repository paths;
- year, batch, collection and category are derived from the existing media path without moving assets;
- visible H1, Product JSON-LD and cart attributes are compared;
- referenced product images must exist in the repository;
- JSON and Markdown reports are generated in `reports/`;
- parser behavior is covered by unit tests;
- the inventory runs in the existing `npm run quality` gate.

## Hard failures

The quality gate fails when a detected product page has:

- no product name, image, valid price or H1;
- a cart name, price or image that differs from Product JSON-LD;
- a missing product image;
- no detectable Product pages at all.

Differences that are important but not automatically unsafe, such as H1 wording or an unclassified legacy media path, are reported as warnings.

## Preserved

- all current product URLs;
- all current live HTML pages;
- existing year and batch folder names;
- current cart runtime;
- current storefront styling.

## Exit criterion

Sprint 2A is complete when the pull-request quality gate passes and the generated inventory gives us a complete, machine-readable baseline for the next batch migration.
