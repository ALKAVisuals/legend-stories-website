import test from 'node:test';
import assert from 'node:assert/strict';

import { createPayPalWebhookReconciler } from '../server/payments/paypal-webhook-reconciliation.mjs';

const reference = 'a'.repeat(64);
const orderId = '5O190127TN364715T';
const captureId = '3Y662965014333303';

function order(overrides = {}) {
  return {
    reference,
    status: 'payment_pending',
    amountTotal: 4500,
    currency: 'EUR',
    mode: 'test',
    paymentSessionId: orderId,
    updatedAt: 1_800_000_000,
    ...overrides,
  };
}

function captureEvent(type = 'PAYMENT.CAPTURE.COMPLETED', status = 'COMPLETED') {
  return {
    id: 'WH-CAPTURE-EVENT-1',
    event_type: type,
    create_time: '2026-08-14T13:00:05Z',
    resource: {
      id: captureId,
      status,
      custom_id: reference,
      amount: { value: '45.00', currency_code: 'EUR' },
      create_time: '2026-08-14T13:00:00Z',
      supplementary_data: { related_ids: { order_id: orderId } },
    },
  };
}

function approvedEvent() {
  return {
    id: 'WH-APPROVED-EVENT-1',
    event_type: 'CHECKOUT.ORDER.APPROVED',
    create_time: '2026-08-14T13:00:00Z',
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

test('completed capture reconciles the matching PayPal order to paid', async () => {
  let stored;
  const reconciler = createPayPalWebhookReconciler({
    orderStore: {
      async getOrderByReference() { return order(); },
      async processPaypalWebhookEvent(event) {
        stored = event;
        return { duplicate: false, order: order({ status: 'paid' }) };
      },
    },
    paypalClient: { mode: 'test' },
  });

  const result = await reconciler({ event: captureEvent(), mode: 'test' });
  assert.equal(result.order.status, 'paid');
  assert.equal(stored.reference, reference);
  assert.equal(stored.orderId, orderId);
  assert.equal(stored.captureId, captureId);
  assert.equal(stored.amountTotal, 4500);
  assert.equal(stored.currency, 'EUR');
  assert.equal(stored.targetStatus, 'paid');
});

test('approved order performs recovery capture with the stable browser idempotency key', async () => {
  let captureOptions;
  let stored;
  const reconciler = createPayPalWebhookReconciler({
    orderStore: {
      async getOrderByReference() { return order(); },
      async processPaypalWebhookEvent(event) {
        stored = event;
        return { duplicate: false, order: order({ status: 'paid' }) };
      },
    },
    paypalClient: {
      mode: 'test',
      async captureOrder(receivedOrderId, options) {
        assert.equal(receivedOrderId, orderId);
        captureOptions = options;
        return {
          id: orderId,
          status: 'COMPLETED',
          purchase_units: [{
            custom_id: reference,
            reference_id: reference,
            payments: { captures: [{
              id: captureId,
              status: 'COMPLETED',
              amount: { value: '45.00', currency_code: 'EUR' },
              create_time: '2026-08-14T13:00:03Z',
            }] },
          }],
        };
      },
    },
    fallbackCapturedAt: () => 1_786_713_603,
  });

  await reconciler({ event: approvedEvent(), mode: 'test' });
  assert.equal(captureOptions.idempotencyKey, `legend-paypal-capture-${reference}`);
  assert.equal(stored.captureId, captureId);
  assert.equal(stored.targetStatus, 'paid');
});

test('already paid approved order does not call PayPal capture again', async () => {
  let captureCalls = 0;
  const reconciler = createPayPalWebhookReconciler({
    orderStore: {
      async getOrderByReference() { return order({ status: 'paid' }); },
      async processPaypalWebhookEvent(event) {
        assert.equal(event.targetStatus, 'paid');
        return { duplicate: false, order: order({ status: 'paid' }) };
      },
    },
    paypalClient: {
      mode: 'test',
      async captureOrder() { captureCalls += 1; },
    },
  });

  await reconciler({ event: approvedEvent(), mode: 'test' });
  assert.equal(captureCalls, 0);
});

test('pending and declined V2 events map to non-paid states', async () => {
  const targets = [];
  const reconciler = createPayPalWebhookReconciler({
    orderStore: {
      async getOrderByReference() { return order(); },
      async processPaypalWebhookEvent(event) {
        targets.push(event.targetStatus);
        return { duplicate: false, order: order() };
      },
    },
    paypalClient: { mode: 'test' },
  });

  await reconciler({ event: captureEvent('PAYMENT.CAPTURE.PENDING', 'PENDING'), mode: 'test' });
  await reconciler({ event: captureEvent('PAYMENT.CAPTURE.DECLINED', 'DECLINED'), mode: 'test' });
  assert.deepEqual(targets, ['payment_processing', 'payment_failed']);
});

test('refund and reversal events stay verified-but-ignored until their state machine exists', async () => {
  let storeCalls = 0;
  const reconciler = createPayPalWebhookReconciler({
    orderStore: {
      async getOrderByReference() { storeCalls += 1; },
      async processPaypalWebhookEvent() { storeCalls += 1; },
    },
    paypalClient: { mode: 'test' },
  });
  for (const eventType of ['PAYMENT.CAPTURE.REFUNDED', 'PAYMENT.CAPTURE.REVERSED']) {
    const result = await reconciler({ event: { id: `WH-${eventType}`, event_type: eventType }, mode: 'test' });
    assert.equal(result.ignored, true);
  }
  assert.equal(storeCalls, 0);
});

test('mismatched approved amount is rejected before recovery capture', async () => {
  let captureCalls = 0;
  const mismatched = approvedEvent();
  mismatched.resource.purchase_units[0].amount.value = '44.99';
  const reconciler = createPayPalWebhookReconciler({
    orderStore: {
      async getOrderByReference() { return order(); },
      async processPaypalWebhookEvent() { assert.fail('must not persist mismatch'); },
    },
    paypalClient: {
      mode: 'test',
      async captureOrder() { captureCalls += 1; },
    },
  });

  await assert.rejects(
    () => reconciler({ event: mismatched, mode: 'test' }),
    (error) => error.code === 'PAYPAL_WEBHOOK_ORDER_MISMATCH',
  );
  assert.equal(captureCalls, 0);
});

test('unsupported verified events are safely ignored', async () => {
  const reconciler = createPayPalWebhookReconciler({
    orderStore: {
      async getOrderByReference() { assert.fail('must not lookup'); },
      async processPaypalWebhookEvent() { assert.fail('must not persist'); },
    },
    paypalClient: { mode: 'test' },
  });
  const result = await reconciler({
    event: { id: 'WH-X', event_type: 'CATALOG.PRODUCT.CREATED' },
    mode: 'test',
  });
  assert.equal(result.ignored, true);
});
