import test from 'node:test';
import assert from 'node:assert/strict';

import { handlePayPalWebhook } from '../server/api/paypal-webhook.mjs';

const webhookId = '9NV123ABC456';
const rawBody = JSON.stringify({
  id: 'WH-TEST-EVENT-2',
  event_type: 'CHECKOUT.ORDER.APPROVED',
  create_time: '2026-08-14T12:00:00Z',
  resource: { id: '5O190127TN364715T' },
});

function request(method = 'POST', overrides = {}) {
  return new Request('https://legendmural.example/api/paypal/webhook', {
    method,
    headers: {
      'Content-Type': 'application/json',
      'PAYPAL-AUTH-ALGO': 'SHA256withRSA',
      'PAYPAL-CERT-URL': 'https://api.paypal.com/v1/notifications/certs/CERT-ABC123',
      'PAYPAL-TRANSMISSION-ID': '69cd13f0-d67a-11e5-baa3-778b53f4ae55',
      'PAYPAL-TRANSMISSION-SIG': 'signature+/=',
      'PAYPAL-TRANSMISSION-TIME': '2026-08-14T12:00:01Z',
      ...(overrides.headers || {}),
    },
    ...(method === 'POST' ? { body: overrides.body ?? rawBody } : {}),
  });
}

function paypalClient(verificationStatus = 'SUCCESS') {
  return {
    mode: 'test',
    async verifyWebhookSignature() {
      return { verification_status: verificationStatus };
    },
  };
}

test('rejects methods other than POST', async () => {
  const response = await handlePayPalWebhook(request('GET'), {
    paypalClient: paypalClient(),
    webhookId,
  });
  assert.equal(response.status, 405);
  assert.equal(response.headers.get('allow'), 'POST');
});

test('rejects non-JSON webhook requests', async () => {
  const response = await handlePayPalWebhook(request('POST', {
    headers: { 'Content-Type': 'text/plain' },
  }), {
    paypalClient: paypalClient(),
    webhookId,
  });
  assert.equal(response.status, 415);
});

test('does not acknowledge a verified event before the reconciliation processor exists', async () => {
  const response = await handlePayPalWebhook(request(), {
    paypalClient: paypalClient('SUCCESS'),
    webhookId,
  });
  const payload = await response.json();
  assert.equal(response.status, 503);
  assert.equal(payload.error.code, 'PAYPAL_WEBHOOK_PROCESSOR_NOT_READY');
});

test('acknowledges only after a verified event has been handed to the processor', async () => {
  let processed;
  const response = await handlePayPalWebhook(request(), {
    paypalClient: paypalClient('SUCCESS'),
    webhookId,
    async processVerifiedEvent(input) {
      processed = input;
    },
  });
  const payload = await response.json();

  assert.equal(response.status, 200);
  assert.deepEqual(payload, { received: true });
  assert.equal(processed.event.id, 'WH-TEST-EVENT-2');
  assert.equal(processed.mode, 'test');
  assert.equal(processed.rawBody, rawBody);
});

test('returns 401 for a signature PayPal marks as invalid', async () => {
  const response = await handlePayPalWebhook(request(), {
    paypalClient: paypalClient('FAILURE'),
    webhookId,
    async processVerifiedEvent() {
      assert.fail('Invalid signatures must never reach the processor.');
    },
  });
  const payload = await response.json();

  assert.equal(response.status, 401);
  assert.equal(payload.error.code, 'PAYPAL_WEBHOOK_SIGNATURE_INVALID');
});

test('returns retryable 503 when PayPal verification is unavailable', async () => {
  const response = await handlePayPalWebhook(request(), {
    paypalClient: {
      mode: 'test',
      async verifyWebhookSignature() {
        const error = new Error('temporary PayPal outage');
        error.code = 'PAYPAL_API_REQUEST_FAILED';
        throw error;
      },
    },
    webhookId,
    async processVerifiedEvent() {
      assert.fail('Unverified events must never reach the processor.');
    },
  });
  const payload = await response.json();

  assert.equal(response.status, 503);
  assert.equal(payload.error.code, 'PAYPAL_WEBHOOK_VERIFICATION_UNAVAILABLE');
});
