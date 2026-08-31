import test from 'node:test';
import assert from 'node:assert/strict';

import {
  NeonPayPalWebhookEventRecorderError,
  recordPayPalWebhookEventInTransaction,
} from '../server/adapters/neon-paypal-webhook-event-recorder.mjs';

const reference = 'd'.repeat(64);

function payment(overrides = {}) {
  return {
    reference,
    provider: 'paypal',
    providerOrderId: '5O190127TN364715T',
    providerCaptureId: '3Y662965014333303',
    providerEventId: 'WH-V3-EVENT-1',
    providerEventType: 'PAYMENT.CAPTURE.COMPLETED',
    providerEventCreatedAt: 1_787_000_005,
    providerEventProcessedAt: 1_787_000_010,
    mode: 'test',
    ...overrides,
  };
}

function storedEvent(overrides = {}) {
  return {
    event_id: 'WH-V3-EVENT-1',
    event_type: 'PAYMENT.CAPTURE.COMPLETED',
    order_reference: reference,
    paypal_order_id: '5O190127TN364715T',
    paypal_capture_id: '3Y662965014333303',
    mode: 'test',
    paypal_created_at: 1_787_000_005,
    ...overrides,
  };
}

test('new webhook event is reserved on the supplied transaction client only', async () => {
  const calls = [];
  const client = {
    async query(sql, params) {
      calls.push({ sql, params });
      return { rows: [{ event_id: 'WH-V3-EVENT-1' }] };
    },
  };

  const result = await recordPayPalWebhookEventInTransaction({ client, payment: payment() });

  assert.equal(result.duplicate, false);
  assert.equal(result.eventId, 'WH-V3-EVENT-1');
  assert.equal(calls.length, 1);
  assert.match(calls[0].sql, /INSERT INTO legend_commerce\.paypal_webhook_events/);
  assert.equal(calls[0].params[0], 'WH-V3-EVENT-1');
  assert.equal(calls[0].params[4], '3Y662965014333303');
  assert.equal(calls[0].params[7], 1_787_000_010);
});

test('approved event ledger identity excludes recovery capture ID so duplicate delivery stays stable', async () => {
  const calls = [];
  const approvedPayment = payment({
    providerEventId: 'WH-V3-APPROVED-1',
    providerEventType: 'CHECKOUT.ORDER.APPROVED',
  });
  const client = {
    async query(sql, params) {
      calls.push({ sql, params });
      return { rows: [{ event_id: 'WH-V3-APPROVED-1' }] };
    },
  };

  const result = await recordPayPalWebhookEventInTransaction({ client, payment: approvedPayment });

  assert.equal(result.duplicate, false);
  assert.equal(calls[0].params[4], null);
  assert.equal(approvedPayment.providerCaptureId, '3Y662965014333303');
});

test('duplicate event reuses the ledger row only when provider identity matches exactly', async () => {
  let calls = 0;
  const client = {
    async query(sql) {
      calls += 1;
      if (sql.includes('INSERT INTO')) return { rows: [] };
      return { rows: [storedEvent()] };
    },
  };

  const result = await recordPayPalWebhookEventInTransaction({ client, payment: payment() });

  assert.equal(result.duplicate, true);
  assert.equal(calls, 2);
});

test('duplicate event ID with conflicting identity hard-fails', async () => {
  const client = {
    async query(sql) {
      if (sql.includes('INSERT INTO')) return { rows: [] };
      return { rows: [storedEvent({ paypal_capture_id: 'DIFFERENTCAPTURE' })] };
    },
  };

  await assert.rejects(
    () => recordPayPalWebhookEventInTransaction({ client, payment: payment() }),
    (error) => error instanceof NeonPayPalWebhookEventRecorderError
      && error.code === 'PAYPAL_WEBHOOK_EVENT_CONFLICT',
  );
});
