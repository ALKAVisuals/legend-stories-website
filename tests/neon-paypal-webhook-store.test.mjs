import test from 'node:test';
import assert from 'node:assert/strict';

import { createNeonPayPalWebhookStore } from '../server/adapters/neon-paypal-webhook-store.mjs';

const DATABASE_URL = 'postgresql://legend:example@ep-paypal-pooler.eu-central-1.aws.neon.tech/neondb?sslmode=require';
const reference = 'b'.repeat(64);
const orderId = '5O190127TN364715T';

function row(overrides = {}) {
  return {
    reference,
    status: 'payment_pending',
    amount_total: 4500,
    currency: 'EUR',
    mode: 'test',
    payment_session_id: orderId,
    payment_provider: 'paypal',
    created_at: 1_800_000_000,
    updated_at: 1_800_000_000,
    paid_at: null,
    last_stripe_event_id: null,
    last_stripe_event_type: null,
    last_stripe_event_created: 0,
    version: 0,
    customer: {}, items: [], discount: {}, shipping: {}, totals: {},
    ...overrides,
  };
}

function event(overrides = {}) {
  return {
    eventId: 'WH-EVENT-1',
    eventType: 'PAYMENT.CAPTURE.COMPLETED',
    reference,
    orderId,
    captureId: '3Y662965014333303',
    mode: 'test',
    createdAt: 1_800_000_100,
    mutationAt: 1_800_000_095,
    amountTotal: 4500,
    currency: 'EUR',
    targetStatus: 'paid',
    ...overrides,
  };
}

function clientFactory(steps) {
  return async () => ({
    async connect() {},
    async query(sql) {
      const normalized = String(sql).replace(/\s+/g, ' ').trim();
      const step = steps.shift();
      assert.ok(step, `Unexpected query: ${normalized}`);
      assert.match(normalized, step.match);
      return structuredClone(step.result || { rows: [] });
    },
    async end() {},
  });
}

test('atomically reserves a completed event and marks the matching PayPal order paid', async () => {
  const current = row();
  const paid = row({ status: 'paid', updated_at: 1_800_000_095, paid_at: 1_800_000_095, version: 1 });
  const steps = [
    { match: /^BEGIN ISOLATION LEVEL SERIALIZABLE$/ },
    { match: /^SELECT \* FROM legend_commerce\.orders/, result: { rows: [current] } },
    { match: /^INSERT INTO legend_commerce\.paypal_webhook_events/, result: { rows: [{ event_id: 'WH-EVENT-1' }] } },
    { match: /^UPDATE legend_commerce\.orders SET status = \$3/, result: { rows: [paid] } },
    { match: /^COMMIT$/ },
  ];
  const store = createNeonPayPalWebhookStore({
    connectionString: DATABASE_URL,
    clientFactory: clientFactory(steps),
    now: () => 1_800_000_101,
  });
  const result = await store.processPaypalWebhookEvent(event());
  assert.equal(result.duplicate, false);
  assert.equal(result.order.status, 'paid');
  assert.equal(result.order.version, 1);
  assert.equal(steps.length, 0);
});

test('duplicate event is acknowledged without a second order mutation', async () => {
  const paid = row({ status: 'paid', updated_at: 1_800_000_095, paid_at: 1_800_000_095, version: 1 });
  const steps = [
    { match: /^BEGIN ISOLATION LEVEL SERIALIZABLE$/ },
    { match: /^SELECT \* FROM legend_commerce\.orders/, result: { rows: [paid] } },
    { match: /^INSERT INTO legend_commerce\.paypal_webhook_events/, result: { rows: [] } },
    { match: /^SELECT event_id, event_type, order_reference/, result: { rows: [{
      event_id: 'WH-EVENT-1', event_type: 'PAYMENT.CAPTURE.COMPLETED', order_reference: reference,
      paypal_order_id: orderId, paypal_capture_id: '3Y662965014333303', mode: 'test', paypal_created_at: 1_800_000_100,
    }] } },
    { match: /^COMMIT$/ },
  ];
  const store = createNeonPayPalWebhookStore({
    connectionString: DATABASE_URL,
    clientFactory: clientFactory(steps),
  });
  const result = await store.processPaypalWebhookEvent(event());
  assert.equal(result.duplicate, true);
  assert.equal(result.order.status, 'paid');
  assert.equal(steps.length, 0);
});

test('provider or order identity mismatch rolls back without reserving the event', async () => {
  const steps = [
    { match: /^BEGIN ISOLATION LEVEL SERIALIZABLE$/ },
    { match: /^SELECT \* FROM legend_commerce\.orders/, result: { rows: [row({ payment_provider: 'stripe' })] } },
    { match: /^ROLLBACK$/ },
  ];
  const store = createNeonPayPalWebhookStore({
    connectionString: DATABASE_URL,
    clientFactory: clientFactory(steps),
  });
  await assert.rejects(
    () => store.processPaypalWebhookEvent(event()),
    (error) => error.code === 'PAYPAL_WEBHOOK_ORDER_MISMATCH',
  );
  assert.equal(steps.length, 0);
});

test('paid orders never regress on a later pending event but the event is still recorded', async () => {
  const paid = row({ status: 'paid', updated_at: 1_800_000_200, paid_at: 1_800_000_095, version: 1 });
  const steps = [
    { match: /^BEGIN ISOLATION LEVEL SERIALIZABLE$/ },
    { match: /^SELECT \* FROM legend_commerce\.orders/, result: { rows: [paid] } },
    { match: /^INSERT INTO legend_commerce\.paypal_webhook_events/, result: { rows: [{ event_id: 'WH-PENDING-1' }] } },
    { match: /^COMMIT$/ },
  ];
  const store = createNeonPayPalWebhookStore({
    connectionString: DATABASE_URL,
    clientFactory: clientFactory(steps),
  });
  const result = await store.processPaypalWebhookEvent(event({
    eventId: 'WH-PENDING-1', eventType: 'PAYMENT.CAPTURE.PENDING', targetStatus: 'payment_processing',
  }));
  assert.equal(result.order.status, 'paid');
  assert.equal(result.order.version, 1);
  assert.equal(steps.length, 0);
});
