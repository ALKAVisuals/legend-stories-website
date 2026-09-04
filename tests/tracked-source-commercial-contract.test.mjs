import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { rewriteLaunchCommercialCopy } from '../scripts/vite-launch-commercial-copy-plugin.mjs';

const index = await readFile(new URL('../index.html', import.meta.url), 'utf8');
const shop = await readFile(new URL('../shop.html', import.meta.url), 'utf8');
const variants = await readFile(new URL('../js/commerce/product-variants.mjs', import.meta.url), 'utf8');

const forbidden = [
  /€49(?:,95)?/i,
  /\b2\s*(?:to|-|–|—)\s*4\s*(?:working\s+)?days?\b/i,
  /Free shipping over €50/i,
  /30 day return window/i,
  /statement-50x50/i,
  /compact-50x30/i,
  /50\s*×\s*50\s*cm/i,
  /50\s*×\s*30\s*cm/i,
];

test('tracked homepage source already expresses current launch commercial rules', () => {
  for (const pattern of forbidden) assert.doesNotMatch(index, pattern);
  assert.match(index, /From €35/);
  assert.match(index, /data-price="45" data-variant-id="statement-45" data-size-label="45 cm"/);
  assert.match(index, /prepared for shipment from the Netherlands/i);
  assert.equal(rewriteLaunchCommercialCopy(index, { path: '/' }), index, 'production build must not need to rewrite homepage commercial copy');
});

test('tracked shop source already expresses current launch commercial rules', () => {
  for (const pattern of forbidden) assert.doesNotMatch(shop, pattern);
  assert.match(shop, /Free shipping from €69 after discount./);
  assert.match(shop, /14-day statutory withdrawal period/);
  assert.match(shop, /From €35/);
  assert.match(shop, /data-price="45" data-variant-id="statement-45" data-size-label="45 cm"/);
  assert.equal(rewriteLaunchCommercialCopy(shop, { path: '/shop.html' }), shop, 'production build must not need to rewrite shop commercial copy');
});

test('legacy variant aliases remain only as runtime backwards compatibility', () => {
  assert.match(variants, /'statement-50x50': 'statement-45'/);
  assert.match(variants, /'compact-50x30': 'compact-30'/);
});
