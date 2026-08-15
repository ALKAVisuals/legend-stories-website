import test from 'node:test';
import assert from 'node:assert/strict';

import { createNeonPayPalCaptureStore } from '../server/adapters/neon-paypal-capture-store.mjs';

const DATABASE_URL = 'postgresql://legend:example@ep-paypal-pooler.eu-central-1.aws.neon.tech/neondb?sslmode=require';
const reference = 'c'.repeat(64);
const orderId = '5O190127TN364715T';

function row(overrides = {}) {
  return {
    reference,
    status: 'payment_pending',
    amount_total: 4495,
    currency: 'EUR',
    mode: 'test',
    payment_session_id: orderId,
    created_at: 1_800_000_000,
    updated_at: 1_800_000_000,
    paid_at: null,
    last_stripe_event_id: null,
    last_stripe_event_type: null,
    last_stripe_event_created: 0,
    version: 0,
    customer: {},
    items: [],
    discount: {},
    shipping: {},
    totals: {},
    ...overrides,
  };
}

function capture(overrides = {}) {
  return {
    reference,
    orderId,
    amountTotal: 4495,
    currency: 'EUR',
    mode: 'test',
    capturedAt: 1_800_000_050,
    ...overrides,
  };
}

function scriptedClient(steps) {
  return {
    async connect() {},
    async query(sql) {
      const normalized = String(sql).replace(/\s+/g, ' ').trim();
      const step = steps.shift();
      assert.ok(step, `Unexpected query: ${normalized}`);
      assert.match(normalized, step.match);
      if (step.error) throw step.error;
      return structuredClone(step.result || { rows: [] });
    },
    async end() {},
  };
}

test('first matching capture atomically marks the reserved order paid', async () => {
  const steps = [
    { match: /^BEGIN ISOLATION LEVEL SERIALIZABLE$/ },
    { match: /^SELECT \* FROM legend_commerce\.orders/, result: { rows: [row()] } },
    { match: /^UPDATE legend_commerce\.orders SET status = 'paid'/, result: { rows: [row({
      status: 'paid',
      updated_at: 1_800_000_050,
      paid_at: 1_800_000_050,
      version: 1,
    })] } },
    { match: /^COMMIT$/ },
  ];
  const store = createNeonPayPalCaptureStore({
    connectionString: DATABASE_URL,
    clientFactory: async () => scriptedClient(steps),
  });

  const result = await store.processPaypalCapture(capture());
  assert.equal(result.duplicate, false);
  assert.equal(result.order.status, 'paid');
  assert.equal(result.order.version, 1);
  assert.equal(result.order.paidAt, 1_800_000_050);
  assert.equal(steps.length, 0);
});

test('browser capture becomes a no-op duplicate when webhook already marked the order paid', async () => {
  const alreadyPaid = row({
    status: 'paid',
    updated_at: 1_800_000_040,
    paid_at: 1_800_000_040,
    version: 1,
  });
  const steps = [
    { match: /^BEGIN ISOLATION LEVEL SERIALIZABLE$/ },
    { match: /^SELECT \* FROM legend_commerce\.orders/, result: { rows: [alreadyPaid] } },
    { match: /^COMMIT$/ },
  ];
  const store = createNeonPayPalCaptureStore({
    connectionString: DATABASE_URL,
    clientFactory: async () => scriptedClient(steps),
  });

  const result = await store.processPaypalCapture(capture());
  assert.equal(result.duplicate, true);
  assert.equal(result.order.status, 'paid');
  assert.equal(result.order.version, 1);
  assert.equal(result.order.paidAt, 1_800_000_040);
  assert.equal(steps.length, 0);
});

test('serialization conflict is retried and converges without a double mutation', async () => {
  const retryable = new Error('serialization failure');
  retryable.code = '40001';

  const attempts = [
    [
      { match: /^BEGIN ISOLATION LEVEL SERIALIZABLE$/ },
      { match: /^SELECT \* FROM legend_commerce\.orders/, error: retryable },
      { match: /^ROLLBACK$/ },
    ],
    [
      { match: /^BEGIN ISOLATION LEVEL SERIALIZABLE$/ },
      { match: /^SELECT \* FROM legend_commerce\.orders/, result: { rows: [row()] } },
      { match: /^UPDATE legend_commerce\.orders SET status = 'paid'/, result: { rows: [row({
        status: 'paid',
        updated_at: 1_800_000_050,
        paid_at: 1_800_000_050,
        version: 1,
      })] } },
      { match: /^COMMIT$/ },
    ],
  ];
  let clients = 0;
  const store = createNeonPayPalCaptureStore({
    connectionString: DATABASE_URL,
    clientFactory: async () => {
      const steps = attempts[clients];
      clients += 1;
      return scriptedClient(steps);
    },
  });

  const result = await store.processPaypalCapture(capture());
  assert.equal(clients, 2);
  assert.equal(result.duplicate, false);
  assert.equal(result.order.status, 'paid');
  assert.equal(result.order.version, 1);
  assert.equal(attempts[0].length, 0);
  assert.equal(attempts[1].length, 0);
});

test('mismatched capture identity rolls back without changing the order', async () => {
  const steps = [
    { match: /^BEGIN ISOLATION LEVEL SERIALIZABLE$/ },
    { match: /^SELECT \* FROM legend_commerce\.orders/, result: { rows: [row()] } },
    { match: /^ROLLBACK$/ },
  ];
  const store = createNeonPayPalCaptureStore({
    connectionString: DATABASE_URL,
    clientFactory: async () => scriptedClient(steps),
  });

  await assert.rejects(
    () => store.processPaypalCapture(capture({ amountTotal: 9999 })),
    (error) => error.code === 'PAYPAL_CAPTURE_ORDER_MISMATCH',
  );
  assert.equal(steps.length, 0);
});
