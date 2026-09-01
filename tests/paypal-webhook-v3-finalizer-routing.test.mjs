import test from 'node:test';
import assert from 'node:assert/strict';

import { createPayPalWebhookReconciler } from '../server/payments/paypal-webhook-reconciliation.mjs';

const reference = 'f'.repeat(64);
const orderId = '5O190127TN364715T';
const captureId = '3Y662965014333303';
const processedAt = 1_787_200_999;

function order(overrides = {}) {
  return {
    reference,
    status: 'payment_pending',
    amountTotal: 4500,
    currency: 'EUR',
    mode: 'test',
    paymentSessionId: orderId,
    updatedAt: 1_787_200_000,
    paidAt: null,
    documentProfileVersion: 0,
    ...overrides,
  };
}

function captureEvent(type = 'PAYMENT.CAPTURE.COMPLETED', status = 'COMPLETED') {
  return {
    id: `WH-V3-${type}`,
    event_type: type,
    create_time: '2026-08-14T15:00:05Z',
    resource: {
      id: captureId,
      status,
      custom_id: reference,
      amount: { value: '45.00', currency_code: 'EUR' },
      create_time: '2026-08-14T15:00:00Z',
      supplementary_data: { related_ids: { order_id: orderId } },
    },
  };
}

function approvedEvent() {
  return {
    id: 'WH-V3-APPROVED-1',
    event_type: 'CHECKOUT.ORDER.APPROVED',
    create_time: '2026-08-14T15:00:00Z',
    resource: {
      id: orderId,
      purchase_units: [{
        custom_id: reference,
        reference_id: reference,
        amount: { value: '45.00', currency_code: 'EUR' },
      }],
    },
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
          custom_id: reference,
          reference_id: reference,
          payments: {
            captures: [{
              id: captureId,
              status: 'COMPLETED',
              amount: { value: '45.00', currency_code: 'EUR' },
              create_time: '2026-08-14T15:00:03Z',
            }],
          },
        }],
      };
    },
  };
}

test('profile-0 completed capture preserves legacy webhook store path', async () => {
  let legacyCalls = 0;
  let finalizerCalls = 0;
  const reconciler = createPayPalWebhookReconciler({
    orderStore: {
      async getOrderByReference() { return order(); },
      async processPaypalWebhookEvent(input) {
        legacyCalls += 1;
        assert.equal(input.targetStatus, 'paid');
        return { duplicate: false, order: order({ status: 'paid' }) };
      },
    },
    paypalClient: paypalClient(),
    finalizePaidOrder: async () => { finalizerCalls += 1; },
  });

  await reconciler({ event: captureEvent(), mode: 'test' });

  assert.equal(legacyCalls, 1);
  assert.equal(finalizerCalls, 0);
});

test('profile-1 completed capture routes verified event and paid evidence only through shared finalizer', async () => {
  let legacyCalls = 0;
  let finalizerInput;
  let notified;
  const finalizedOrder = order({
    status: 'paid',
    paidAt: Math.floor(Date.parse('2026-08-14T15:00:00Z') / 1000),
    documentProfileVersion: 1,
    orderNumber: 'TEST-ORDER-1',
    invoiceId: 1,
  });
  const reconciler = createPayPalWebhookReconciler({
    orderStore: {
      async getOrderByReference() { return order({ documentProfileVersion: 1 }); },
      async processPaypalWebhookEvent() { legacyCalls += 1; },
    },
    paypalClient: paypalClient(),
    webhookProcessedAt: () => processedAt,
    finalizePaidOrder: async (input) => {
      finalizerInput = input;
      return { duplicate: false, legacy: false, order: finalizedOrder, invoice: { id: 1 } };
    },
    reconcilePaidOrderNotifications: async (paidOrder) => { notified = paidOrder; },
  });

  await reconciler({ event: captureEvent(), mode: 'test' });

  assert.equal(legacyCalls, 0);
  assert.equal(finalizerInput.reference, reference);
  assert.equal(finalizerInput.provider, 'paypal');
  assert.equal(finalizerInput.providerOrderId, orderId);
  assert.equal(finalizerInput.providerCaptureId, captureId);
  assert.equal(finalizerInput.providerEventId, 'WH-V3-PAYMENT.CAPTURE.COMPLETED');
  assert.equal(finalizerInput.providerEventType, 'PAYMENT.CAPTURE.COMPLETED');
  assert.equal(finalizerInput.providerEventCreatedAt, Math.floor(Date.parse('2026-08-14T15:00:05Z') / 1000));
  assert.equal(finalizerInput.providerEventProcessedAt, processedAt);
  assert.equal(finalizerInput.source, 'paypal_webhook_capture_completed');
  assert.equal(finalizerInput.amountTotal, 4500);
  assert.equal(finalizerInput.currency, 'EUR');
  assert.equal(notified.orderNumber, 'TEST-ORDER-1');
});

test('profile-1 completed capture fails closed instead of falling back to legacy paid mutation', async () => {
  let legacyCalls = 0;
  const reconciler = createPayPalWebhookReconciler({
    orderStore: {
      async getOrderByReference() { return order({ documentProfileVersion: 1 }); },
      async processPaypalWebhookEvent() { legacyCalls += 1; },
    },
    paypalClient: paypalClient(),
  });

  await assert.rejects(
    () => reconciler({ event: captureEvent(), mode: 'test' }),
    (error) => error.code === 'V3_PAID_FINALIZER_NOT_CONFIGURED',
  );
  assert.equal(legacyCalls, 0);
});

test('profile-1 approved recovery fails before PayPal capture when V3 finalizer is inactive', async () => {
  let captureCalls = 0;
  let legacyCalls = 0;
  const reconciler = createPayPalWebhookReconciler({
    orderStore: {
      async getOrderByReference() { return order({ documentProfileVersion: 1 }); },
      async processPaypalWebhookEvent() { legacyCalls += 1; },
    },
    paypalClient: paypalClient(() => { captureCalls += 1; }),
  });

  await assert.rejects(
    () => reconciler({ event: approvedEvent(), mode: 'test' }),
    (error) => error.code === 'V3_PAID_FINALIZER_NOT_CONFIGURED',
  );
  assert.equal(captureCalls, 0);
  assert.equal(legacyCalls, 0);
});

test('profile-1 approved recovery uses stable capture idempotency then shared finalizer', async () => {
  let captureOptions;
  let finalizerInput;
  const reconciler = createPayPalWebhookReconciler({
    orderStore: {
      async getOrderByReference() { return order({ documentProfileVersion: 1 }); },
      async processPaypalWebhookEvent() { assert.fail('legacy paid mutation must not run'); },
    },
    paypalClient: paypalClient((_id, options) => { captureOptions = options; }),
    webhookProcessedAt: () => processedAt,
    finalizePaidOrder: async (input) => {
      finalizerInput = input;
      return { duplicate: false, legacy: false, order: order({ status: 'paid', documentProfileVersion: 1 }), invoice: { id: 1 } };
    },
  });

  await reconciler({ event: approvedEvent(), mode: 'test' });

  assert.equal(captureOptions.idempotencyKey, `legend-paypal-capture-${reference}`);
  assert.equal(finalizerInput.providerCaptureId, captureId);
  assert.equal(finalizerInput.providerEventId, 'WH-V3-APPROVED-1');
  assert.equal(finalizerInput.providerEventType, 'CHECKOUT.ORDER.APPROVED');
  assert.equal(finalizerInput.source, 'paypal_webhook_checkout_approved_recovery');
});

test('already-paid profile-1 approved webhook records through finalizer without recapturing PayPal', async () => {
  let captureCalls = 0;
  let finalizerInput;
  const durablePaidAt = 1_787_200_123;
  const reconciler = createPayPalWebhookReconciler({
    orderStore: {
      async getOrderByReference() {
        return order({ status: 'paid', paidAt: durablePaidAt, documentProfileVersion: 1 });
      },
      async processPaypalWebhookEvent() { assert.fail('legacy store must not process profile-1 paid event'); },
    },
    paypalClient: paypalClient(() => { captureCalls += 1; }),
    webhookProcessedAt: () => processedAt,
    finalizePaidOrder: async (input) => {
      finalizerInput = input;
      return { duplicate: true, legacy: false, order: order({ status: 'paid', paidAt: durablePaidAt, documentProfileVersion: 1 }), invoice: { id: 1 } };
    },
  });

  await reconciler({ event: approvedEvent(), mode: 'test' });

  assert.equal(captureCalls, 0);
  assert.equal(finalizerInput.paidAt, durablePaidAt);
  assert.equal(finalizerInput.providerCaptureId, null);
  assert.equal(finalizerInput.source, 'paypal_webhook_checkout_approved_existing_paid');
});

test('profile-1 non-paid capture webhook remains on existing state-machine store and never invokes finalizer', async () => {
  let legacyTarget;
  let finalizerCalls = 0;
  const reconciler = createPayPalWebhookReconciler({
    orderStore: {
      async getOrderByReference() { return order({ documentProfileVersion: 1 }); },
      async processPaypalWebhookEvent(input) {
        legacyTarget = input.targetStatus;
        return { duplicate: false, order: order({ status: 'payment_processing', documentProfileVersion: 1 }) };
      },
    },
    paypalClient: paypalClient(),
    finalizePaidOrder: async () => { finalizerCalls += 1; },
  });

  await reconciler({ event: captureEvent('PAYMENT.CAPTURE.PENDING', 'PENDING'), mode: 'test' });

  assert.equal(legacyTarget, 'payment_processing');
  assert.equal(finalizerCalls, 0);
});
