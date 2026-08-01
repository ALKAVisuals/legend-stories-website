# Sprint 2H — Batch 3 Product Page Generation

## Status

Batch 3 is the first storefront batch whose 20 live product pages are deterministic output from one shared template and central product data.

## Sources of truth

- `data/products/catalog.json` — canonical product, SEO, price, availability, media, batch and collection data
- `data/products/2026-batch-3.json` — Batch 3 membership and expected product count
- `data/products/2026-batch-3-presentation.json` — product-specific story, image alt text, comparison price, sale label and announcement copy
- `templates/product-page.html` — shared product page markup

The live root-level Batch 3 HTML files are generated artifacts. They must not be edited independently.

## Commands

- `npm run generate:batch3-pages` creates review output under `generated/product-pages/batch-3/`
- `npm run validate:batch3-pages` validates generated pages against template and catalog data
- `npm run generate:batch3-pages:live` updates the 20 live root-level Batch 3 pages
- `npm run validate:batch3-pages:live` proves the live pages are byte-identical to fresh generated output
- `npm run bootstrap:batch3-pages` is a migration/recovery utility, not the normal content-editing workflow

## Validation contract

CI blocks changes when any Batch 3 page has:

- a missing or duplicate page;
- static markup that differs from the shared template;
- a name, description, price, currency, image or availability mismatch;
- an incorrect canonical URL;
- incorrect Product JSON-LD or cart metadata;
- incorrect batch or collection metadata;
- presentation content that differs from its manifest;
- live HTML that cannot be reproduced byte-for-byte.

## Normal editing workflow

1. Change central product data, presentation data or the shared template.
2. Run generation.
3. Review the resulting diff for all affected pages.
4. Run the full quality gate.
5. Merge only when the read-only GitHub Actions run is green.

## Scope boundary

This sprint migrates only Batch 3. Batches 1, 2, 4, 5 and 6 remain existing HTML until their own parity migration is proven. Payment-provider integration, legal pages, placeholder links, media compression and domain migration are separate workstreams.
