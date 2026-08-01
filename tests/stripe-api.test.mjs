import test from 'node:test';
import assert from 'node:assert/strict';

import {
  StripeApiError,
  StripeConfigurationError,
  createStripeApiClient,
  encodeStripeForm,
} from '../server/payments/stripe-api.mjs';

test('Stripe form encoding supports nested Checkout Session parameters', () => {
  const form = encodeStripeForm({
    mode: 'payment',
    line_items: [{
      price_data: {
        currency: 'eur',
        unit_amount: 4995,
        product_data: { name: 'Legend Mural' },
      },
      quantity: 1,
    }],
    metadata: { order_reference: 'abc123' },
  });

  assert.equal(form.get('mode'), 'payment');
  assert.equal(form.get('line_items[0][price_data][currency]'), 'eur');
  assert.equal(form.get('line_items[0][price_data][unit_amount]'), '4995');
  assert.equal(form.get('line_items[0][price_data][product_data][name]'), 'Legend Mural');
  assert.equal(form.get('metadata[order_reference]'), 'abc123');
});

test('Stripe client creates test Checkout Sessions with idempotency headers', async () => {
  let captured;
  const client = createStripeApiClient({
    secretKey: 'sk_test_example',
    apiVersion: '2025-01-01.test',
    fetchImpl: async (url, options) => {
      captured = { url, options };
      return new Response(JSON.stringify({
        id: 'cs_test_example',
        url: 'https://checkout.stripe.com/c/pay/cs_test_example',
        payment_status: 'unpaid',
        livemode: false,
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json', 'request-id': 'req_123' },
      });
    },
  });

  const session = await client.createCheckoutSession({ mode: 'payment' }, {
    idempotencyKey: 'legend-checkout-hash',
  });

  assert.equal(client.mode, 'test');
  assert.equal(session.id, 'cs_test_example');
  assert.equal(session.requestId, 'req_123');
  assert.equal(captured.url, 'https://api.stripe.com/v1/checkout/sessions');
  assert.equal(captured.options.headers.Authorization, 'Bearer sk_test_example');
  assert.equal(captured.options.headers['Idempotency-Key'], 'legend-checkout-hash');
  assert.equal(captured.options.headers['Stripe-Version'], '2025-01-01.test');
});

test('live Stripe keys are blocked unless explicitly enabled', () => {
  assert.throws(
    () => createStripeApiClient({ secretKey: 'sk_live_example', fetchImpl: async () => {} }),
    (error) => {
      assert.ok(error instanceof StripeConfigurationError);
      assert.equal(error.code, 'LIVE_STRIPE_KEY_BLOCKED');
      return true;
    },
  );

  const liveClient = createStripeApiClient({
    secretKey: 'sk_live_example',
    allowLive: true,
    fetchImpl: async () => {},
  });
  assert.equal(liveClient.mode, 'live');
});

test('Stripe API errors are normalized without exposing the secret key', async () => {
  const client = createStripeApiClient({
    secretKey: 'sk_test_private_value',
    fetchImpl: async () => new Response(JSON.stringify({
      error: { message: 'Invalid request' },
    }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    }),
  });

  await assert.rejects(
    () => client.createCheckoutSession({ mode: 'payment' }),
    (error) => {
      assert.ok(error instanceof StripeApiError);
      assert.equal(error.code, 'STRIPE_REQUEST_FAILED');
      assert.equal(error.message, 'Invalid request');
      assert.equal(error.message.includes('sk_test_private_value'), false);
      return true;
    },
  );
});
