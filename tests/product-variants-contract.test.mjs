import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const appSource = await readFile(new URL('../js/app.js', import.meta.url), 'utf8');
const templateSource = await readFile(new URL('../templates/product-page.html', import.meta.url), 'utf8');
const orderRequestSource = await readFile(new URL('../js/commerce/order-request.mjs', import.meta.url), 'utf8');
const orderQuoteSource = await readFile(new URL('../server/commerce/order-quote.mjs', import.meta.url), 'utf8');

test('product page defaults to the 45 cm statement variant', () => {
  assert.match(templateSource, /data-product-variant-selector/);
  assert.match(templateSource, /value="statement-45" checked/);
  assert.match(templateSource, /value="compact-30"/);
  assert.match(templateSource, /Most chosen/);
  assert.match(templateSource, /data-variant-badge/);
  assert.match(templateSource, /flex shrink-0 flex-col items-end gap-2/);
  assert.doesNotMatch(templateSource, /absolute -top-2\.5 right-3/);
  assert.match(templateSource, /measured along the longest side/i);
  assert.doesNotMatch(templateSource, /line-through|Save 17%|60\s*[×x]\s*90/);
});

test('browser cart identity and request preserve the selected variant', () => {
  assert.match(appSource, /CART_SCHEMA_VERSION = '3'/);
  assert.match(appSource, /createCartLineId\(page, variant\.id\)/);
  assert.match(appSource, /variantId: variant\.id/);
  assert.match(orderRequestSource, /variantId/);
});

test('authoritative order quote resolves server-side variant prices', () => {
  assert.match(orderQuoteSource, /resolveCatalogProductVariant/);
  assert.match(orderQuoteSource, /UNKNOWN_PRODUCT_VARIANT/);
  assert.match(orderQuoteSource, /unitPrice = roundMoney\(variant\.price\)/);
});
