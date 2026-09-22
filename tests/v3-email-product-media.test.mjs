import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import {
  resolveV3EmailProductAsset,
  V3_EMAIL_PRODUCT_PUBLIC_PREFIX,
} from '../server/notifications/v3-email-product-media.mjs';

const catalog = JSON.parse(await readFile(
  new URL('../data/products/catalog.json', import.meta.url),
  'utf8',
));

test('catalog product images map one-to-one to stable deployed email asset paths', () => {
  const paths = new Set();

  for (const product of catalog.products) {
    const asset = resolveV3EmailProductAsset(product.image);
    assert.ok(asset, product.productId);
    assert.equal(asset.sourcePath, product.image);
    assert.ok(asset.publicPath.startsWith(V3_EMAIL_PRODUCT_PUBLIC_PREFIX));
    assert.ok(asset.url.startsWith('https://legendmural.com/email-products/'));
    assert.equal(asset.url.includes('/media/stikkers/'), false);
    assert.equal(asset.url.includes('/media/browser-products/'), false);
    assert.equal(paths.has(asset.publicPath), false, asset.publicPath);
    paths.add(asset.publicPath);
  }

  assert.equal(paths.size, catalog.products.length);
});

test('stable email product resolver rejects traversal and external sources', () => {
  for (const value of [
    '',
    null,
    '../media/stikkers/product.png',
    'media/stikkers/../secret.png',
    'https://attacker.example/product.png',
    '/media/other/product.png',
    'media/stikkers/product.svg',
    'media\\stikkers\\product.png',
  ]) {
    assert.equal(resolveV3EmailProductAsset(value), null);
  }
});

test('stable email product resolver preserves immutable source identity and URL-encodes spaces', () => {
  const asset = resolveV3EmailProductAsset(
    'media/stikkers/2026/Batch 4/combat Legends/balanced-mind-combat-legend-mural.png',
  );

  assert.deepEqual(asset, {
    sourcePath: 'media/stikkers/2026/Batch 4/combat Legends/balanced-mind-combat-legend-mural.png',
    publicPath: '/email-products/stikkers/2026/Batch 4/combat Legends/balanced-mind-combat-legend-mural.png',
    url: 'https://legendmural.com/email-products/stikkers/2026/Batch%204/combat%20Legends/balanced-mind-combat-legend-mural.png',
    contentType: 'image/png',
    extension: 'png',
  });
});
