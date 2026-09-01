import test from 'node:test';
import assert from 'node:assert/strict';

import { createNetlifyPayPalCaptureHandler } from '../netlify/functions/capture-paypal-order.mjs';

const reference = 'c'.repeat(64);
const orderId = '5O190127TN364715T';
const captureId = '3C679366HH908993F';
const capturedAt = 1_786_104_000;
const databaseUrl = 'postgresql://test:test@ep-test.neon.tech/neondb?sslmode=require';

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
    paymentProvider: 'paypal',
    mode: 'test',
    status: 'payment_pending',
    amountTotal: 4495,
    currency: 'EUR',
    createdAt: capturedAt - 100,
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

function baseHandlerOptions(client) {
  return {
    paypalClient: client,
    allowedOrigins: 'https://shop.example',
    capturedAt,
  };
}

function notificationRuntimeFactory() {
  return async () => {};
}

test('Netlify capture keeps profile-1 inactive and rejects before contacting PayPal', async () => {
  let captureCalls = 0;
  let legacyCalls = 0;
  const storeFactory = () => ({
    async getOrderByReference() { return order({ documentProfileVersion: 1 }); },
    async processPaypalCapture() { legacyCalls += 1; },
  });

  const handler = createNetlifyPayPalCaptureHandler({
    env: { NEON_DATABASE_URL: databaseUrl },
    storeFactory,
    notificationRuntimeFactory,
    handlerOptions: baseHandlerOptions(paypalClient(() => { captureCalls += 1; })),
  });

  const response = await handler(request());
  const payload = await response.json();

  assert.equal(response.status, 503);
  assert.equal(payload.error.code, 'V3_PAID_FINALIZER_NOT_CONFIGURED');
  assert.equal(captureCalls, 0);
  assert.equal(legacyCalls, 0);
});

test('incomplete V3 activation config cannot disturb the profile-0 legacy capture path', async () => {
  let captureCalls = 0;
  let legacyCalls = 0;
  let finalizerFactoryCalls = 0;
  const storeFactory = () => ({
    async getOrderByReference() { return order(); },
    async processPaypalCapture() {
      legacyCalls += 1;
      return {
        duplicate: false,
        order: order({ status: 'paid', paidAt: capturedAt, updatedAt: capturedAt, version: 1 }),
      };
    },
  });

  const handler = createNetlifyPayPalCaptureHandler({
    env: { NEON_DATABASE_URL: databaseUrl },
    storeFactory,
    notificationRuntimeFactory,
    v3PaidFinalization: { enabled: true },
    v3PaidFinalizerFactory: () => {
      finalizerFactoryCalls += 1;
      throw new Error('must not be created from incomplete config');
    },
    handlerOptions: baseHandlerOptions(paypalClient(() => { captureCalls += 1; })),
  });

  const response = await handler(request());
  const payload = await response.json();

  assert.equal(response.status, 200);
  assert.equal(payload.paid, true);
  assert.equal(captureCalls, 1);
  assert.equal(legacyCalls, 1);
  assert.equal(finalizerFactoryCalls, 0);
});

test('explicit complete server-side V3 config composes the shared finalizer for profile-1 capture', async () => {
  let captureCalls = 0;
  let legacyCalls = 0;
  let finalizerFactoryOptions;
  let finalizerInput;
  const numberingPolicy = {
    resolveSeriesKey() { return 'synthetic-test-series'; },
    format({ documentType, value }) { return `TEST-${documentType.toUpperCase()}-${value}`; },
  };
  const documentContextProvider = async () => ({
    seller: { synthetic: true },
    billingAddress: { synthetic: true },
    tax: { synthetic: true },
  });
  const finalizedOrder = order({
    documentProfileVersion: 1,
    status: 'paid',
    paidAt: capturedAt,
    updatedAt: capturedAt,
    version: 1,
    orderNumber: 'TEST-ORDER-1',
    orderNumberAssignedAt: capturedAt,
    invoiceId: 1,
  });
  const storeFactory = () => ({
    async getOrderByReference() { return order({ documentProfileVersion: 1 }); },
    async processPaypalCapture() { legacyCalls += 1; },
  });

  const handler = createNetlifyPayPalCaptureHandler({
    env: { NEON_DATABASE_URL: databaseUrl },
    storeFactory,
    notificationRuntimeFactory,
    v3PaidFinalization: {
      enabled: true,
      numberingPolicy,
      documentContextProvider,
    },
    v3PaidFinalizerFactory: (options) => {
      finalizerFactoryOptions = options;
      return {
        async finalizePaidOrder(input) {
          finalizerInput = input;
          return {
            duplicate: false,
            legacy: false,
            order: finalizedOrder,
            invoice: { id: 1, invoiceNumber: 'TEST-INVOICE-1' },
          };
        },
      };
    },
    handlerOptions: baseHandlerOptions(paypalClient(() => { captureCalls += 1; })),
  });

  const response = await handler(request());
  const payload = await response.json();

  assert.equal(response.status, 200);
  assert.equal(payload.paid, true);
  assert.equal(captureCalls, 1);
  assert.equal(legacyCalls, 0);
  assert.equal(finalizerFactoryOptions.connectionString, databaseUrl);
  assert.equal(finalizerFactoryOptions.numberingPolicy, numberingPolicy);
  assert.equal(finalizerFactoryOptions.documentContextProvider, documentContextProvider);
  assert.equal(finalizerInput.reference, reference);
  assert.equal(finalizerInput.provider, 'paypal');
  assert.equal(finalizerInput.providerOrderId, orderId);
  assert.equal(finalizerInput.providerCaptureId, captureId);
  assert.equal(finalizerInput.source, 'paypal_capture_return');
});
