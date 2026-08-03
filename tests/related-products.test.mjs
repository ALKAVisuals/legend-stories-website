import test from 'node:test';
import assert from 'node:assert/strict';

import {
  clearProductRegistryCache,
  createSeededRandom,
  findCurrentProduct,
  getRelatedSessionSeed,
  loadProductRegistry,
  registryUrl,
  selectRelatedProducts,
} from '../js/catalog/related-products.mjs';

const products = [
  { page: 'music-first.html', name: 'First', collection: 'Music Legends' },
  { page: 'music-second.html', name: 'Second', collection: 'Music Legends' },
  { page: 'music-third.html', name: 'Third', collection: 'Music Legends' },
  { page: 'music-fourth.html', name: 'Fourth', collection: 'Music Legends' },
  { page: 'music-fifth.html', name: 'Fifth', collection: 'Music Legends' },
  { page: 'sport-first.html', name: 'First', collection: 'Sport Legends' },
  { page: 'combat-first.html', name: 'Combat', collection: 'Combat Legends' },
];

test('finds the current product by page before duplicate name', () => {
  const current = findCurrentProduct(products, { page: 'sport-first.html', name: 'First' });
  assert.equal(current.page, 'sport-first.html');
});

test('falls back to product name when a page is unavailable', () => {
  const current = findCurrentProduct(products, { page: 'unknown.html', name: 'Second' });
  assert.equal(current.page, 'music-second.html');
});

test('selects four unique products and excludes the current sticker', () => {
  const related = selectRelatedProducts(products, products[0], {
    limit: 4,
    seed: 'visitor-a',
  });
  assert.equal(related.length, 4);
  assert.equal(new Set(related.map((product) => product.page)).size, 4);
  assert.equal(related.some((product) => product.page === products[0].page), false);
});

test('prioritizes randomized products from the same collection', () => {
  const related = selectRelatedProducts(products, products[0], {
    limit: 4,
    seed: 'same-collection-priority',
  });
  assert.deepEqual(
    related.map((product) => product.collection),
    ['Music Legends', 'Music Legends', 'Music Legends', 'Music Legends'],
  );
});

test('fills remaining positions from other collections when necessary', () => {
  const limitedProducts = [products[0], products[1], products[5], products[6]];
  const related = selectRelatedProducts(limitedProducts, limitedProducts[0], {
    limit: 4,
    seed: 'fallback-collections',
  });
  assert.equal(related.length, 3);
  assert.equal(related[0].collection, 'Music Legends');
  assert.deepEqual(
    new Set(related.slice(1).map((product) => product.collection)),
    new Set(['Sport Legends', 'Combat Legends']),
  );
});

test('keeps a seeded selection stable during a browser session', () => {
  const first = selectRelatedProducts(products, products[0], {
    limit: 4,
    sessionSeed: 'session-123',
  });
  const second = selectRelatedProducts(products, products[0], {
    limit: 4,
    sessionSeed: 'session-123',
  });
  assert.deepEqual(first, second);
});

test('supports genuinely different randomized orders', () => {
  const noSwap = selectRelatedProducts(products, products[0], {
    limit: 4,
    random: () => 0.999,
  });
  const frontSwap = selectRelatedProducts(products, products[0], {
    limit: 4,
    random: () => 0,
  });
  assert.notDeepEqual(
    noSwap.map((product) => product.page),
    frontSwap.map((product) => product.page),
  );
});

test('keeps backwards-compatible numeric limits', () => {
  const related = selectRelatedProducts(products, products[0], 1);
  assert.equal(related.length, 1);
  assert.equal(related[0].collection, 'Music Legends');
});

test('creates repeatable pseudo-random values from a seed', () => {
  const first = createSeededRandom('repeatable');
  const second = createSeededRandom('repeatable');
  assert.deepEqual(
    [first(), first(), first()],
    [second(), second(), second()],
  );
});

test('stores one related-product seed for the current session', () => {
  const values = new Map();
  const storage = {
    getItem(key) { return values.get(key) || null; },
    setItem(key, value) { values.set(key, value); },
  };
  const cryptoRef = {
    getRandomValues(array) {
      array[0] = 12;
      array[1] = 34;
      return array;
    },
  };
  const first = getRelatedSessionSeed(storage, cryptoRef);
  const second = getRelatedSessionSeed(storage, cryptoRef);
  assert.equal(first, second);
  assert.equal(values.size, 1);
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
