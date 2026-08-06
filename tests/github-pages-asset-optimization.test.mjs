import assert from 'node:assert/strict';
import test from 'node:test';

import {
  MAX_ASSET_BYTES,
  MIN_PNG_BYTES,
  assertAssetBudget,
  isPagesOptimizationCandidate,
  replacementVariants,
  rewriteAssetReferences,
} from '../scripts/optimize-github-pages-assets.mjs';

test('selects only large PNG assets for Pages optimization', () => {
  assert.equal(isPagesOptimizationCandidate('legend.png', MIN_PNG_BYTES), true);
  assert.equal(isPagesOptimizationCandidate('legend.PNG', MIN_PNG_BYTES + 1), true);
  assert.equal(isPagesOptimizationCandidate('legend.png', MIN_PNG_BYTES - 1), false);
  assert.equal(isPagesOptimizationCandidate('legend.webp', MIN_PNG_BYTES + 1), false);
});

test('produces raw and URL-encoded asset replacement variants', () => {
  assert.deepEqual(
    replacementVariants('Ice Cube-ABC123.png', 'Ice Cube-ABC123.webp'),
    [
      { from: 'Ice Cube-ABC123.png', to: 'Ice Cube-ABC123.webp' },
      { from: 'Ice%20Cube-ABC123.png', to: 'Ice%20Cube-ABC123.webp' },
    ],
  );
});

test('rewrites HTML and runtime registry asset references', () => {
  const source = [
    '<img src="/legend-stories-website/assets/Ice%20Cube-ABC123.png">',
    '"image": "/legend-stories-website/assets/Ice Cube-ABC123.png"',
  ].join('\n');

  const updated = rewriteAssetReferences(source, [
    { from: 'Ice Cube-ABC123.png', to: 'Ice Cube-ABC123.webp' },
  ]);

  assert.match(updated, /Ice%20Cube-ABC123\.webp/);
  assert.match(updated, /Ice Cube-ABC123\.webp/);
  assert.doesNotMatch(updated, /Ice(?:%20| )Cube-ABC123\.png/);
});

test('enforces the GitHub Pages asset byte budget', () => {
  assert.equal(assertAssetBudget(MAX_ASSET_BYTES), MAX_ASSET_BYTES);
  assert.throws(
    () => assertAssetBudget(MAX_ASSET_BYTES + 1),
    /assets exceed/,
  );
  assert.throws(
    () => assertAssetBudget(-1),
    /valid positive byte values/,
  );
});
