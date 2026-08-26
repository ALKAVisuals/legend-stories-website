import test from 'node:test';
import assert from 'node:assert/strict';

import { createNetlifyPayPalWebhookHandler } from '../netlify/functions/paypal-webhook.mjs';

const reference = 'c'.repeat(64);
const orderId = '5O190127TN364715T';

function captureEvent(type = 'PAYMENT.CAPTURE.COMPLETED', status = 'COMPLETED') {
  return {
    id: `WH-NETLIFY-${type}`,
    event_type: type,
    create_time: '2026-08-14T13:30:05Z',
    resource: {
      id: '3Y662965014333303',
      status,
      custom_id: reference,
      amount: { value: '45.00', currency_code: 'EUR' },
      create_time: '2026-08-14T13:30:00Z',
      supplementary_data: { related_ids: { order_id: orderId } },
    },
  };
}

function request(event = captureEvent()) {
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

function env() {
  return {
    PAYPAL_CLIENT_ID: 'sandbox-client',
    PAYPAL_CLIENT_SECRET: 'sandbox-secret',
    PAYPAL_WEBHOOK_ID: '9NV123ABC456',
    NEON_DATABASE_URL: 'postgresql://legend:example@ep-paypal-pooler.eu-central-1.aws.neon.tech/neondb?sslmode=require',
  };
}

function clientFactory() {
  return {
    mode: 'test',
    async verifyWebhookSignature() {
      return { verification_status: 'SUCCESS' };
    },
  };
}

function storedOrder(status = 'payment_pending') {
  return {
    reference,
    status,
    amountTotal: 4500,
    currency: 'EUR',
    mode: 'test',
    paymentSessionId: orderId,
  };
}

test('configured Netlify webhook persists paid truth before notification reconciliation', async () => {
  let storedEvent;
  let notifiedOrder;
  let runtimeFactoryCalls = 0;
  const sequence = [];
  const handler = createNetlifyPayPalWebhookHandler({
    env: env(),
    clientFactory,
    storeFactory() {
      return {
        async getOrderByReference() {
          return storedOrder();
        },
        async processPaypalWebhookEvent(input) {
          storedEvent = input;
          sequence.push('persist');
          return { duplicate: false, order: storedOrder('paid') };
        },
      };
    },
    notificationRuntimeFactory({ env: receivedEnv }) {
      runtimeFactoryCalls += 1;
      assert.equal(receivedEnv.NEON_DATABASE_URL, env().NEON_DATABASE_URL);
      return async (order) => {
        sequence.push('notify');
        notifiedOrder = order;
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
  assert.equal(runtimeFactoryCalls, 1);
  assert.deepEqual(sequence, ['persist', 'notify']);
  assert.equal(notifiedOrder.reference, reference);
  assert.equal(notifiedOrder.status, 'paid');
});

test('notification reconciliation failure never changes an accepted paid webhook into HTTP 503', async () => {
  let persisted = false;
  const handler = createNetlifyPayPalWebhookHandler({
    env: env(),
    clientFactory,
    storeFactory() {
      return {
        async getOrderByReference() {
          return storedOrder();
        },
        async processPaypalWebhookEvent() {
          persisted = true;
          return { duplicate: false, order: storedOrder('paid') };
        },
      };
    },
    notificationRuntimeFactory() {
      return async () => {
        const error = new Error('temporary notification runtime failure');
        error.code = 'ORDER_NOTIFICATION_RUNTIME_UNAVAILABLE';
        throw error;
      };
    },
  });

  const response = await handler(request());
  const payload = await response.json();

  assert.equal(persisted, true);
  assert.equal(response.status, 200);
  assert.equal(payload.received, true);
});

test('non-paid webhook states never invoke paid-order notification reconciliation', async () => {
  let notificationCalls = 0;
  let storedTarget;
  const handler = createNetlifyPayPalWebhookHandler({
    env: env(),
    clientFactory,
    storeFactory() {
      return {
        async getOrderByReference() {
          return storedOrder();
        },
        async processPaypalWebhookEvent(input) {
          storedTarget = input.targetStatus;
          return { duplicate: false, order: storedOrder('payment_processing') };
        },
      };
    },
    notificationRuntimeFactory() {
      return async () => {
        notificationCalls += 1;
      };
    },
  });

  const response = await handler(request(captureEvent('PAYMENT.CAPTURE.PENDING', 'PENDING')));
  const payload = await response.json();

  assert.equal(response.status, 200);
  assert.equal(payload.received, true);
  assert.equal(storedTarget, 'payment_processing');
  assert.equal(notificationCalls, 0);
});

test('notification runtime bootstrap failure does not prevent verified webhook processing', async () => {
  let persisted = false;
  const handler = createNetlifyPayPalWebhookHandler({
    env: env(),
    clientFactory,
    storeFactory() {
      return {
        async getOrderByReference() {
          return storedOrder();
        },
        async processPaypalWebhookEvent() {
          persisted = true;
          return { duplicate: false, order: storedOrder('paid') };
        },
      };
    },
    notificationRuntimeFactory() {
      const error = new Error('notification bootstrap unavailable');
      error.code = 'ORDER_NOTIFICATION_RUNTIME_UNAVAILABLE';
      throw error;
    },
  });

  const response = await handler(request());
  const payload = await response.json();

  assert.equal(persisted, true);
  assert.equal(response.status, 200);
  assert.equal(payload.received, true);
});
