import test from 'node:test';
import assert from 'node:assert/strict';

import {
  clearProductRegistryCache,
  findCurrentProduct,
  loadProductRegistry,
  registryUrl,
  selectRelatedProducts,
} from '../js/catalog/related-products.mjs';

const products = [
  { page: 'music-first.html', name: 'First', collection: 'Music Legends' },
  { page: 'music-second.html', name: 'Second', collection: 'Music Legends' },
  { page: 'music-third.html', name: 'Third', collection: 'Music Legends' },
  { page: 'sport-first.html', name: 'First', collection: 'Sport Legends' },
];

test('finds the current product by page before duplicate name', () => {
  const current = findCurrentProduct(products, { page: 'sport-first.html', name: 'First' });
  assert.equal(current.page, 'sport-first.html');
});

test('falls back to product name when a page is unavailable', () => {
  const current = findCurrentProduct(products, { page: 'unknown.html', name: 'Second' });
  assert.equal(current.page, 'music-second.html');
});

test('selects only other products from the same collection', () => {
  const related = selectRelatedProducts(products, products[0]);
  assert.deepEqual(related.map((product) => product.page), [
    'music-second.html',
    'music-third.html',
  ]);
});

test('applies a deterministic related-product limit', () => {
  const related = selectRelatedProducts(products, products[0], 1);
  assert.deepEqual(related.map((product) => product.page), ['music-second.html']);
});

test('resolves the registry relative to the current document', () => {
  assert.equal(
    registryUrl('https://example.com/store/music-first.html'),
    'https://example.com/store/data/product-registry.json',
  );
});

test('loads and caches a valid product registry', async () => {
  clearProductRegistryCache();
  let calls = 0;
  const fetchImpl = async () => {
    calls += 1;
    return {
      ok: true,
      async json() {
        return { schemaVersion: 1, products };
      },
    };
  };

  const first = await loadProductRegistry('https://example.com/store/page.html', fetchImpl);
  const second = await loadProductRegistry('https://example.com/store/page.html', fetchImpl);

  assert.equal(calls, 1);
  assert.equal(first, second);
  assert.equal(first.length, products.length);
});

test('rejects unsupported registry schemas and clears failed cache entries', async () => {
  clearProductRegistryCache();
  let calls = 0;
  const fetchImpl = async () => {
    calls += 1;
    return {
      ok: true,
      async json() {
        return { schemaVersion: 2, products: [] };
      },
    };
  };

  await assert.rejects(
    loadProductRegistry('https://example.com/store/page.html', fetchImpl),
    /unsupported schema/,
  );
  await assert.rejects(
    loadProductRegistry('https://example.com/store/page.html', fetchImpl),
    /unsupported schema/,
  );
  assert.equal(calls, 2);
});
