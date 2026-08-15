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
const product = catalog[0];

function quote({ variantId, quantity = 1, countryCode = 'NL', discountCode = '' }) {
  return createAuthoritativeOrderQuote({
    items: [{ page: product.page, variantId, quantity }],
    countryCode,
    discountCode,
  }, catalog);
}

function assertMoney(actual, expected) {
  assert.equal(actual, expected);
}

test('launch matrix prices Compact 30 cm and Statement 45 cm authoritatively', () => {
  const compact = quote({ variantId: 'compact-30' });
  const statement = quote({ variantId: 'statement-45' });

  assert.equal(compact.items[0].variantId, 'compact-30');
  assert.equal(compact.items[0].sizeCm, 30);
  assertMoney(compact.items[0].unitPrice, 35);
  assertMoney(compact.totals.subtotal, 35);
  assertMoney(compact.totals.shipping, 4.95);
  assertMoney(compact.totals.grandTotal, 39.95);

  assert.equal(statement.items[0].variantId, 'statement-45');
  assert.equal(statement.items[0].sizeCm, 45);
  assertMoney(statement.items[0].unitPrice, 45);
  assertMoney(statement.totals.subtotal, 45);
  assertMoney(statement.totals.shipping, 4.95);
  assertMoney(statement.totals.grandTotal, 49.95);
});

test('launch matrix applies approved NL, EU and US shipping below the free threshold', () => {
  const cases = [
    ['NL', 4.95, 49.95],
    ['DE', 9.95, 54.95],
    ['US', 9.95, 54.95],
  ];

  for (const [countryCode, shipping, grandTotal] of cases) {
    const result = quote({ variantId: 'statement-45', countryCode });
    assert.equal(result.shipping.countryCode, countryCode);
    assertMoney(result.shipping.cost, shipping);
    assertMoney(result.totals.grandTotal, grandTotal);
    assert.equal(result.shipping.qualifiesForFreeShipping, false);
  }
});

test('launch matrix applies LEGEND10 before evaluating free shipping', () => {
  const compactNl = quote({
    variantId: 'compact-30',
    countryCode: 'NL',
    discountCode: 'LEGEND10',
  });
  assertMoney(compactNl.discount.amount, 3.5);
  assertMoney(compactNl.totals.discountedSubtotal, 31.5);
  assertMoney(compactNl.totals.shipping, 4.95);
  assertMoney(compactNl.totals.grandTotal, 36.45);

  const statementEu = quote({
    variantId: 'statement-45',
    countryCode: 'DE',
    discountCode: 'LEGEND10',
  });
  assertMoney(statementEu.discount.amount, 4.5);
  assertMoney(statementEu.totals.discountedSubtotal, 40.5);
  assertMoney(statementEu.totals.shipping, 9.95);
  assertMoney(statementEu.totals.grandTotal, 50.45);

  const statementUs = quote({
    variantId: 'statement-45',
    countryCode: 'US',
    discountCode: 'LEGEND10',
  });
  assertMoney(statementUs.totals.discountedSubtotal, 40.5);
  assertMoney(statementUs.totals.shipping, 9.95);
  assertMoney(statementUs.totals.grandTotal, 50.45);
});

test('launch matrix grants free shipping from €69 after discount, not before discount', () => {
  const twoCompactNoDiscount = quote({ variantId: 'compact-30', quantity: 2, countryCode: 'NL' });
  assertMoney(twoCompactNoDiscount.totals.subtotal, 70);
  assertMoney(twoCompactNoDiscount.totals.discountedSubtotal, 70);
  assertMoney(twoCompactNoDiscount.totals.shipping, 0);
  assert.equal(twoCompactNoDiscount.shipping.qualifiesForFreeShipping, true);

  const twoCompactDiscountedNl = quote({
    variantId: 'compact-30',
    quantity: 2,
    countryCode: 'NL',
    discountCode: 'LEGEND10',
  });
  assertMoney(twoCompactDiscountedNl.totals.subtotal, 70);
  assertMoney(twoCompactDiscountedNl.totals.discountedSubtotal, 63);
  assertMoney(twoCompactDiscountedNl.totals.shipping, 4.95);
  assertMoney(twoCompactDiscountedNl.totals.grandTotal, 67.95);
  assert.equal(twoCompactDiscountedNl.shipping.qualifiesForFreeShipping, false);

  const twoCompactDiscountedUs = quote({
    variantId: 'compact-30',
    quantity: 2,
    countryCode: 'US',
    discountCode: 'LEGEND10',
  });
  assertMoney(twoCompactDiscountedUs.totals.discountedSubtotal, 63);
  assertMoney(twoCompactDiscountedUs.totals.shipping, 9.95);
  assertMoney(twoCompactDiscountedUs.totals.grandTotal, 72.95);
  assert.equal(twoCompactDiscountedUs.shipping.qualifiesForFreeShipping, false);

  const twoStatementDiscounted = quote({
    variantId: 'statement-45',
    quantity: 2,
    countryCode: 'US',
    discountCode: 'LEGEND10',
  });
  assertMoney(twoStatementDiscounted.totals.subtotal, 90);
  assertMoney(twoStatementDiscounted.totals.discountedSubtotal, 81);
  assertMoney(twoStatementDiscounted.totals.shipping, 0);
  assertMoney(twoStatementDiscounted.totals.grandTotal, 81);
  assert.equal(twoStatementDiscounted.shipping.qualifiesForFreeShipping, true);
});

test('launch matrix keeps mixed Compact and Statement identity and earns free shipping after LEGEND10', () => {
  const result = createAuthoritativeOrderQuote({
    items: [
      { page: product.page, variantId: 'compact-30', quantity: 1 },
      { page: product.page, variantId: 'statement-45', quantity: 1 },
    ],
    countryCode: 'DE',
    discountCode: 'LEGEND10',
  }, catalog);

  assert.deepEqual(
    result.items.map((item) => item.variantId).sort(),
    ['compact-30', 'statement-45'],
  );
  assert.deepEqual(
    result.items.map((item) => item.sizeCm).sort((a, b) => a - b),
    [30, 45],
  );
  assertMoney(result.totals.subtotal, 80);
  assertMoney(result.discount.amount, 8);
  assertMoney(result.totals.discountedSubtotal, 72);
  assertMoney(result.totals.shipping, 0);
  assertMoney(result.totals.grandTotal, 72);
  assert.equal(result.shipping.qualifiesForFreeShipping, true);
});

test('launch matrix blocks destinations outside NL, EU and US', () => {
  assert.throws(
    () => quote({ variantId: 'statement-45', countryCode: 'GB' }),
    (error) => {
      assert.ok(error instanceof OrderQuoteError);
      assert.equal(error.code, 'SHIPPING_COUNTRY_UNAVAILABLE');
      return true;
    },
  );
});
