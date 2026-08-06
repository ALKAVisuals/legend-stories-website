import assert from 'node:assert/strict';
import test from 'node:test';

import {
  rewriteAssetReferences,
  validatePagesBasePath,
} from '../scripts/optimize-github-pages-assets.mjs';

test('accepts one safe GitHub Pages repository base path', () => {
  assert.equal(
    validatePagesBasePath('/legend-stories-website/'),
    '/legend-stories-website/',
  );
});

test('rejects unsafe or root Pages base paths', () => {
  for (const value of ['/', '../legend/', '/legend/../site/', 'https://example.com/site/']) {
    assert.throws(() => validatePagesBasePath(value));
  }
});

test('rewrites root, repository-prefixed and relative asset references', () => {
  const source = [
    '<img src="/legend-stories-website/assets/hero-ABC123.png">',
    '<img src="/assets/hero-ABC123.png">',
    'background-image:url(assets/hero-ABC123.png)',
    '{"browserImage":"/legend-stories-website/assets/hero-ABC123.png"}',
  ].join('\n');

  const updated = rewriteAssetReferences(source, [
    {
      sourceName: 'hero-ABC123.png',
      targetName: 'hero-ABC123.webp',
    },
  ]);

  assert.doesNotMatch(updated, /hero-ABC123\.png/);
  assert.equal((updated.match(/hero-ABC123\.webp/g) || []).length, 4);
});

test('does not alter unrelated asset names', () => {
  const source = 'assets/hero-ABC123.png assets/hero-ABC123-extra.png';
  const updated = rewriteAssetReferences(source, [
    {
      sourceName: 'hero-ABC123.png',
      targetName: 'hero-ABC123.webp',
    },
  ]);

  assert.equal(updated, 'assets/hero-ABC123.webp assets/hero-ABC123-extra.png');
});
