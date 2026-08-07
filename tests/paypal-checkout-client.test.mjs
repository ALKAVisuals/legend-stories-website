import test from 'node:test';
import assert from 'node:assert/strict';

import {
  HostedCheckoutClientError,
  requestHostedCheckout,
} from '../js/commerce/checkout-client.mjs';

const payload = Object.freeze({
  request: {
    items: [{ page: 'combat-grind-cycle.html', quantity: 1 }],
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
});

function paypalResponse(overrides = {}) {
  return {
    provider: 'paypal',
    sessionId: '5O190127TN364715T',
    url: 'https://www.sandbox.paypal.com/checkoutnow?token=5O190127TN364715T',
    mode: 'test',
    reference: 'a'.repeat(64),
    ...overrides,
  };
}

test('browser accepts a trusted PayPal Sandbox hosted checkout response', async () => {
  const checkout = await requestHostedCheckout({
    endpoint: '/api/paypal/checkout',
    baseUrl: 'https://shop.example',
    payload,
    fetchImpl: async () => new Response(JSON.stringify(paypalResponse()), {
      status: 201,
      headers: { 'Content-Type': 'application/json' },
    }),
  });

  assert.equal(checkout.provider, 'paypal');
  assert.equal(checkout.sessionId, '5O190127TN364715T');
  assert.equal(checkout.mode, 'test');
  assert.match(checkout.url, /^https:\/\/www\.sandbox\.paypal\.com\//);
});

test('browser rejects PayPal redirects outside the reported environment', async () => {
  for (const response of [
    paypalResponse({ url: 'https://www.paypal.com/checkoutnow?token=5O190127TN364715T' }),
    paypalResponse({ url: 'https://attacker.example/checkout' }),
    paypalResponse({ sessionId: 'bad/order' }),
  ]) {
    await assert.rejects(
      () => requestHostedCheckout({
        endpoint: '/api/paypal/checkout',
        baseUrl: 'https://shop.example',
        payload,
        fetchImpl: async () => new Response(JSON.stringify(response), {
          status: 201,
          headers: { 'Content-Type': 'application/json' },
        }),
      }),
      (error) => error instanceof HostedCheckoutClientError
        && error.code === 'INVALID_CHECKOUT_RESPONSE',
    );
  }
});
