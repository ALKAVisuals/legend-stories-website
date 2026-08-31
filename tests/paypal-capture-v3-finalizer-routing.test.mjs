import test from 'node:test';
import assert from 'node:assert/strict';

import { handleCapturePayPalOrder } from '../server/api/capture-paypal-order.mjs';

const reference = 'b'.repeat(64);
const orderId = '5O190127TN364715T';
const captureId = '3C679366HH908993F';
const capturedAt = 1_786_104_000;

function request() {
  return new Request('https://shop.example/api/paypal/capture', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Origin: 'https://shop.example',
    },
    body: JSON.stringify({ reference, orderId }),
  });
}

function order(overrides = {}) {
  return {
    reference,
    paymentSessionId: orderId,
    mode: 'test',
    status: 'payment_pending',
    amountTotal: 4495,
    currency: 'EUR',
    updatedAt: capturedAt - 10,
    paidAt: null,
    version: 0,
    documentProfileVersion: 0,
    ...overrides,
  };
}

function paypalClient(onCapture = () => {}) {
  return {
    mode: 'test',
    async captureOrder(receivedOrderId, options) {
      onCapture(receivedOrderId, options);
      return {
        id: orderId,
        status: 'COMPLETED',
        purchase_units: [{
          reference_id: reference,
          custom_id: reference,
          payments: {
            captures: [{
              id: captureId,
              status: 'COMPLETED',
              amount: { currency_code: 'EUR', value: '44.95' },
              create_time: '2026-08-07T12:00:00Z',
            }],
          },
        }],
      };
    },
  };
}

test('profile-0 PayPal capture preserves the legacy capture-store path', async () => {
  let legacyCalls = 0;
  let finalizerCalls = 0;
  const response = await handleCapturePayPalOrder(request(), {
    orderStore: {
      async getOrderByReference() { return order(); },
      async processPaypalCapture(capture) {
        legacyCalls += 1;
        assert.equal(capture.reference, reference);
        return { duplicate: false, order: order({ status: 'paid', paidAt: capturedAt, version: 1 }) };
      },
    },
    paypalClient: paypalClient(),
    finalizePaidOrder: async () => { finalizerCalls += 1; },
    allowedOrigins: 'https://shop.example',
    capturedAt,
  });

  assert.equal(response.status, 200);
  assert.equal(legacyCalls, 1);
  assert.equal(finalizerCalls, 0);
});

test('profile-1 PayPal capture routes verified payment evidence only through the shared finalizer', async () => {
  let legacyCalls = 0;
  let finalizerInput;
  let notifiedOrder;
  const finalizedOrder = order({
    documentProfileVersion: 1,
    status: 'paid',
    paidAt: capturedAt,
    version: 1,
    orderNumber: 'TEST-ORDER-1',
    invoiceId: 1,
  });

  const response = await handleCapturePayPalOrder(request(), {
    orderStore: {
      async getOrderByReference() { return order({ documentProfileVersion: 1 }); },
      async processPaypalCapture() { legacyCalls += 1; },
    },
    paypalClient: paypalClient(),
    finalizePaidOrder: async (input) => {
      finalizerInput = input;
      return { duplicate: false, legacy: false, order: finalizedOrder, invoice: { id: 1 } };
    },
    reconcilePaidOrderNotifications: async (paidOrder) => { notifiedOrder = paidOrder; },
    allowedOrigins: 'https://shop.example',
    capturedAt,
  });
  const payload = await response.json();

  assert.equal(response.status, 200);
  assert.equal(payload.paid, true);
  assert.equal(legacyCalls, 0);
  assert.deepEqual(finalizerInput, {
    reference,
    provider: 'paypal',
    providerOrderId: orderId,
    providerCaptureId: captureId,
    source: 'paypal_capture_return',
    amountTotal: 4495,
    currency: 'EUR',
    mode: 'test',
    paidAt: capturedAt,
  });
  assert.equal(notifiedOrder.orderNumber, 'TEST-ORDER-1');
});

test('profile-1 capture fails closed before PayPal when the finalizer runtime is absent', async () => {
  let paypalCalls = 0;
  let legacyCalls = 0;
  const response = await handleCapturePayPalOrder(request(), {
    orderStore: {
      async getOrderByReference() { return order({ documentProfileVersion: 1 }); },
      async processPaypalCapture() { legacyCalls += 1; },
    },
    paypalClient: paypalClient(() => { paypalCalls += 1; }),
    allowedOrigins: 'https://shop.example',
    capturedAt,
  });
  const payload = await response.json();

  assert.equal(response.status, 503);
  assert.equal(payload.error.code, 'V3_PAID_FINALIZER_NOT_CONFIGURED');
  assert.equal(paypalCalls, 0);
  assert.equal(legacyCalls, 0);
});

test('already-paid profile-1 return verifies durable identity through the finalizer without recapturing PayPal', async () => {
  let paypalCalls = 0;
  let legacyCalls = 0;
  let finalizerInput;
  const paidOrder = order({
    documentProfileVersion: 1,
    status: 'paid',
    paidAt: capturedAt,
    version: 1,
    orderNumber: 'TEST-ORDER-1',
    invoiceId: 1,
  });

  const response = await handleCapturePayPalOrder(request(), {
    orderStore: {
      async getOrderByReference() { return paidOrder; },
      async processPaypalCapture() { legacyCalls += 1; },
    },
    paypalClient: paypalClient(() => { paypalCalls += 1; }),
    finalizePaidOrder: async (input) => {
      finalizerInput = input;
      return { duplicate: true, legacy: false, order: paidOrder, invoice: { id: 1 } };
    },
    allowedOrigins: 'https://shop.example',
  });
  const payload = await response.json();

  assert.equal(response.status, 200);
  assert.equal(payload.duplicate, true);
  assert.equal(paypalCalls, 0);
  assert.equal(legacyCalls, 0);
  assert.equal(finalizerInput.source, 'paypal_capture_duplicate_return');
  assert.equal(finalizerInput.paidAt, capturedAt);
});
