import test from 'node:test';
import assert from 'node:assert/strict';

import {
  extractBatchMetadata,
  extractProductFromHtml,
  normalizeLocalAsset,
} from '../scripts/product-inventory.mjs';

test('normalizes legacy GitHub Pages media URLs', () => {
  assert.equal(
    normalizeLocalAsset('https://alkavisuals.github.io/legend-stories-website/media/stikkers/2026/batch%203/Music%20Legends/example.png'),
    'media/stikkers/2026/batch 3/Music Legends/example.png',
  );
});

test('extracts batch and collection metadata from spaced paths', () => {
  assert.deepEqual(
    extractBatchMetadata('media/stikkers/2026/batch 3/Combat Legends/example.png'),
    {
      id: '2026-batch-3',
      year: 2026,
      number: 3,
      collection: 'Combat Legends',
      category: 'combat',
    },
  );
});

test('normalizes legacy no-space batch paths and collection casing', () => {
  assert.deepEqual(
    extractBatchMetadata('media/stikkers/2026/Batch2/combat Legends/example.png'),
    {
      id: '2026-batch-2',
      year: 2026,
      number: 2,
      collection: 'Combat Legends',
      category: 'combat',
    },
  );
});

test('extracts and compares product, page and cart data with apostrophes', () => {
  const html = `
    <html>
      <head>
        <link rel="canonical" href="https://example.com/music-example.html">
        <script type="application/ld+json">
          {
            "@context": "https://schema.org/",
            "@type": "Product",
            "name": "Dreamers' Reality",
            "image": "https://alkavisuals.github.io/legend-stories-website/media/stikkers/2026/Batch2/Music Legends/example.png",
            "description": "Example description",
            "offers": {
              "@type": "Offer",
              "price": "49.95",
              "priceCurrency": "EUR",
              "availability": "https://schema.org/InStock",
              "url": "https://example.com/music-example.html"
            }
          }
        </script>
      </head>
      <body>
        <h1>Dreamers' Reality</h1>
        <button class="btn add-to-cart-btn" data-name="Dreamers' Reality" data-price="49.95" data-img="media/stikkers/2026/Batch2/Music Legends/example.png">Add</button>
      </body>
    </html>
  `;

  const result = extractProductFromHtml('music-example.html', html);
  assert.equal(result.product.name, "Dreamers' Reality");
  assert.equal(result.product.batchId, '2026-batch-2');
  assert.equal(result.product.collection, 'Music Legends');
  assert.equal(result.product.price, 49.95);
  assert.deepEqual(result.product.errors, []);
});

test('reports cart price drift as a hard error', () => {
  const html = `
    <h1>Example Legend</h1>
    <script type="application/ld+json">
      {"@type":"Product","name":"Example Legend","image":"media/stikkers/2026/batch 3/Music Legends/example.png","offers":{"price":"49.95","priceCurrency":"EUR","url":"music-example.html"}}
    </script>
    <button class="add-to-cart-btn" data-name="Example Legend" data-price="59.95" data-img="media/stikkers/2026/batch 3/Music Legends/example.png">Add</button>
  `;

  const result = extractProductFromHtml('music-example.html', html);
  assert.equal(result.product.errors.length, 1);
  assert.match(result.product.errors[0], /cart price differs/);
});
