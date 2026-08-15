import test from 'node:test';
import assert from 'node:assert/strict';

import { createPayPalWebhookReconciler } from '../server/payments/paypal-webhook-reconciliation.mjs';

const reference = 'd'.repeat(64);
const orderId = '5O190127TN364715T';

test('approval reversal uses resource.order_id and custom_id without requiring amount fields', async () => {
  let stored;
  const reconciler = createPayPalWebhookReconciler({
    orderStore: {
      async getOrderByReference(receivedReference) {
        assert.equal(receivedReference, reference);
        return {
          reference,
          status: 'payment_processing',
          amountTotal: 4500,
          currency: 'EUR',
          mode: 'test',
          paymentSessionId: orderId,
        };
      },
      async processPaypalWebhookEvent(event) {
        stored = event;
        return { duplicate: false, order: { status: 'payment_failed' } };
      },
    },
    paypalClient: { mode: 'test' },
  });

  const result = await reconciler({
    mode: 'test',
    event: {
      id: 'WH-APPROVAL-REVERSED-1',
      create_time: '2026-08-14T13:45:00Z',
      event_type: 'CHECKOUT.PAYMENT-APPROVAL.REVERSED',
      resource: {
        order_id: orderId,
        purchase_units: [{ custom_id: reference }],
      },
    },
  });

  assert.equal(result.order.status, 'payment_failed');
  assert.equal(stored.orderId, orderId);
  assert.equal(stored.reference, reference);
  assert.equal(stored.amountTotal, null);
  assert.equal(stored.targetStatus, 'payment_failed');
});
