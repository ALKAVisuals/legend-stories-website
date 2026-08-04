import assert from 'node:assert/strict';
import test from 'node:test';
import { createCartLineId, createProductSku, DEFAULT_PRODUCT_VARIANT_ID, PRODUCT_VARIANTS, resolveCatalogProductVariant, resolveProductVariant } from '../js/commerce/product-variants.mjs';

test('product variant policy exposes the approved production boxes and prices', () => {
  assert.equal(DEFAULT_PRODUCT_VARIANT_ID, 'statement-50x50');
  assert.deepEqual(
    PRODUCT_VARIANTS.map(({ id, sizeLabel, widthCm, heightCm, price, isDefault }) => ({ id, sizeLabel, widthCm, heightCm, price, isDefault })),
    [
      { id: 'statement-50x50', sizeLabel: '50 × 50 cm', widthCm: 50, heightCm: 50, price: 45, isDefault: true },
      { id: 'compact-50x30', sizeLabel: '50 × 30 cm', widthCm: 50, heightCm: 30, price: 35, isDefault: false },
    ],
  );
});

test('variant resolution supports current ids and safely migrates old ids', () => {
  assert.equal(resolveProductVariant('compact-50x30').price, 35);
  assert.equal(resolveProductVariant('statement-50x50').price, 45);
  assert.equal(resolveProductVariant('compact-30').id, 'compact-50x30');
  assert.equal(resolveProductVariant('statement-45').id, 'statement-50x50');
  assert.throws(() => resolveProductVariant('giant-90'), /Unknown product variant/);
});

test('catalog variants control authoritative pricing and sku creation', () => {
  const product = { slug: 'legend-example', price: 999, defaultVariantId: 'statement-50x50', variants: PRODUCT_VARIANTS };
  const compact = resolveCatalogProductVariant(product, 'compact-50x30');
  assert.equal(compact.price, 35);
  assert.equal(createProductSku(product, compact), 'legend-example-50x30');
  assert.equal(createCartLineId('legend-example.html', compact.id), 'legend-example.html::compact-50x30');
});

test('legacy catalog fixtures remain quote-compatible', () => {
  const legacy = resolveCatalogProductVariant({ price: 49.95 });
  assert.equal(legacy.id, 'legacy');
  assert.equal(legacy.price, 49.95);
});
