import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import {
  CheckoutSessionError,
  allocateDiscountCents,
  normalizeCheckoutCustomer,
} from '../server/payments/checkout-core.mjs';
import { createAuthoritativeOrderQuote } from '../server/commerce/order-quote.mjs';

const catalog = JSON.parse(
  await readFile(new URL('../data/products/catalog.json', import.meta.url), 'utf8'),
).products;
const firstProduct = catalog[0];
const secondProduct = catalog[1];

test('customer normalization trims fields, normalizes email/country and preserves optional address data', () => {
  const customer = normalizeCheckoutCustomer({
    firstname: '  Test ',
    lastname: ' Buyer  ',
    email: '  BUYER@Example.COM ',
    street: ' Teststraat 10 ',
    line2: ' A ',
    zip: ' 1234 AB ',
    city: ' Amsterdam ',
    country: ' nl ',
  });

  assert.deepEqual(customer, {
    firstname: 'Test',
    lastname: 'Buyer',
    email: 'buyer@example.com',
    street: 'Teststraat 10',
    line2: 'A',
    zip: '1234 AB',
    city: 'Amsterdam',
    country: 'NL',
  });
  assert.equal(Object.isFrozen(customer), true);
});

test('customer normalization rejects invalid email and control characters', () => {
  assert.throws(
    () => normalizeCheckoutCustomer({
      firstname: 'Test',
      lastname: 'Buyer',
      email: 'invalid-email',
      street: 'Teststraat 10',
      zip: '1234 AB',
      city: 'Amsterdam',
      country: 'NL',
    }),
    (error) => error instanceof CheckoutSessionError && error.code === 'INVALID_CUSTOMER',
  );

  assert.throws(
    () => normalizeCheckoutCustomer({
      firstname: 'Test\nInjected',
      lastname: 'Buyer',
      email: 'buyer@example.com',
      street: 'Teststraat 10',
      zip: '1234 AB',
      city: 'Amsterdam',
      country: 'NL',
    }),
    (error) => error instanceof CheckoutSessionError && error.code === 'INVALID_CUSTOMER',
  );
});

test('discount allocation reconciles exactly to the authoritative quote', () => {
  const quote = createAuthoritativeOrderQuote({
    items: [
      { page: firstProduct.page, quantity: 1 },
      { page: secondProduct.page, quantity: 2 },
    ],
    countryCode: 'NL',
    discountCode: 'LEGEND10',
  }, catalog);

  const allocations = allocateDiscountCents(quote);
  assert.equal(
    allocations.reduce((sum, line) => sum + line.allocation, 0),
    quote.amountInCents.discount,
  );
  assert.equal(
    allocations.reduce((sum, line) => sum + line.lineCents, 0),
    quote.amountInCents.subtotal,
  );
  assert.equal(allocations.every(Object.isFrozen), true);
});
