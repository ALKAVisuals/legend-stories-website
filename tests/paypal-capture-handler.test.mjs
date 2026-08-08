import test from 'node:test';
import assert from 'node:assert/strict';

import { handleCapturePayPalOrder } from '../server/api/capture-paypal-order.mjs';

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

test('already-paid PayPal return is idempotent without a second PayPal capture call', async () => {
  let captureCalls = 0;
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
    allowedOrigins: 'https://shop.example',
  });
  const payload = await response.json();

  assert.equal(response.status, 200);
  assert.equal(payload.paid, true);
  assert.equal(payload.duplicate, true);
  assert.equal(captureCalls, 0);
});

test('approved PayPal order is captured and persisted as paid', async () => {
  let persisted;
  const store = {
    async getOrderByReference(receivedReference) {
      assert.equal(receivedReference, reference);
      return reservedOrder();
    },
    async processPaypalCapture(capture) {
      persisted = capture;
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
