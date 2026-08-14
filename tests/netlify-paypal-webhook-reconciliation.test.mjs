import test from 'node:test';
import assert from 'node:assert/strict';

import { createNetlifyPayPalWebhookHandler } from '../netlify/functions/paypal-webhook.mjs';

const reference = 'c'.repeat(64);
const orderId = '5O190127TN364715T';
const event = {
  id: 'WH-NETLIFY-RECONCILE-1',
  event_type: 'PAYMENT.CAPTURE.COMPLETED',
  create_time: '2026-08-14T13:30:05Z',
  resource: {
    id: '3Y662965014333303',
    status: 'COMPLETED',
    custom_id: reference,
    amount: { value: '45.00', currency_code: 'EUR' },
    create_time: '2026-08-14T13:30:00Z',
    supplementary_data: { related_ids: { order_id: orderId } },
  },
};

function request() {
  return new Request('https://staging.legendmural.example/api/paypal/webhook', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'PAYPAL-AUTH-ALGO': 'SHA256withRSA',
      'PAYPAL-CERT-URL': 'https://api.sandbox.paypal.com/v1/notifications/certs/CERT-ABC123',
      'PAYPAL-TRANSMISSION-ID': '69cd13f0-d67a-11e5-baa3-778b53f4ae55',
      'PAYPAL-TRANSMISSION-SIG': 'signature+/=',
      'PAYPAL-TRANSMISSION-TIME': '2026-08-14T13:30:06Z',
    },
    body: JSON.stringify(event),
  });
}

test('configured Netlify webhook verifies and reconciles through the shared store', async () => {
  let storedEvent;
  const handler = createNetlifyPayPalWebhookHandler({
    env: {
      PAYPAL_CLIENT_ID: 'sandbox-client',
      PAYPAL_CLIENT_SECRET: 'sandbox-secret',
      PAYPAL_WEBHOOK_ID: '9NV123ABC456',
      NEON_DATABASE_URL: 'postgresql://legend:example@ep-paypal-pooler.eu-central-1.aws.neon.tech/neondb?sslmode=require',
    },
    clientFactory() {
      return {
        mode: 'test',
        async verifyWebhookSignature() {
          return { verification_status: 'SUCCESS' };
        },
      };
    },
    storeFactory() {
      return {
        async getOrderByReference() {
          return {
            reference,
            status: 'payment_pending',
            amountTotal: 4500,
            currency: 'EUR',
            mode: 'test',
            paymentSessionId: orderId,
          };
        },
        async processPaypalWebhookEvent(input) {
          storedEvent = input;
          return { duplicate: false, order: { status: 'paid' } };
        },
      };
    },
  });

  const response = await handler(request());
  const payload = await response.json();
  assert.equal(response.status, 200);
  assert.equal(payload.received, true);
  assert.equal(storedEvent.reference, reference);
  assert.equal(storedEvent.orderId, orderId);
  assert.equal(storedEvent.targetStatus, 'paid');
});
