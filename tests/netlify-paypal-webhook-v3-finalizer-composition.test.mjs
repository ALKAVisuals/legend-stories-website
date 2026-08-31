import test from 'node:test';
import assert from 'node:assert/strict';

import { createNetlifyPayPalWebhookHandler } from '../netlify/functions/paypal-webhook.mjs';

const reference = '1'.repeat(64);
const orderId = '5O190127TN364715T';
const captureId = '3Y662965014333303';
const databaseUrl = 'postgresql://test:test@ep-test.neon.tech/neondb?sslmode=require';

function event() {
  return {
    id: 'WH-NETLIFY-V3-1',
    event_type: 'PAYMENT.CAPTURE.COMPLETED',
    create_time: '2026-08-14T16:00:05Z',
    resource: {
      id: captureId,
      status: 'COMPLETED',
      custom_id: reference,
      amount: { value: '45.00', currency_code: 'EUR' },
      create_time: '2026-08-14T16:00:00Z',
      supplementary_data: { related_ids: { order_id: orderId } },
    },
  };
}

function request() {
  return new Request('https://shop.example/api/paypal/webhook', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'PAYPAL-AUTH-ALGO': 'SHA256withRSA',
      'PAYPAL-CERT-URL': 'https://api.sandbox.paypal.com/v1/notifications/certs/CERT-ABC123',
      'PAYPAL-TRANSMISSION-ID': '69cd13f0-d67a-11e5-baa3-778b53f4ae55',
      'PAYPAL-TRANSMISSION-SIG': 'signature+/=',
      'PAYPAL-TRANSMISSION-TIME': '2026-08-14T16:00:06Z',
    },
    body: JSON.stringify(event()),
  });
}

function env() {
  return {
    PAYPAL_CLIENT_ID: 'sandbox-client',
    PAYPAL_CLIENT_SECRET: 'sandbox-secret',
    PAYPAL_WEBHOOK_ID: '9NV123ABC456',
    NEON_DATABASE_URL: databaseUrl,
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

function profile1Order(overrides = {}) {
  return {
    reference,
    status: 'payment_pending',
    amountTotal: 4500,
    currency: 'EUR',
    mode: 'test',
    paymentSessionId: orderId,
    updatedAt: 1_787_300_000,
    paidAt: null,
    documentProfileVersion: 1,
    ...overrides,
  };
}

function storeFactory() {
  return {
    async getOrderByReference() { return profile1Order(); },
    async processPaypalWebhookEvent() {
      assert.fail('profile-1 paid webhook must never fall back to legacy store mutation');
    },
  };
}

function notificationRuntimeFactory() {
  return async () => {};
}

test('Netlify webhook keeps profile-1 inactive and returns retryable failure without legacy mutation', async () => {
  const handler = createNetlifyPayPalWebhookHandler({
    env: env(),
    clientFactory,
    storeFactory,
    notificationRuntimeFactory,
  });

  const response = await handler(request());
  const payload = await response.json();

  assert.equal(response.status, 503);
  assert.equal(payload.error.code, 'PAYPAL_WEBHOOK_PROCESSING_FAILED');
});

test('explicit complete V3 config composes the shared finalizer and atomic event recorder for webhook paid path', async () => {
  let factoryOptions;
  let finalizerInput;
  const numberingPolicy = {
    resolveSeriesKey() { return 'synthetic-webhook-series'; },
    format({ documentType, value }) { return `TEST-${documentType.toUpperCase()}-${value}`; },
  };
  const documentContextProvider = async () => ({
    seller: { synthetic: true },
    billingAddress: { synthetic: true },
    tax: { synthetic: true },
  });
  const handler = createNetlifyPayPalWebhookHandler({
    env: env(),
    clientFactory,
    storeFactory,
    notificationRuntimeFactory,
    v3PaidFinalization: {
      enabled: true,
      numberingPolicy,
      documentContextProvider,
    },
    v3PaidFinalizerFactory: (options) => {
      factoryOptions = options;
      return {
        async finalizePaidOrder(input) {
          finalizerInput = input;
          return {
            duplicate: false,
            legacy: false,
            order: profile1Order({
              status: 'paid',
              paidAt: input.paidAt,
              orderNumber: 'TEST-ORDER-1',
              invoiceId: 1,
            }),
            invoice: { id: 1, invoiceNumber: 'TEST-INVOICE-1' },
          };
        },
      };
    },
    reconcilerOptions: {
      webhookProcessedAt: () => 1_787_300_999,
    },
  });

  const response = await handler(request());
  const payload = await response.json();

  assert.equal(response.status, 200);
  assert.equal(payload.received, true);
  assert.equal(factoryOptions.connectionString, databaseUrl);
  assert.equal(factoryOptions.numberingPolicy, numberingPolicy);
  assert.equal(factoryOptions.documentContextProvider, documentContextProvider);
  assert.equal(typeof factoryOptions.providerEventRecorder, 'function');
  assert.equal(finalizerInput.providerEventId, 'WH-NETLIFY-V3-1');
  assert.equal(finalizerInput.providerEventType, 'PAYMENT.CAPTURE.COMPLETED');
  assert.equal(finalizerInput.providerCaptureId, captureId);
  assert.equal(finalizerInput.providerEventProcessedAt, 1_787_300_999);
});
