import test from 'node:test';
import assert from 'node:assert/strict';

import {
  PayPalWebhookVerificationError,
  buildPayPalWebhookVerificationPayload,
  verifyPayPalWebhookSignature,
} from '../server/payments/paypal-webhook-verification.mjs';

const rawBody = JSON.stringify({
  id: 'WH-TEST-EVENT-1',
  event_type: 'PAYMENT.CAPTURE.COMPLETED',
  create_time: '2026-08-14T12:00:00Z',
  resource: { id: 'CAPTURE123' },
});

function paypalHeaders(overrides = {}) {
  return new Headers({
    'PAYPAL-AUTH-ALGO': 'SHA256withRSA',
    'PAYPAL-CERT-URL': 'https://api.paypal.com/v1/notifications/certs/CERT-ABC123',
    'PAYPAL-TRANSMISSION-ID': '69cd13f0-d67a-11e5-baa3-778b53f4ae55',
    'PAYPAL-TRANSMISSION-SIG': 'signature+/=',
    'PAYPAL-TRANSMISSION-TIME': '2026-08-14T12:00:01Z',
    ...overrides,
  });
}

test('builds the official PayPal postback verification payload from headers and event JSON', () => {
  const verification = buildPayPalWebhookVerificationPayload({
    headers: paypalHeaders(),
    rawBody,
    webhookId: '9NV123ABC456',
  });

  assert.equal(verification.payload.auth_algo, 'SHA256withRSA');
  assert.equal(verification.payload.webhook_id, '9NV123ABC456');
  assert.equal(verification.payload.transmission_id, '69cd13f0-d67a-11e5-baa3-778b53f4ae55');
  assert.equal(verification.payload.webhook_event.id, 'WH-TEST-EVENT-1');
  assert.equal(verification.event.event_type, 'PAYMENT.CAPTURE.COMPLETED');
});

test('accepts only SUCCESS from the PayPal verification endpoint', async () => {
  let capturedPayload;
  const result = await verifyPayPalWebhookSignature({
    paypalClient: {
      mode: 'test',
      async verifyWebhookSignature(payload) {
        capturedPayload = payload;
        return { verification_status: 'SUCCESS' };
      },
    },
    headers: paypalHeaders(),
    rawBody,
    webhookId: '9NV123ABC456',
  });

  assert.equal(result.verified, true);
  assert.equal(result.mode, 'test');
  assert.equal(result.event.id, 'WH-TEST-EVENT-1');
  assert.equal(capturedPayload.webhook_event.event_type, 'PAYMENT.CAPTURE.COMPLETED');
});

test('rejects a PayPal FAILURE verification result', async () => {
  await assert.rejects(
    () => verifyPayPalWebhookSignature({
      paypalClient: {
        mode: 'test',
        async verifyWebhookSignature() {
          return { verification_status: 'FAILURE' };
        },
      },
      headers: paypalHeaders(),
      rawBody,
      webhookId: '9NV123ABC456',
    }),
    (error) => error instanceof PayPalWebhookVerificationError
      && error.code === 'PAYPAL_WEBHOOK_SIGNATURE_INVALID',
  );
});

test('rejects malformed JSON before contacting PayPal', async () => {
  let called = false;
  await assert.rejects(
    () => verifyPayPalWebhookSignature({
      paypalClient: {
        async verifyWebhookSignature() {
          called = true;
          return { verification_status: 'SUCCESS' };
        },
      },
      headers: paypalHeaders(),
      rawBody: '{not-json',
      webhookId: '9NV123ABC456',
    }),
    (error) => error.code === 'PAYPAL_WEBHOOK_BODY_INVALID',
  );
  assert.equal(called, false);
});

test('rejects missing signature headers and invalid webhook configuration', () => {
  assert.throws(
    () => buildPayPalWebhookVerificationPayload({
      headers: paypalHeaders({ 'PAYPAL-TRANSMISSION-SIG': '' }),
      rawBody,
      webhookId: '9NV123ABC456',
    }),
    (error) => error.code === 'PAYPAL_WEBHOOK_HEADERS_INVALID',
  );

  assert.throws(
    () => buildPayPalWebhookVerificationPayload({
      headers: paypalHeaders(),
      rawBody,
      webhookId: 'not valid with spaces',
    }),
    (error) => error.code === 'PAYPAL_WEBHOOK_ID_NOT_CONFIGURED',
  );
});
