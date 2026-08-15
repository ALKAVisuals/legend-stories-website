import test from 'node:test';
import assert from 'node:assert/strict';

import {
  HostedCheckoutClientError,
  isHostedCheckoutConfigured,
  normalizeHostedCheckoutEndpoint,
  requestHostedCheckout,
} from '../js/commerce/checkout-client.mjs';

const payload = Object.freeze({
  request: {
    items: [{ page: 'combat-grind-cycle.html', quantity: 1 }],
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

function validResponse(overrides = {}) {
  return {
    provider: 'stripe',
    sessionId: 'cs_test_browser_checkout',
    url: 'https://checkout.stripe.com/c/pay/cs_test_browser_checkout',
    mode: 'test',
    reference: 'a'.repeat(64),
    ...overrides,
  };
}

test('hosted checkout remains disabled when no endpoint is configured', () => {
  assert.equal(normalizeHostedCheckoutEndpoint('', 'https://shop.example'), '');
  assert.equal(isHostedCheckoutConfigured('', 'https://shop.example'), false);
});

test('endpoint configuration requires HTTPS outside local development', () => {
  assert.equal(
    normalizeHostedCheckoutEndpoint('/api/create-checkout-session', 'https://shop.example'),
    'https://shop.example/api/create-checkout-session',
  );
  assert.equal(
    normalizeHostedCheckoutEndpoint('http://localhost:8888/api/checkout'),
    'http://localhost:8888/api/checkout',
  );
  assert.throws(
    () => normalizeHostedCheckoutEndpoint('http://payments.example/api/checkout'),
    (error) => error instanceof HostedCheckoutClientError
      && error.code === 'INVALID_CHECKOUT_ENDPOINT',
  );
});

test('browser sends only the trusted request and customer payload', async () => {
  const capture = {};
  const checkout = await requestHostedCheckout({
    endpoint: '/api/create-checkout-session',
    baseUrl: 'https://shop.example',
    payload: {
      ...payload,
      displayTotals: { grandTotal: 0.01 },
      browserPrice: 0.01,
    },
    fetchImpl: async (url, options) => {
      capture.url = url;
      capture.options = options;
      return new Response(JSON.stringify(validResponse()), {
        status: 201,
        headers: { 'Content-Type': 'application/json' },
      });
    },
  });

  assert.equal(capture.url, 'https://shop.example/api/create-checkout-session');
  assert.equal(capture.options.method, 'POST');
  assert.equal(capture.options.credentials, 'omit');
  const body = JSON.parse(capture.options.body);
  assert.deepEqual(Object.keys(body).sort(), ['customer', 'request']);
  assert.deepEqual(body, payload);
  assert.equal(checkout.provider, 'stripe');
  assert.equal(checkout.sessionId, 'cs_test_browser_checkout');
  assert.equal(checkout.mode, 'test');
});

test('browser rejects checkout responses without an explicit provider', async () => {
  const responseBody = validResponse();
  delete responseBody.provider;

  await assert.rejects(
    () => requestHostedCheckout({
      endpoint: 'https://payments.example/api/checkout',
      payload,
      fetchImpl: async () => new Response(JSON.stringify(responseBody), {
        status: 201,
        headers: { 'Content-Type': 'application/json' },
      }),
    }),
    (error) => error instanceof HostedCheckoutClientError
      && error.code === 'INVALID_CHECKOUT_RESPONSE',
  );
});

test('browser rejects unexpected Stripe redirects and mismatched modes', async () => {
  for (const responseBody of [
    validResponse({ url: 'https://attacker.example/checkout' }),
    validResponse({ mode: 'live' }),
  ]) {
    await assert.rejects(
      () => requestHostedCheckout({
        endpoint: 'https://payments.example/api/checkout',
        payload,
        fetchImpl: async () => new Response(JSON.stringify(responseBody), {
          status: 201,
          headers: { 'Content-Type': 'application/json' },
        }),
      }),
      (error) => error instanceof HostedCheckoutClientError
        && error.code === 'INVALID_CHECKOUT_RESPONSE',
    );
  }
});

test('browser surfaces sanitized endpoint errors without accepting a redirect', async () => {
  await assert.rejects(
    () => requestHostedCheckout({
      endpoint: 'https://payments.example/api/checkout',
      payload,
      fetchImpl: async () => new Response(JSON.stringify({
        error: {
          code: 'INVALID_DISCOUNT_CODE',
          message: 'The discount code is invalid.',
        },
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      }),
    }),
    (error) => {
      assert.ok(error instanceof HostedCheckoutClientError);
      assert.equal(error.code, 'INVALID_DISCOUNT_CODE');
      assert.equal(error.details.status, 400);
      return true;
    },
  );
});

test('browser classifies aborted endpoint requests as checkout timeouts', async () => {
  await assert.rejects(
    () => requestHostedCheckout({
      endpoint: 'https://payments.example/api/checkout',
      payload,
      fetchImpl: async () => {
        const error = new Error('aborted');
        error.name = 'AbortError';
        throw error;
      },
    }),
    (error) => error instanceof HostedCheckoutClientError
      && error.code === 'CHECKOUT_TIMEOUT',
  );
});

test('browser rejects incomplete payloads before making a network request', async () => {
  let called = false;
  await assert.rejects(
    () => requestHostedCheckout({
      endpoint: 'https://payments.example/api/checkout',
      payload: { request: payload.request },
      fetchImpl: async () => {
        called = true;
      },
    }),
    (error) => error instanceof HostedCheckoutClientError
      && error.code === 'INVALID_CHECKOUT_PAYLOAD',
  );
  assert.equal(called, false);
});
