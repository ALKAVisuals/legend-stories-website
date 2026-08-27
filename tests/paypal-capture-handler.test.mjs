import test from 'node:test';
import assert from 'node:assert/strict';

import { createNetlifyPayPalCaptureHandler } from '../netlify/functions/capture-paypal-order.mjs';
import { handleCapturePayPalOrder } from '../server/api/capture-paypal-order.mjs';
import { PayPalApiError } from '../server/payments/paypal-api.mjs';
import { createPayPalWebhookReconciler } from '../server/payments/paypal-webhook-reconciliation.mjs';

const reference = 'a'.repeat(64);
const orderId = '5O190127TN364715T';

function request(body = { reference, orderId }) {
  return new Request('https://shop.example/api/paypal/capture', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Origin: 'https://shop.example',
    },
    body: JSON.stringify(body),
  });
}

function reservedOrder(overrides = {}) {
  return {
    reference,
    paymentSessionId: orderId,
    mode: 'test',
    status: 'payment_pending',
    amountTotal: 4495,
    currency: 'EUR',
    updatedAt: 1_786_104_000,
    version: 0,
    ...overrides,
  };
}

function completedCapture() {
  return {
    id: orderId,
    status: 'COMPLETED',
    purchase_units: [{
      reference_id: reference,
      custom_id: reference,
      payments: {
        captures: [{
          id: '3C679366HH908993F',
          status: 'COMPLETED',
          amount: { currency_code: 'EUR', value: '44.95' },
          create_time: '2026-08-07T12:00:00Z',
        }],
      },
    }],
  };
}

function completedCaptureEvent() {
  return {
    id: 'WH-CAPTURE-RECOVERY-1',
    event_type: 'PAYMENT.CAPTURE.COMPLETED',
    create_time: '2026-08-07T12:00:02Z',
    resource: {
      id: '3C679366HH908993F',
      status: 'COMPLETED',
      custom_id: reference,
      amount: { currency_code: 'EUR', value: '44.95' },
      create_time: '2026-08-07T12:00:00Z',
      supplementary_data: { related_ids: { order_id: orderId } },
    },
  };
}

test('already-paid PayPal return is idempotent without a second PayPal capture call', async () => {
  let captureCalls = 0;
  let notificationCalls = 0;
  let notifiedOrder;
  const store = {
    async getOrderByReference() {
      return reservedOrder({ status: 'paid', version: 1 });
    },
    async processPaypalCapture() {
      throw new Error('must not be called');
    },
  };
  const response = await handleCapturePayPalOrder(request(), {
    orderStore: store,
    paypalClient: {
      mode: 'test',
      async captureOrder() {
        captureCalls += 1;
      },
    },
    reconcilePaidOrderNotifications: async (order) => {
      notificationCalls += 1;
      notifiedOrder = order;
    },
    allowedOrigins: 'https://shop.example',
  });
  const payload = await response.json();

  assert.equal(response.status, 200);
  assert.equal(payload.paid, true);
  assert.equal(payload.duplicate, true);
  assert.equal(captureCalls, 0);
  assert.equal(notificationCalls, 1);
  assert.equal(notifiedOrder.status, 'paid');
});

test('approved PayPal order is captured, persisted as paid, then reconciles notifications', async () => {
  let persisted;
  let notifiedOrder;
  const sequence = [];
  const store = {
    async getOrderByReference(receivedReference) {
      assert.equal(receivedReference, reference);
      return reservedOrder();
    },
    async processPaypalCapture(capture) {
      persisted = capture;
      sequence.push('persist');
      return {
        duplicate: false,
        order: reservedOrder({ status: 'paid', version: 1 }),
      };
    },
  };
  const client = {
    mode: 'test',
    async captureOrder(receivedOrderId, options) {
      assert.equal(receivedOrderId, orderId);
      assert.equal(options.idempotencyKey, `legend-paypal-capture-${reference}`);
      return completedCapture();
    },
  };

  const response = await handleCapturePayPalOrder(request(), {
    orderStore: store,
    paypalClient: client,
    reconcilePaidOrderNotifications: async (order) => {
      sequence.push('notify');
      notifiedOrder = order;
    },
    allowedOrigins: 'https://shop.example',
    capturedAt: 1_786_104_001,
  });
  const payload = await response.json();

  assert.equal(response.status, 200);
  assert.equal(payload.status, 'paid');
  assert.equal(payload.paid, true);
  assert.equal(payload.duplicate, false);
  assert.equal(persisted.reference, reference);
  assert.equal(persisted.orderId, orderId);
  assert.equal(persisted.amountTotal, 4495);
  assert.equal(persisted.mode, 'test');
  assert.deepEqual(sequence, ['persist', 'notify']);
  assert.equal(notifiedOrder.status, 'paid');
  assert.equal(notifiedOrder.version, 1);
});

test('notification reconciliation failure never turns a persisted paid capture into payment failure', async () => {
  const response = await handleCapturePayPalOrder(request(), {
    orderStore: {
      async getOrderByReference() { return reservedOrder(); },
      async processPaypalCapture() {
        return {
          duplicate: false,
          order: reservedOrder({ status: 'paid', version: 1 }),
        };
      },
    },
    paypalClient: {
      mode: 'test',
      async captureOrder() { return completedCapture(); },
    },
    async reconcilePaidOrderNotifications() {
      const error = new Error('temporary notification runtime failure');
      error.code = 'ORDER_NOTIFICATION_RUNTIME_UNAVAILABLE';
      throw error;
    },
    allowedOrigins: 'https://shop.example',
  });
  const payload = await response.json();

  assert.equal(response.status, 200);
  assert.equal(payload.status, 'paid');
  assert.equal(payload.paid, true);
  assert.equal(payload.duplicate, false);
});

test('PayPal capture lookup cannot be swapped to another reserved order ID', async () => {
  const store = {
    async getOrderByReference() {
      return reservedOrder({ paymentSessionId: '1AB23456CD789012E' });
    },
    async processPaypalCapture() {},
  };
  const response = await handleCapturePayPalOrder(request(), {
    orderStore: store,
    paypalClient: { mode: 'test', async captureOrder() {} },
    allowedOrigins: 'https://shop.example',
  });
  const payload = await response.json();

  assert.equal(response.status, 404);
  assert.equal(payload.error.code, 'ORDER_NOT_FOUND');
});

test('temporary PayPal API failure never persists a local paid state or reconciles notifications', async () => {
  let persistCalls = 0;
  let notificationCalls = 0;
  const response = await handleCapturePayPalOrder(request(), {
    orderStore: {
      async getOrderByReference() { return reservedOrder(); },
      async processPaypalCapture() { persistCalls += 1; },
    },
    paypalClient: {
      mode: 'test',
      async captureOrder() {
        throw new PayPalApiError('PAYPAL_API_REQUEST_FAILED', 'temporary upstream failure');
      },
    },
    async reconcilePaidOrderNotifications() {
      notificationCalls += 1;
    },
    allowedOrigins: 'https://shop.example',
  });
  const payload = await response.json();

  assert.equal(response.status, 502);
  assert.equal(payload.error.code, 'PAYPAL_API_REQUEST_FAILED');
  assert.equal(persistCalls, 0);
  assert.equal(notificationCalls, 0);
});

test('Netlify PayPal capture wrapper wires the paid-order notification runtime', async () => {
  let runtimeFactoryCalls = 0;
  let notifiedOrder;
  const handler = createNetlifyPayPalCaptureHandler({
    env: {
      NEON_DATABASE_URL: 'test-neon-connection',
      CHECKOUT_ALLOWED_ORIGINS: 'https://shop.example',
    },
    storeFactory({ connectionString }) {
      assert.equal(connectionString, 'test-neon-connection');
      return {
        async getOrderByReference() { return reservedOrder(); },
        async processPaypalCapture() {
          return {
            duplicate: false,
            order: reservedOrder({ status: 'paid', version: 1 }),
          };
        },
      };
    },
    notificationRuntimeFactory({ env }) {
      runtimeFactoryCalls += 1;
      assert.equal(env.NEON_DATABASE_URL, 'test-neon-connection');
      return async (order) => {
        notifiedOrder = order;
      };
    },
    handlerOptions: {
      paypalClient: {
        mode: 'test',
        async captureOrder() { return completedCapture(); },
      },
      capturedAt: 1_786_104_001,
    },
  });

  const response = await handler(request());
  const payload = await response.json();

  assert.equal(response.status, 200);
  assert.equal(payload.paid, true);
  assert.equal(runtimeFactoryCalls, 1);
  assert.equal(notifiedOrder.status, 'paid');
});

test('completed webhook recovers a capture when local Neon confirmation failed after PayPal success', async () => {
  let current = reservedOrder();
  let captureCalls = 0;

  const captureResponse = await handleCapturePayPalOrder(request(), {
    orderStore: {
      async getOrderByReference() { return current; },
      async processPaypalCapture() {
        const error = new Error('temporary Neon failure');
        error.code = 'PAYPAL_CAPTURE_STORE_UNAVAILABLE';
        throw error;
      },
    },
    paypalClient: {
      mode: 'test',
      async captureOrder() {
        captureCalls += 1;
        return completedCapture();
      },
    },
    allowedOrigins: 'https://shop.example',
  });
  const capturePayload = await captureResponse.json();

  assert.equal(captureResponse.status, 503);
  assert.equal(capturePayload.error.code, 'PAYPAL_CAPTURE_STORE_UNAVAILABLE');
  assert.equal(captureCalls, 1);
  assert.equal(current.status, 'payment_pending');

  const reconciler = createPayPalWebhookReconciler({
    orderStore: {
      async getOrderByReference() { return current; },
      async processPaypalWebhookEvent(event) {
        assert.equal(event.targetStatus, 'paid');
        current = reservedOrder({
          status: 'paid',
          version: 1,
          updatedAt: event.mutationAt,
          paidAt: event.mutationAt,
        });
        return { duplicate: false, order: current };
      },
    },
    paypalClient: { mode: 'test' },
  });

  const recovered = await reconciler({ event: completedCaptureEvent(), mode: 'test' });
  assert.equal(recovered.order.status, 'paid');
  assert.equal(recovered.order.version, 1);
  assert.equal(current.status, 'paid');
});
