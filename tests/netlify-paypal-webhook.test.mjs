import test from 'node:test';
import assert from 'node:assert/strict';

import { createNetlifyPayPalWebhookHandler } from '../netlify/functions/paypal-webhook.mjs';
import { PayPalConfigurationError } from '../server/payments/paypal-api.mjs';

const rawBody = JSON.stringify({
  id: 'WH-NETLIFY-EVENT-1',
  event_type: 'PAYMENT.CAPTURE.COMPLETED',
});

function webhookRequest() {
  return new Request('https://staging.legendmural.example/api/paypal/webhook', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'PAYPAL-AUTH-ALGO': 'SHA256withRSA',
      'PAYPAL-CERT-URL': 'https://api.sandbox.paypal.com/v1/notifications/certs/CERT-ABC123',
      'PAYPAL-TRANSMISSION-ID': '69cd13f0-d67a-11e5-baa3-778b53f4ae55',
      'PAYPAL-TRANSMISSION-SIG': 'signature+/=',
      'PAYPAL-TRANSMISSION-TIME': '2026-08-14T12:00:01Z',
    },
    body: rawBody,
  });
}

test('sanitizes missing PayPal webhook configuration as a 503', async () => {
  const handler = createNetlifyPayPalWebhookHandler({
    env: {},
    clientFactory() {
      throw new PayPalConfigurationError(
        'PAYPAL_CREDENTIALS_NOT_CONFIGURED',
        'secret configuration detail',
      );
    },
  });

  const response = await handler(webhookRequest());
  const payload = await response.json();

  assert.equal(response.status, 503);
  assert.equal(payload.error.code, 'PAYPAL_WEBHOOK_SERVICE_NOT_CONFIGURED');
  assert.equal(JSON.stringify(payload).includes('secret configuration detail'), false);
});

test('passes only server-side PayPal configuration into the verifier client', async () => {
  let clientOptions;
  const handler = createNetlifyPayPalWebhookHandler({
    env: {
      PAYPAL_CLIENT_ID: 'sandbox-client',
      PAYPAL_CLIENT_SECRET: 'sandbox-secret',
      PAYPAL_API_BASE: 'https://api-m.sandbox.paypal.com',
      PAYPAL_ALLOW_LIVE: 'false',
      PAYPAL_WEBHOOK_ID: '9NV123ABC456',
    },
    clientFactory(options) {
      clientOptions = options;
      return {
        mode: 'test',
        async verifyWebhookSignature() {
          return { verification_status: 'SUCCESS' };
        },
      };
    },
  });

  const response = await handler(webhookRequest());
  const payload = await response.json();

  assert.deepEqual(clientOptions, {
    clientId: 'sandbox-client',
    clientSecret: 'sandbox-secret',
    apiBase: 'https://api-m.sandbox.paypal.com',
    allowLive: false,
  });
  assert.equal(response.status, 503);
  assert.equal(payload.error.code, 'PAYPAL_WEBHOOK_PROCESSOR_NOT_READY');
});

test('returns 200 only when a verified event is accepted by the injected processor', async () => {
  let processed = false;
  const handler = createNetlifyPayPalWebhookHandler({
    env: { PAYPAL_WEBHOOK_ID: '9NV123ABC456' },
    clientFactory() {
      return {
        mode: 'test',
        async verifyWebhookSignature() {
          return { verification_status: 'SUCCESS' };
        },
      };
    },
    async processVerifiedEvent({ event, mode, rawBody: receivedRawBody }) {
      processed = true;
      assert.equal(event.id, 'WH-NETLIFY-EVENT-1');
      assert.equal(mode, 'test');
      assert.equal(receivedRawBody, rawBody);
    },
  });

  const response = await handler(webhookRequest());
  assert.equal(response.status, 200);
  assert.equal(processed, true);
});
