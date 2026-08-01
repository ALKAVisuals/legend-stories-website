import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import { handleCreateCheckoutSession } from '../server/api/create-checkout-session.mjs';

const catalog = JSON.parse(
  await readFile(new URL('../data/products/catalog.json', import.meta.url), 'utf8'),
).products;
const product = catalog[0];

const payload = Object.freeze({
  request: {
    items: [{ page: product.page, quantity: 1, price: 0.01 }],
    countryCode: 'NL',
    discountCode: 'LEGEND10',
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
});

function requestFor(body = payload, {
  method = 'POST',
  origin = 'https://shop.example',
  contentType = 'application/json',
} = {}) {
  return new Request('https://payments.example/api/create-checkout-session', {
    method,
    headers: {
      ...(origin ? { Origin: origin } : {}),
      ...(contentType ? { 'Content-Type': contentType } : {}),
    },
    ...(method === 'POST' ? { body: JSON.stringify(body) } : {}),
  });
}

function fakeStripeClient(capture = {}) {
  return {
    mode: 'test',
    async createCheckoutSession(stripePayload, options) {
      capture.payload = stripePayload;
      capture.options = options;
      return {
        id: 'cs_test_handler',
        url: 'https://checkout.stripe.com/c/pay/cs_test_handler',
        livemode: false,
      };
    },
  };
}

test('endpoint creates a test Checkout Session from the authoritative catalog', async () => {
  const capture = {};
  const response = await handleCreateCheckoutSession(requestFor(), {
    catalogProducts: catalog,
    stripeClient: fakeStripeClient(capture),
    successUrl: 'https://shop.example/order-success.html',
    cancelUrl: 'https://shop.example/order-cancelled.html',
    allowedOrigins: 'https://shop.example',
  });
  const result = await response.json();

  assert.equal(response.status, 201);
  assert.equal(response.headers.get('access-control-allow-origin'), 'https://shop.example');
  assert.equal(result.sessionId, 'cs_test_handler');
  assert.equal(result.mode, 'test');
  assert.match(result.url, /^https:\/\/checkout\.stripe\.com\//);
  assert.equal(capture.payload.line_items[0].price_data.unit_amount > 1, true);
  assert.match(capture.options.idempotencyKey, /^legend-checkout-[a-f0-9]{64}$/);
});

test('endpoint rejects unapproved cross-origin requests', async () => {
  const response = await handleCreateCheckoutSession(requestFor(payload, {
    origin: 'https://attacker.example',
  }), {
    catalogProducts: catalog,
    stripeClient: fakeStripeClient(),
    successUrl: 'https://shop.example/success',
    cancelUrl: 'https://shop.example/cancel',
    allowedOrigins: 'https://shop.example',
  });
  const result = await response.json();

  assert.equal(response.status, 403);
  assert.equal(result.error.code, 'ORIGIN_NOT_ALLOWED');
});

test('endpoint rejects unsupported methods and content types', async () => {
  const methodResponse = await handleCreateCheckoutSession(requestFor(null, {
    method: 'GET',
  }), {
    allowedOrigins: 'https://shop.example',
  });
  assert.equal(methodResponse.status, 405);

  const contentTypeResponse = await handleCreateCheckoutSession(requestFor(payload, {
    contentType: 'text/plain',
  }), {
    catalogProducts: catalog,
    stripeClient: fakeStripeClient(),
    successUrl: 'https://shop.example/success',
    cancelUrl: 'https://shop.example/cancel',
    allowedOrigins: 'https://shop.example',
  });
  const result = await contentTypeResponse.json();
  assert.equal(contentTypeResponse.status, 400);
  assert.equal(result.error.code, 'UNSUPPORTED_CONTENT_TYPE');
});

test('endpoint does not start Stripe when the order request is invalid', async () => {
  let called = false;
  const response = await handleCreateCheckoutSession(requestFor({
    ...payload,
    request: {
      items: [{ page: 'missing-product.html', quantity: 1 }],
      countryCode: 'NL',
    },
  }), {
    catalogProducts: catalog,
    stripeClient: {
      mode: 'test',
      async createCheckoutSession() {
        called = true;
      },
    },
    successUrl: 'https://shop.example/success',
    cancelUrl: 'https://shop.example/cancel',
    allowedOrigins: 'https://shop.example',
  });
  const result = await response.json();

  assert.equal(response.status, 400);
  assert.equal(result.error.code, 'UNKNOWN_PRODUCT');
  assert.equal(called, false);
});

test('endpoint reports unavailable Stripe configuration without exposing secrets', async () => {
  const response = await handleCreateCheckoutSession(requestFor(), {
    env: {},
    catalogProducts: catalog,
    successUrl: 'https://shop.example/success',
    cancelUrl: 'https://shop.example/cancel',
    allowedOrigins: 'https://shop.example',
  });
  const result = await response.json();

  assert.equal(response.status, 503);
  assert.equal(result.error.code, 'MISSING_STRIPE_SECRET_KEY');
  assert.equal(JSON.stringify(result).includes('sk_'), false);
});
