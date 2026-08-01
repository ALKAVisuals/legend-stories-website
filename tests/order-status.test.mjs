import test from 'node:test';
import assert from 'node:assert/strict';

import {
  OrderStatusError,
  createOrderStatusUpdate,
  createPendingOrderRecord,
} from '../server/orders/order-status.mjs';

const reference = 'b'.repeat(64);

function paymentEvent(overrides = {}) {
  return {
    eventId: 'evt_test_payment',
    eventType: 'checkout.session.completed',
    created: 1_800_000_000,
    livemode: false,
    ignored: false,
    reference,
    sessionId: 'cs_test_order_status',
    amountTotal: 5390,
    currency: 'EUR',
    paymentStatus: 'paid',
    status: 'paid',
    ...overrides,
  };
}

test('creates a pending order and transitions it to paid from a matching signed event', () => {
  const order = createPendingOrderRecord({
    reference,
    amountTotal: 5390,
    mode: 'test',
    paymentSessionId: 'cs_test_order_status',
    createdAt: 1_799_999_000,
  });
  const updated = createOrderStatusUpdate(order, paymentEvent());

  assert.equal(order.status, 'payment_pending');
  assert.equal(updated.status, 'paid');
  assert.equal(updated.paidAt, 1_800_000_000);
  assert.equal(updated.lastStripeEventId, 'evt_test_payment');
  assert.equal(updated.version, 1);
});

test('a paid order cannot regress when failure or expiry events arrive later', () => {
  const paid = createOrderStatusUpdate(
    createPendingOrderRecord({
      reference,
      amountTotal: 5390,
      mode: 'test',
      paymentSessionId: 'cs_test_order_status',
      createdAt: 1_799_999_000,
    }),
    paymentEvent(),
  );

  for (const status of ['payment_failed', 'expired', 'payment_processing']) {
    const updated = createOrderStatusUpdate(paid, paymentEvent({
      eventId: `evt_test_${status}`,
      eventType: status === 'expired'
        ? 'checkout.session.expired'
        : 'checkout.session.async_payment_failed',
      paymentStatus: 'unpaid',
      status,
      created: paid.updatedAt + 1,
    }));
    assert.equal(updated.status, 'paid');
    assert.equal(updated.paidAt, paid.paidAt);
  }
});

test('older non-paid events cannot overwrite a newer non-paid state', () => {
  const pending = createPendingOrderRecord({
    reference,
    amountTotal: 5390,
    mode: 'test',
    paymentSessionId: 'cs_test_order_status',
    createdAt: 1_799_999_000,
  });
  const processing = createOrderStatusUpdate(pending, paymentEvent({
    eventId: 'evt_test_processing_new',
    eventType: 'checkout.session.completed',
    created: 1_800_000_100,
    paymentStatus: 'unpaid',
    status: 'payment_processing',
  }));
  const olderFailure = createOrderStatusUpdate(processing, paymentEvent({
    eventId: 'evt_test_failure_old',
    eventType: 'checkout.session.async_payment_failed',
    created: 1_800_000_050,
    paymentStatus: 'unpaid',
    status: 'payment_failed',
  }));

  assert.equal(olderFailure.status, 'payment_processing');
  assert.equal(olderFailure.updatedAt, processing.updatedAt);
  assert.equal(olderFailure.lastStripeEventId, processing.lastStripeEventId);
  assert.equal(olderFailure.lastStripeEventCreated, processing.lastStripeEventCreated);
  assert.equal(olderFailure.version, processing.version + 1);
});

test('a signed paid event may recover a non-paid order state even when delivered later', () => {
  const failed = createOrderStatusUpdate(
    createPendingOrderRecord({
      reference,
      amountTotal: 5390,
      mode: 'test',
      paymentSessionId: 'cs_test_order_status',
      createdAt: 1_799_999_000,
    }),
    paymentEvent({
      eventId: 'evt_test_failed',
      eventType: 'checkout.session.async_payment_failed',
      paymentStatus: 'unpaid',
      status: 'payment_failed',
    }),
  );
  assert.equal(failed.status, 'payment_failed');

  const paid = createOrderStatusUpdate(failed, paymentEvent({
    eventId: 'evt_test_recovered',
    eventType: 'checkout.session.async_payment_succeeded',
    created: failed.updatedAt + 1,
  }));
  assert.equal(paid.status, 'paid');
});

test('an older signed paid event remains authoritative over a newer non-paid state', () => {
  const processing = createOrderStatusUpdate(
    createPendingOrderRecord({
      reference,
      amountTotal: 5390,
      mode: 'test',
      paymentSessionId: 'cs_test_order_status',
      createdAt: 1_799_999_000,
    }),
    paymentEvent({
      eventId: 'evt_test_processing_latest',
      created: 1_800_000_200,
      paymentStatus: 'unpaid',
      status: 'payment_processing',
    }),
  );

  const paid = createOrderStatusUpdate(processing, paymentEvent({
    eventId: 'evt_test_paid_older',
    eventType: 'checkout.session.async_payment_succeeded',
    created: 1_800_000_150,
  }));

  assert.equal(paid.status, 'paid');
  assert.equal(paid.paidAt, 1_800_000_150);
  assert.equal(paid.updatedAt, processing.updatedAt);
  assert.equal(paid.lastStripeEventId, 'evt_test_paid_older');
  assert.equal(paid.lastStripeEventCreated, processing.lastStripeEventCreated);
});

test('stored Checkout Session identity must match the order mode', () => {
  assert.throws(
    () => createPendingOrderRecord({
      reference,
      amountTotal: 5390,
      mode: 'test',
      paymentSessionId: 'cs_live_wrong_mode',
    }),
    (error) => error instanceof OrderStatusError && error.code === 'INVALID_ORDER',
  );
});

test('rejects mismatched amount, currency, mode, reference and session identity', () => {
  const order = createPendingOrderRecord({
    reference,
    amountTotal: 5390,
    mode: 'test',
    paymentSessionId: 'cs_test_order_status',
    createdAt: 1_799_999_000,
  });

  for (const [event, code] of [
    [paymentEvent({ amountTotal: 1 }), 'ORDER_AMOUNT_MISMATCH'],
    [paymentEvent({ currency: 'USD' }), 'ORDER_CURRENCY_MISMATCH'],
    [paymentEvent({ livemode: true }), 'ORDER_MODE_MISMATCH'],
    [paymentEvent({ reference: 'c'.repeat(64) }), 'ORDER_REFERENCE_MISMATCH'],
    [paymentEvent({ sessionId: 'cs_test_other' }), 'ORDER_SESSION_MISMATCH'],
  ]) {
    assert.throws(
      () => createOrderStatusUpdate(order, event),
      (error) => error instanceof OrderStatusError && error.code === code,
    );
  }
});
