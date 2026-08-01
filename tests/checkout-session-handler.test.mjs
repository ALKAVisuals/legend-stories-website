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
      capture.called = true;
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

function fakeCheckoutStore(capture = {}, implementation = null) {
  return {
    async persistPendingCheckout(order) {
      capture.called = true;
      capture.order = order;
      if (implementation) return implementation(order);
      return { created: true, order };
    },
  };
}

const endpointOptions = Object.freeze({
  successUrl: 'https://shop.example/order-success.html',
  cancelUrl: 'https://shop.example/order-cancelled.html',
  allowedOrigins: 'https://shop.example',
});

test('endpoint returns Checkout only after the pending order is durably stored', async () => {
  const stripeCapture = {};
  const storeCapture = {};
  const response = await handleCreateCheckoutSession(requestFor(), {
    catalogProducts: catalog,
    stripeClient: fakeStripeClient(stripeCapture),
    checkoutStore: fakeCheckoutStore(storeCapture),
    createdAt: 1_800_000_000,
    ...endpointOptions,
  });
  const result = await response.json();

  assert.equal(response.status, 201);
  assert.equal(response.headers.get('access-control-allow-origin'), 'https://shop.example');
  assert.equal(result.sessionId, 'cs_test_handler');
  assert.equal(result.mode, 'test');
  assert.match(result.url, /^https:\/\/checkout\.stripe\.com\//);
  assert.equal(stripeCapture.payload.line_items[0].price_data.unit_amount > 1, true);
  assert.match(stripeCapture.options.idempotencyKey, /^legend-checkout-[a-f0-9]{64}$/);
  assert.equal(storeCapture.called, true);
  assert.equal(storeCapture.order.reference, result.reference);
  assert.equal(storeCapture.order.paymentSessionId, result.sessionId);
  assert.equal(storeCapture.order.status, 'payment_pending');
  assert.equal(storeCapture.order.amountTotal > 1, true);
  assert.equal(storeCapture.order.customer.email, payload.customer.email);
  assert.equal(storeCapture.order.items[0].name, product.name);
});

test('endpoint fails before contacting Stripe when durable storage is missing', async () => {
  const stripeCapture = {};
  const response = await handleCreateCheckoutSession(requestFor(), {
    catalogProducts: catalog,
    stripeClient: fakeStripeClient(stripeCapture),
    ...endpointOptions,
  });
  const result = await response.json();

  assert.equal(response.status, 503);
  assert.equal(result.error.code, 'CHECKOUT_STORE_NOT_CONFIGURED');
  assert.equal(stripeCapture.called, undefined);
  assert.equal(JSON.stringify(result).includes('checkout.stripe.com'), false);
});

test('endpoint never returns a Checkout URL when pending-order persistence fails', async () => {
  const stripeCapture = {};
  const response = await handleCreateCheckoutSession(requestFor(), {
    catalogProducts: catalog,
    stripeClient: fakeStripeClient(stripeCapture),
    checkoutStore: fakeCheckoutStore({}, async () => {
      const error = new Error('database unavailable');
      error.code = 'DATABASE_UNAVAILABLE';
      throw error;
    }),
    ...endpointOptions,
  });
  const result = await response.json();

  assert.equal(stripeCapture.called, true);
  assert.equal(response.status, 503);
  assert.equal(result.error.code, 'CHECKOUT_PERSISTENCE_FAILED');
  assert.equal(JSON.stringify(result).includes('checkout.stripe.com'), false);
});

test('endpoint rejects conflicting idempotent order records', async () => {
  const response = await handleCreateCheckoutSession(requestFor(), {
    catalogProducts: catalog,
    stripeClient: fakeStripeClient(),
    checkoutStore: fakeCheckoutStore({}, async (order) => ({
      created: false,
      order: { ...order, amountTotal: order.amountTotal + 1 },
    })),
    ...endpointOptions,
  });
  const result = await response.json();

  assert.equal(response.status, 409);
  assert.equal(result.error.code, 'CHECKOUT_STORE_CONFLICT');
  assert.equal(JSON.stringify(result).includes('checkout.stripe.com'), false);
});

test('endpoint rejects unapproved cross-origin requests', async () => {
  const response = await handleCreateCheckoutSession(requestFor(payload, {
    origin: 'https://attacker.example',
  }), {
    catalogProducts: catalog,
    stripeClient: fakeStripeClient(),
    checkoutStore: fakeCheckoutStore(),
    ...endpointOptions,
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
    checkoutStore: fakeCheckoutStore(),
    ...endpointOptions,
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
    checkoutStore: fakeCheckoutStore(),
    ...endpointOptions,
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
    checkoutStore: fakeCheckoutStore(),
    ...endpointOptions,
  });
  const result = await response.json();

  assert.equal(response.status, 503);
  assert.equal(result.error.code, 'MISSING_STRIPE_SECRET_KEY');
  assert.equal(JSON.stringify(result).includes('sk_'), false);
});
