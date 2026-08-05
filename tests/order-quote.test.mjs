import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import {
  createAuthoritativeOrderQuote,
  OrderQuoteError,
} from '../server/commerce/order-quote.mjs';

const catalog = JSON.parse(
  await readFile(new URL('../data/products/catalog.json', import.meta.url), 'utf8'),
).products;
const firstProduct = catalog[0];
const secondProduct = catalog[1];
const firstDefaultVariant = firstProduct.variants?.find((variant) => (
  variant.id === firstProduct.defaultVariantId || variant.isDefault
));
const expectedFirstProductName = firstDefaultVariant?.sizeLabel
  ? `${firstProduct.name} — ${firstDefaultVariant.label} (${firstDefaultVariant.sizeLabel})`
  : firstProduct.name;

function expectOrderError(fn, code) {
  assert.throws(fn, (error) => {
    assert.ok(error instanceof OrderQuoteError);
    assert.equal(error.code, code);
    return true;
  });
}

test('builds totals from authoritative catalog prices and ignores browser price fields', () => {
  const quote = createAuthoritativeOrderQuote({
    items: [{
      page: firstProduct.page,
      quantity: 1,
      price: 0.01,
      name: 'Tampered name',
    }],
    countryCode: 'NL',
  }, catalog);

  assert.equal(quote.items[0].name, expectedFirstProductName);
  assert.equal(quote.items[0].variantId, 'statement-50x50');
  assert.equal(quote.items[0].sizeCm, 50);
  assert.equal(quote.items[0].unitPrice, 45);
  assert.equal(quote.totals.subtotal, 45);
  assert.equal(quote.totals.shipping, 4.95);
  assert.equal(quote.totals.grandTotal, 49.95);
  assert.equal(quote.amountInCents.grandTotal, 4995);
});

test('quotes the approved EU and United States shipping rates server-side', () => {
  const item = { page: firstProduct.page, quantity: 1 };
  const euQuote = createAuthoritativeOrderQuote({ items: [item], countryCode: 'DE' }, catalog);
  const usQuote = createAuthoritativeOrderQuote({ items: [item], countryCode: 'US' }, catalog);

  assert.equal(euQuote.shipping.countryCode, 'DE');
  assert.equal(euQuote.shipping.cost, 9.95);
  assert.equal(euQuote.totals.grandTotal, 54.95);
  assert.equal(usQuote.shipping.countryCode, 'US');
  assert.equal(usQuote.shipping.cost, 9.95);
  assert.equal(usQuote.totals.grandTotal, 54.95);
});

test('resolves products by slug and validates discount codes centrally', () => {
  const quote = createAuthoritativeOrderQuote({
    items: [{ slug: firstProduct.slug, quantity: 1 }],
    countryCode: 'nl',
    discountCode: ' legend10 ',
  }, catalog);

  assert.equal(quote.discount.code, 'LEGEND10');
  assert.equal(quote.discount.percent, 10);
  assert.equal(quote.discount.amount, 4.5);
  assert.equal(quote.totals.discountedSubtotal, 40.5);
  assert.equal(quote.totals.grandTotal, 45.45);
  assert.equal(quote.amountInCents.grandTotal, 4545);
  assert.equal(
    quote.amountInCents.subtotal
      - quote.amountInCents.discount
      + quote.amountInCents.shipping,
    quote.amountInCents.grandTotal,
  );
});

test('aggregates duplicate product lines without trusting client totals', () => {
  const quote = createAuthoritativeOrderQuote({
    items: [
      { page: firstProduct.page, quantity: 2, lineTotal: 0 },
      { slug: firstProduct.slug, quantity: 3, lineTotal: 9999 },
      { page: secondProduct.page, quantity: 1 },
    ],
    countryCode: 'NL',
  }, catalog);

  assert.equal(quote.items.length, 2);
  assert.equal(quote.items.find((item) => item.page === firstProduct.page).quantity, 5);
  assert.equal(quote.totals.subtotal, 270);
  assert.equal(quote.totals.shipping, 0);
  assert.equal(quote.amountInCents.grandTotal, 27000);
});

test('rejects empty carts, unknown products and invalid discount codes', () => {
  expectOrderError(
    () => createAuthoritativeOrderQuote({ items: [] }, catalog),
    'EMPTY_CART',
  );
  expectOrderError(
    () => createAuthoritativeOrderQuote({ items: [{ page: 'missing.html', quantity: 1 }] }, catalog),
    'UNKNOWN_PRODUCT',
  );
  expectOrderError(
    () => createAuthoritativeOrderQuote({
      items: [{ page: firstProduct.page, quantity: 1 }],
      discountCode: 'FREE100',
    }, catalog),
    'INVALID_DISCOUNT_CODE',
  );
});

test('rejects invalid quantities and conflicting product identifiers', () => {
  expectOrderError(
    () => createAuthoritativeOrderQuote({
      items: [{ page: firstProduct.page, quantity: 0 }],
    }, catalog),
    'INVALID_QUANTITY',
  );
  expectOrderError(
    () => createAuthoritativeOrderQuote({
      items: [{ page: firstProduct.page, slug: secondProduct.slug, quantity: 1 }],
    }, catalog),
    'PRODUCT_ID_MISMATCH',
  );
});
