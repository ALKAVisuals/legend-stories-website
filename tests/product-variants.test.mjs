import assert from 'node:assert/strict';
import test from 'node:test';
import { createCartLineId, createProductSku, DEFAULT_PRODUCT_VARIANT_ID, PRODUCT_VARIANTS, resolveCatalogProductVariant, resolveProductVariant } from '../js/commerce/product-variants.mjs';

test('product variant policy exposes the approved production sizes and prices', () => {
  assert.equal(DEFAULT_PRODUCT_VARIANT_ID, 'statement-45');
  assert.deepEqual(
    PRODUCT_VARIANTS.map(({ id, sizeLabel, widthCm, heightCm, price, isDefault }) => ({ id, sizeLabel, widthCm, heightCm, price, isDefault })),
    [
      { id: 'statement-45', sizeLabel: '45 cm', widthCm: 45, heightCm: 45, price: 45, isDefault: true },
      { id: 'compact-30', sizeLabel: '30 cm', widthCm: 30, heightCm: 30, price: 35, isDefault: false },
    ],
  );
});

test('variant resolution supports current ids and safely migrates old ids', () => {
  assert.equal(resolveProductVariant('compact-30').price, 35);
  assert.equal(resolveProductVariant('statement-45').price, 45);
  assert.equal(resolveProductVariant('compact-50x30').id, 'compact-30');
  assert.equal(resolveProductVariant('statement-50x50').id, 'statement-45');
  assert.throws(() => resolveProductVariant('giant-90'), /Unknown product variant/);
});

test('catalog variants control authoritative pricing and sku creation', () => {
  const product = { slug: 'legend-example', price: 999, defaultVariantId: 'statement-45', variants: PRODUCT_VARIANTS };
  const compact = resolveCatalogProductVariant(product, 'compact-30');
  assert.equal(compact.price, 35);
  assert.equal(createProductSku(product, compact), 'legend-example-30cm');
  assert.equal(createCartLineId('legend-example.html', compact.id), 'legend-example.html::compact-30');
});

test('legacy catalog fixtures remain quote-compatible', () => {
  const legacy = resolveCatalogProductVariant({ price: 49.95 });
  assert.equal(legacy.id, 'legacy');
  assert.equal(legacy.price, 49.95);
});
