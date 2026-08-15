import test from 'node:test';
import assert from 'node:assert/strict';

import {
  PayPalConfigurationError,
  createPayPalApiClient,
  normalizePayPalOrderId,
} from '../server/payments/paypal-api.mjs';

test('PayPal client defaults to Sandbox and sends idempotent Orders API requests', async () => {
  const calls = [];
  const client = createPayPalApiClient({
    clientId: 'sandbox-client',
    clientSecret: 'sandbox-secret',
    fetchImpl: async (url, options) => {
      calls.push({ url, options });
      if (url.endsWith('/v1/oauth2/token')) {
        return new Response(JSON.stringify({ access_token: 'sandbox-access-token' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      return new Response(JSON.stringify({
        id: '5O190127TN364715T',
        status: 'CREATED',
        links: [],
      }), {
        status: 201,
        headers: { 'Content-Type': 'application/json' },
      });
    },
  });

  const order = await client.createOrder({ intent: 'CAPTURE' }, {
    idempotencyKey: 'legend-paypal-create-test',
  });

  assert.equal(client.mode, 'test');
  assert.equal(order.id, '5O190127TN364715T');
  assert.equal(calls.length, 2);
  assert.equal(calls[0].url, 'https://api-m.sandbox.paypal.com/v1/oauth2/token');
  assert.match(calls[0].options.headers.Authorization, /^Basic /);
  assert.equal(calls[1].url, 'https://api-m.sandbox.paypal.com/v2/checkout/orders');
  assert.equal(calls[1].options.headers.Authorization, 'Bearer sandbox-access-token');
  assert.equal(calls[1].options.headers['PayPal-Request-Id'], 'legend-paypal-create-test');
  assert.equal(calls[1].options.headers.Prefer, 'return=representation');
});

test('PayPal client posts a prebuilt raw webhook verification body without reserializing it', async () => {
  const calls = [];
  const client = createPayPalApiClient({
    clientId: 'sandbox-client',
    clientSecret: 'sandbox-secret',
    fetchImpl: async (url, options) => {
      calls.push({ url, options });
      if (url.endsWith('/v1/oauth2/token')) {
        return new Response(JSON.stringify({ access_token: 'sandbox-access-token' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      return new Response(JSON.stringify({ verification_status: 'SUCCESS' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    },
  });
  const rawVerificationBody = '{"auth_algo":"SHA256withRSA","webhook_event":{\n  "id" : "WH-TEST", "event_type" : "PAYMENT.CAPTURE.COMPLETED"\n}}';

  const result = await client.verifyWebhookSignature(rawVerificationBody);

  assert.equal(result.verification_status, 'SUCCESS');
  assert.equal(calls.length, 2);
  assert.equal(
    calls[1].url,
    'https://api-m.sandbox.paypal.com/v1/notifications/verify-webhook-signature',
  );
  assert.equal(calls[1].options.method, 'POST');
  assert.equal(calls[1].options.headers.Authorization, 'Bearer sandbox-access-token');
  assert.equal(calls[1].options.body, rawVerificationBody);
});

test('PayPal live API is blocked unless explicitly enabled', () => {
  assert.throws(
    () => createPayPalApiClient({
      clientId: 'live-client',
      clientSecret: 'live-secret',
      apiBase: 'https://api-m.paypal.com',
      fetchImpl: async () => {},
    }),
    (error) => error instanceof PayPalConfigurationError
      && error.code === 'PAYPAL_LIVE_NOT_ALLOWED',
  );

  const liveClient = createPayPalApiClient({
    clientId: 'live-client',
    clientSecret: 'live-secret',
    apiBase: 'https://api-m.paypal.com',
    allowLive: true,
    fetchImpl: async () => {},
  });
  assert.equal(liveClient.mode, 'live');
});

test('PayPal client rejects unofficial API origins', () => {
  assert.throws(
    () => createPayPalApiClient({
      clientId: 'client',
      clientSecret: 'secret',
      apiBase: 'https://paypal.attacker.example',
      fetchImpl: async () => {},
    }),
    (error) => error instanceof PayPalConfigurationError
      && error.code === 'UNTRUSTED_PAYPAL_API_BASE',
  );
});

test('PayPal order IDs are normalized and validated before server calls', () => {
  assert.equal(normalizePayPalOrderId(' 5o190127tn364715t '), '5O190127TN364715T');
  assert.throws(() => normalizePayPalOrderId('bad/order?id=1'), /invalid/i);
});
