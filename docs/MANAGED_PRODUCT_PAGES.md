# Managed Product Pages

LegendMural product pages are generated from one shared template and central data. Generator-managed root HTML files are build output and must not be edited by hand.

## Sources of truth

The page generator uses these sources in this order:

1. `data/products/catalog.json`
   - product name
   - description and SEO metadata
   - canonical URL
   - image path
   - price, currency and availability
   - category, collection and batch metadata
2. `data/products/<batch-id>-presentation.json`
   - product story
   - image alt text
   - comparison price
   - discount label
   - announcement copy
3. `templates/product-page.html`
   - shared HTML structure
   - navigation, product detail, cart and checkout markup
   - footer and fixed actions
4. `data/products/managed-page-batches.json`
   - batches currently owned by the generator
   - expected product counts
   - presentation files and generated output directories

A generated root product page is never an independent source of truth.

## Current managed scope

- `2026-batch-2`: 20 pages
- `2026-batch-3`: 20 pages
- `2026-batch-4`: 19 pages
- `2026-batch-5`: 20 pages
- `2026-batch-6`: 12 pages
- Total: 91 live generated product pages

Batch 1 is audited as compatible but stays unmanaged until its presentation manifest and live migration complete the same guarded process.

## Normal commands

Generate previews for every managed batch:

```bash
npm run generate:managed-product-pages
```

Validate generated previews:

```bash
npm run validate:managed-product-pages
```

Prove that every managed live page is byte-identical to a fresh generation:

```bash
npm run validate:managed-product-pages:live
```

The compatibility audit covers all 111 product pages:

```bash
npm run audit:product-page-templates
```

Legacy Batch 3 commands remain as compatibility aliases and use the same generic implementation.

## Editing an existing managed product

1. Edit product and SEO fields in `data/products/catalog.json`.
2. Edit story, alt text or promotion copy in the matching presentation manifest.
3. Edit shared markup only in `templates/product-page.html`.
4. Generate the managed pages.
5. Run the managed-page validator and the complete quality gate.
6. Commit both the source change and generated root HTML output.

Do not fix an individual managed root HTML page. CI will reject manual drift because the file will no longer match deterministic generated output.

## Adding another batch

Use this sequence for every migration:

1. Confirm the full catalog contains the expected pages and batch metadata.
2. Run the all-page compatibility audit.
3. Bootstrap a presentation manifest from the current live pages:

```bash
npm run bootstrap:product-page-batch -- --batch=2026-batch-X --expected=<count>
```

For a legacy batch with copied alt text or announcement copy, use the explicit normalization flag after reviewing the affected fields:

```bash
npm run bootstrap:product-page-batch -- --batch=2026-batch-X --expected=<count> --normalize-legacy-presentation
```

4. Review the complete presentation manifest. Extraction is not approval; old copied content can be faithfully extracted and still be wrong.
5. Add the batch to `managed-page-batches.json`.
6. Generate and validate previews without changing live pages.
7. Migrate only that batch to live output after preview parity, catalog validation, tests and production build are green.
8. Restore GitHub Actions to read-only permissions immediately after any temporary migration run.
9. Run one final read-only quality gate and require live byte identity before merge.

## Safety rules

- Never change price, shipping, discount or checkout calculations as part of a page-template migration.
- Never rename product URLs or media files during migration.
- Never treat a successful parser extraction as proof that legacy copy is correct.
- Keep temporary CI write access branch-scoped, minimal and short-lived.
- Stage live migration files from the catalog batch selection rather than a manually maintained filename list.
- Merge only after the final workflow runs with `contents: read` and every quality step succeeds.
