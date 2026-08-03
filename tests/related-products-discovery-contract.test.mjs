import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const [appSource, catalogSource, stylesSource] = await Promise.all([
  readFile(new URL('../js/app.js', import.meta.url), 'utf8'),
  readFile(new URL('../js/catalog/related-products.mjs', import.meta.url), 'utf8'),
  readFile(new URL('../css/related-products.css', import.meta.url), 'utf8'),
]);

const relatedBlock = appSource.match(
  /async function initRelatedProducts\(\)[\s\S]*?(?=\n  function initCarousel\(\))/,
)?.[0] || '';

test('product pages render four premium related sticker cards', () => {
  assert.match(appSource, /heading\.textContent = 'Discover more legends'/);
  assert.match(relatedBlock, /catalog\.selectRelatedProducts\(products, currentProduct, \{ limit: 4 \}\)/);
  assert.match(relatedBlock, /related-discovery-track/);
  assert.match(relatedBlock, /related-discovery-card/);
  assert.match(relatedBlock, /From €35/);
  assert.match(relatedBlock, /loading="lazy"/);
  assert.match(relatedBlock, /decoding="async"/);
  assert.match(relatedBlock, /fetchpriority="low"/);
});

test('related sticker discovery remains static until the visitor swipes or clicks', () => {
  assert.doesNotMatch(
    relatedBlock,
    /scheduleAutoScroll|startAutoScroll|pauseAutoScroll|resumeAutoScroll|relatedMotionGate/,
  );
  assert.match(stylesSource, /scroll-snap-type:\s*inline mandatory/);
  assert.match(stylesSource, /grid-auto-columns:\s*minmax\(72vw, 72vw\)/);
  assert.match(stylesSource, /grid-template-columns:\s*repeat\(4, minmax\(0, 1fr\)\)/);
});

test('selection is unique, collection-first and stable within one browser session', () => {
  assert.match(catalogSource, /legendRelatedSeedV1/);
  assert.match(catalogSource, /uniqueAvailableProducts/);
  assert.match(catalogSource, /sameCollection/);
  assert.match(catalogSource, /otherCollections/);
  assert.match(catalogSource, /createSeededRandom/);
  assert.match(catalogSource, /sessionStorage/);
});
