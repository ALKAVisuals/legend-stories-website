import assert from 'node:assert/strict';
import test from 'node:test';

import {
  LEGACY_STOREFRONT_ORIGIN,
  LEGENDMURAL_PRODUCTION_ORIGIN,
  canonicalUrl,
} from '../config/production-origin.mjs';
import { rewriteProductionOrigin } from '../scripts/vite-production-origin-plugin.mjs';

test('canonical production origin is HTTPS apex legendmural.com', () => {
  assert.equal(LEGENDMURAL_PRODUCTION_ORIGIN, 'https://legendmural.com');
  assert.equal(canonicalUrl('/'), 'https://legendmural.com/');
  assert.equal(canonicalUrl('shop.html'), 'https://legendmural.com/shop.html');
});

test('production HTML rewrite removes the legacy GitHub Pages origin', () => {
  const input = `<link rel="canonical" href="${LEGACY_STOREFRONT_ORIGIN}/shop.html"><meta property="og:url" content="${LEGACY_STOREFRONT_ORIGIN}/shop.html">`;
  const output = rewriteProductionOrigin(input);
  assert.equal(output.includes(LEGACY_STOREFRONT_ORIGIN), false);
  assert.match(output, /https:\/\/legendmural\.com\/shop\.html/);
});

test('homepage rewrite canonicalizes index.html to the HTTPS apex root', () => {
  const input = `<meta property="og:url" content="${LEGACY_STOREFRONT_ORIGIN}/index.html"><link rel="canonical" href="${LEGACY_STOREFRONT_ORIGIN}/index.html">`;
  const output = rewriteProductionOrigin(input, { homepage: true });
  assert.equal(output, '<meta property="og:url" content="https://legendmural.com/"><link rel="canonical" href="https://legendmural.com/">');
});
