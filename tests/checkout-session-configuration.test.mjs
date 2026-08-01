import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import { handleCreateCheckoutSession } from '../server/api/create-checkout-session.mjs';

const catalog = JSON.parse(
  await readFile(new URL('../data/products/catalog.json', import.meta.url), 'utf8'),
).products;
const product = catalog[0];

function createRequest() {
  return new Request('https://payments.example/api/create-checkout-session', {
    method: 'POST',
    headers: {
      Origin: 'https://shop.example',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      request: {
        items: [{ page: product.page, quantity: 1 }],
        countryCode: 'NL',
      },
      customer: {
        firstname: 'Test',
        lastname: 'Buyer',
        email: 'buyer@example.com',
        street: 'Teststraat 10',
        zip: '1234 AB',
        city: 'Amsterdam',
        country: 'NL',
      },
    }),
  });
}

test('missing redirect URLs are treated as server configuration errors', async () => {
  const response = await handleCreateCheckoutSession(createRequest(), {
    env: { STRIPE_SECRET_KEY: 'sk_test_example' },
    catalogProducts: catalog,
    allowedOrigins: 'https://shop.example',
  });
  const result = await response.json();

  assert.equal(response.status, 503);
  assert.equal(result.error.code, 'MISSING_CHECKOUT_URL');
  assert.equal(result.error.message, 'Stripe test checkout is not configured.');
});

test('insecure production redirect URLs are rejected before Stripe is called', async () => {
  let stripeCalled = false;
  const response = await handleCreateCheckoutSession(createRequest(), {
    catalogProducts: catalog,
    stripeClient: {
      mode: 'test',
      async createCheckoutSession() {
        stripeCalled = true;
      },
    },
    successUrl: 'http://shop.example/success',
    cancelUrl: 'https://shop.example/cancel',
    allowedOrigins: 'https://shop.example',
  });
  const result = await response.json();

  assert.equal(response.status, 503);
  assert.equal(result.error.code, 'INVALID_CHECKOUT_URL');
  assert.equal(stripeCalled, false);
});
