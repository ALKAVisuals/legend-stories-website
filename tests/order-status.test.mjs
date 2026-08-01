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

test('a paid order cannot regress when older failure or expiry events arrive later', () => {
  const paid = createOrderStatusUpdate(
    createPendingOrderRecord({
      reference,
      amountTotal: 5390,
      mode: 'test',
      paymentSessionId: 'cs_test_order_status',
    }),
    paymentEvent(),
  );

  for (const status of ['payment_failed', 'expired', 'payment_processing']) {
    const updated = createOrderStatusUpdate(paid, paymentEvent({
      eventId: `evt_test_${status}`,
      eventType: status === 'expired'
        ? 'checkout.session.expired'
        : 'checkout.session.async_payment_failed',
      status,
      created: paid.updatedAt + 1,
    }));
    assert.equal(updated.status, 'paid');
    assert.equal(updated.paidAt, paid.paidAt);
  }
});

test('a signed paid event may recover a non-paid order state', () => {
  const failed = createOrderStatusUpdate(
    createPendingOrderRecord({
      reference,
      amountTotal: 5390,
      mode: 'test',
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

test('rejects mismatched amount, currency, mode, reference and session identity', () => {
  const order = createPendingOrderRecord({
    reference,
    amountTotal: 5390,
    mode: 'test',
    paymentSessionId: 'cs_test_order_status',
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
