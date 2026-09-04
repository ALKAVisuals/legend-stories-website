import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import test from 'node:test';

const ROOT = process.cwd();
const catalog = JSON.parse(
  await readFile(join(ROOT, 'data', 'products', 'catalog.json'), 'utf8'),
);

const MANUFACTURER = 'Alka Group, trading through LegendMural';
const ADDRESS = 'Schutkolk 4 d 1, 6582 DB Heumen, The Netherlands';
const EMAIL = 'info@alkavisuals.nl';

function extractProductJsonLd(html) {
  const blocks = [...html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)];
  for (const block of blocks) {
    const parsed = JSON.parse(block[1]);
    const candidates = Array.isArray(parsed?.['@graph']) ? [parsed, ...parsed['@graph']] : [parsed];
    const product = candidates.find((candidate) => {
      const type = candidate?.['@type'];
      return (Array.isArray(type) ? type : [type]).some(
        (entry) => String(entry).toLowerCase() === 'product',
      );
    });
    if (product) return product;
  }
  return null;
}

test('all 111 managed product offers expose authoritative product and manufacturer identity', async () => {
  assert.equal(catalog.productCount, 111);
  assert.equal(catalog.products.length, 111);

  for (const product of catalog.products) {
    const html = await readFile(join(ROOT, product.page), 'utf8');

    assert.match(html, /data-product-identity/, `${product.page}: identity block missing`);
    assert.ok(
      html.includes(`data-product-id>${product.productId}</dd>`),
      `${product.page}: visible Product ID is missing or incorrect`,
    );
    assert.ok(html.includes(MANUFACTURER), `${product.page}: manufacturer name missing`);
    assert.ok(html.includes(ADDRESS), `${product.page}: manufacturer address missing`);
    assert.ok(html.includes(`mailto:${EMAIL}`), `${product.page}: manufacturer email link missing`);

    const structured = extractProductJsonLd(html);
    assert.ok(structured, `${product.page}: Product JSON-LD missing`);
    assert.equal(structured.productID, product.productId, `${product.page}: JSON-LD productID mismatch`);
    assert.equal(structured.manufacturer?.name, 'Alka Group', `${product.page}: JSON-LD manufacturer mismatch`);
    assert.equal(structured.manufacturer?.alternateName, 'LegendMural', `${product.page}: JSON-LD manufacturer brand mismatch`);
    assert.equal(structured.manufacturer?.email, EMAIL, `${product.page}: JSON-LD manufacturer email mismatch`);
    assert.equal(
      structured.manufacturer?.address?.streetAddress,
      'Schutkolk 4 d 1',
      `${product.page}: JSON-LD manufacturer address mismatch`,
    );
  }
});

test('shared managed product template keeps product identity centralized', async () => {
  const template = await readFile(join(ROOT, 'templates', 'product-page.html'), 'utf8');
  assert.match(template, /data-product-identity/);
  assert.match(template, /data-product-id>{{PRODUCT_ID}}<\/dd>/);
  assert.ok(template.includes(MANUFACTURER));
  assert.ok(template.includes(ADDRESS));
  assert.ok(template.includes(`mailto:${EMAIL}`));
});