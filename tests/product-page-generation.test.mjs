import test from 'node:test';
import assert from 'node:assert/strict';
import { loadBatch3ProductData } from '../scripts/batch3-product-data.mjs';
import { renderProductPage } from '../scripts/product-page-generation.mjs';
import { normalizeTemplateStructure } from '../scripts/product-page-template.mjs';

test('rendered product values preserve apostrophes and canonical URLs', () => {
  const template = '{{NAME}}|{{STORY}}|{{CANONICAL}}|{{ABSOLUTE_IMAGE}}|{{PRICE_RAW}}';
  const product = {
    page: 'sport-lions-pride.html',
    name: "The Lion's Pride",
    description: 'A test product.',
    image: 'media/stikkers/test.png',
    price: 49.95,
    currency: 'EUR',
    availability: 'https://schema.org/InStock',
    canonical: 'https://example.com/sport-lions-pride.html',
    collection: 'Sport Legends',
    category: 'sport',
  };
  const presentation = {
    story: "Don't stop believing.",
    imageAlt: "The Lion's Pride wall sticker",
    compareAtPrice: 59.95,
    discountLabel: 'Save 17%',
    announcementHtml: '<strong>Test</strong>',
  };

  const rendered = renderProductPage(template, product, presentation);
  assert.equal(
    rendered,
    "The Lion's Pride|Don't stop believing.|https://example.com/sport-lions-pride.html|https://example.com/media/stikkers/test.png|49.95",
  );
});

test('template structure ignores formatting-only whitespace between tags', () => {
  assert.equal(
    normalizeTemplateStructure('<main>\n  <section>Test</section>\n</main>'),
    '<main><section>Test</section></main>',
  );
});

test('Batch 3 resolves exactly 20 complete products from the full catalog', async () => {
  const { batch, products } = await loadBatch3ProductData(process.cwd());
  assert.equal(batch.id, '2026-batch-3');
  assert.equal(products.length, 20);
  assert.ok(products.every((product) => product.canonical));
  assert.ok(products.every((product) => product.availability));
  assert.ok(products.every((product) => product.batchId === batch.id));
});
