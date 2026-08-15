import test from 'node:test';
import assert from 'node:assert/strict';

import { createPayPalWebhookReconciler } from '../server/payments/paypal-webhook-reconciliation.mjs';

test('verified webhook mode must match the PayPal API client mode before order access', async () => {
  const reconciler = createPayPalWebhookReconciler({
    orderStore: {
      async getOrderByReference() { assert.fail('must not query order on mode mismatch'); },
      async processPaypalWebhookEvent() { assert.fail('must not mutate order on mode mismatch'); },
    },
    paypalClient: { mode: 'test' },
  });

  await assert.rejects(
    () => reconciler({
      mode: 'live',
      event: {
        id: 'WH-MODE-MISMATCH-1',
        event_type: 'PAYMENT.CAPTURE.COMPLETED',
      },
    }),
    (error) => error.code === 'PAYPAL_WEBHOOK_MODE_MISMATCH',
  );
});
