import test from 'node:test';
import assert from 'node:assert/strict';
import {
  loadCatalogBatch,
  loadManagedProductPageBatches,
} from '../scripts/managed-product-page-data.mjs';
import { renderProductPage } from '../scripts/product-page-generation.mjs';
import {
  normalizeLegacyProductPageMarkup,
  normalizeTemplateStructure,
} from '../scripts/product-page-template.mjs';

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

test('legacy product chrome normalizes without touching presentation content', () => {
  const legacy = [
    '<a href="index.html" class="flex group logo-wrap" aria-label="Legend Stories Home">',
    '<img src="media/LOGO/lm-logo-transparant.png" alt="Copied Product Name" class="logo-glow">',
    '</a></a>',
    '<a href="music-legends.html" class="text-sm font-medium">Combat Legends</a>',
    '<a href="music-legends.html" class="text-sm font-medium py-2">Combat Legends</a>',
    '<p>Keep this story unchanged.</p>',
  ].join('');

  const normalized = normalizeLegacyProductPageMarkup(legacy);
  assert.match(normalized, /alt=""/);
  assert.doesNotMatch(normalized, /<\/a><\/a>/);
  assert.equal((normalized.match(/href="combat-legends\.html"/g) || []).length, 2);
  assert.match(normalized, /<p>Keep this story unchanged\.<\/p>/);
});

test('known UI vector variants do not create false template differences', () => {
  const current = [
    '<button id="cart-btn" class="cart"><svg viewBox="0 0 24 24"><path d="current-cart" /></svg></button>',
    '<a href="#" aria-label="TikTok"><svg viewBox="0 0 24 24"><path d="current-tiktok" /></svg></a>',
  ].join('');
  const legacy = [
    '<button id="cart-btn" class="cart"><svg viewBox="0 0 24 24"><path d="legacy-cart" /></svg></button>',
    '<a href="#" aria-label="TikTok"><svg viewBox="0 0 24 24"><path d="legacy-tiktok" /></svg></a>',
  ].join('');

  assert.equal(normalizeTemplateStructure(current), normalizeTemplateStructure(legacy));
  assert.match(normalizeTemplateStructure(current), /data-template-icon="cart"/);
  assert.match(normalizeTemplateStructure(current), /data-template-icon="tiktok"/);
});

test('template structure ignores formatting-only whitespace between tags', () => {
  assert.equal(
    normalizeTemplateStructure('<main>\n  <section>Test</section>\n</main>'),
    '<main><section>Test</section></main>',
  );
});

test('catalog batch loader resolves exactly 20 complete Batch 3 products', async () => {
  const { batch, products } = await loadCatalogBatch(process.cwd(), '2026-batch-3');
  assert.equal(batch.id, '2026-batch-3');
  assert.equal(products.length, 20);
  assert.ok(products.every((product) => product.canonical));
  assert.ok(products.every((product) => product.availability));
  assert.ok(products.every((product) => product.batchId === batch.id));
});

test('managed page config resolves Batches 3, 4, 5 and 6 as 71 products', async () => {
  const managed = await loadManagedProductPageBatches(process.cwd());
  assert.deepEqual(
    managed.batches.map((entry) => entry.id),
    ['2026-batch-3', '2026-batch-4', '2026-batch-5', '2026-batch-6'],
  );
  assert.equal(
    managed.batches.reduce((total, entry) => total + entry.products.length, 0),
    71,
  );
  assert.ok(managed.batches.every((entry) => entry.products.length === entry.expectedProductCount));
});
