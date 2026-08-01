# Sprint 2B — Complete Batch 3 Catalog

## Goal

Promote the two-product proof of concept into a complete, validated central catalog for all Batch 3 designs while keeping the current storefront pages live and unchanged.

## Central source

`data/products/2026-batch-3.json` contains exactly 20 products and preserves:

- existing product slugs and `.html` URLs;
- year and batch identity;
- category and collection as separate fields;
- current names, descriptions, prices and availability;
- current media paths, including spaces and existing capitalization;
- active publication status.

The expected product count is part of the batch metadata so accidental omissions or extra products fail validation.

## Preview generation

`npm run generate:product-previews`:

- removes stale generated preview output;
- generates one preview for every central product;
- uses one shared template;
- emits Product JSON-LD and cart-compatible data attributes;
- marks previews `noindex,nofollow` because they are development artifacts, not public pages.

Generated files remain ignored by Git.

## Catalog validation

`npm run validate:catalog` proves that:

- the catalog has schema version 1 and valid batch metadata;
- all 20 products are present exactly once;
- slugs, pages and images are unique;
- source pages and media files exist;
- category, batch, price, currency and status are valid;
- every central product matches the current live page inventory for name, description, image, price, currency, availability, category, collection and batch;
- every live Batch 3 page is represented in the central catalog;
- every generated preview contains the correct product, batch, cart and image metadata.

## Audit cleanup

HTML files inside `templates/` are no longer treated as public website pages by the repository audit. This removes template placeholders from broken-link and SEO-page reporting without hiding real storefront issues.

## Safety boundary

This sprint does not replace or visually modify a live product page. It establishes a complete and enforceable source of truth for Batch 3. A later sprint may migrate those pages to generated production markup only after structural and visual parity checks are added.

## Definition of done

- the complete pull-request quality gate passes;
- the validator reports exactly 20 Batch 3 products;
- central data and live pages have zero parity differences;
- the production Vite build remains green;
- the pull request is reviewed and squash-merged to `main`.
