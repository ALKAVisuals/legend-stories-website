import test from 'node:test';
import assert from 'node:assert/strict';

import {
  NeonOrderStoreError,
  createNeonOrderStore,
  validateNeonConnectionString,
} from '../server/adapters/neon-order-store.mjs';

const DATABASE_URL = 'postgresql://legend:secret@ep-legend-pooler.eu-central-1.aws.neon.tech/neondb?sslmode=require';
const reference = 'd'.repeat(64);

function pendingOrder(overrides = {}) {
  return {
    reference,
    status: 'payment_pending',
    amountTotal: 4890,
    currency: 'EUR',
    mode: 'test',
    paymentSessionId: '5O190127TN364715T',
    createdAt: 1_800_000_000,
    updatedAt: 1_800_000_000,
    paidAt: null,
    lastStripeEventCreated: 0,
    version: 0,
    customer: {
      firstname: 'Neon',
      lastname: 'Store',
      email: 'neon@example.com',
      street: 'Teststraat 10',
      line2: '',
      zip: '1234 AB',
      city: 'Amsterdam',
      country: 'NL',
    },
    items: [{
      slug: 'combat-grind-cycle',
      page: 'combat-grind-cycle.html',
      name: 'The Grind Cycle',
      image: 'media/stikkers/example.png',
      unitPrice: 49.95,
      quantity: 1,
      lineTotal: 49.95,
    }],
    discount: { code: 'LEGEND10', percent: 10, amount: 5 },
    shipping: {
      deliveryCountry: 'NL',
      zoneCode: 'NL',
      zone: 'Netherlands',
      cost: 3.95,
      freeFrom: 50,
      qualifiesForFreeShipping: false,
    },
    totals: {
      subtotal: 4995,
      discount: 500,
      discountedSubtotal: 4495,
      shipping: 395,
      grandTotal: 4890,
    },
    ...overrides,
  };
}

function databaseRow(order) {
  return {
    reference: order.reference,
    status: order.status,
    amount_total: order.amountTotal,
    currency: order.currency,
    mode: order.mode,
    payment_session_id: order.paymentSessionId,
    created_at: order.createdAt,
    updated_at: order.updatedAt,
    paid_at: order.paidAt,
    last_stripe_event_id: order.lastStripeEventId || null,
    last_stripe_event_type: order.lastStripeEventType || null,
    last_stripe_event_created: order.lastStripeEventCreated ?? 0,
    version: order.version,
    customer: structuredClone(order.customer),
    items: structuredClone(order.items),
    discount: structuredClone(order.discount),
    shipping: structuredClone(order.shipping),
    totals: structuredClone(order.totals),
  };
}

function createScriptedClientFactory(steps, trace = []) {
  return async () => ({
    async connect() {
      trace.push('connect');
    },
    async query(sql, parameters = []) {
      const normalized = String(sql).replace(/\s+/g, ' ').trim();
      trace.push(normalized.split(' ')[0]);
      const step = steps.shift();
      assert.ok(step, `Unexpected SQL query: ${normalized}`);
      assert.match(normalized, step.match);
      if (step.parameters) step.parameters(parameters);
      if (step.error) throw step.error;
      return structuredClone(step.result || { rows: [] });
    },
    async end() {
      trace.push('end');
    },
  });
}

test('accepts only TLS-protected Neon Postgres connection strings', () => {
  assert.equal(validateNeonConnectionString(DATABASE_URL), DATABASE_URL);
  for (const invalid of [
    '',
    'https://example.com/database',
    'postgresql://user:secret@db.example.com/app?sslmode=require',
    'postgresql://user:secret@ep-test.eu-central-1.aws.neon.tech/app',
  ]) {
    assert.throws(
      () => validateNeonConnectionString(invalid),
      (error) => error instanceof NeonOrderStoreError,
    );
  }
});

test('persists a new pending order inside a serializable transaction', async () => {
  const order = pendingOrder();
  const trace = [];
  const steps = [
    { match: /^BEGIN ISOLATION LEVEL SERIALIZABLE$/, result: { rows: [] } },
    {
      match: /^INSERT INTO legend_commerce\.orders/,
      parameters(values) {
        assert.equal(values[0], reference);
        assert.equal(values[2], order.amountTotal);
        assert.equal(JSON.parse(values[13]).email, order.customer.email);
      },
      result: { rows: [databaseRow(order)] },
    },
    { match: /^COMMIT$/, result: { rows: [] } },
  ];
  const store = createNeonOrderStore({
    connectionString: DATABASE_URL,
    clientFactory: createScriptedClientFactory(steps, trace),
  });

  const result = await store.persistPendingCheckout(order);
  assert.equal(result.created, true);
  assert.deepEqual(result.order, order);
  assert.deepEqual(trace, ['connect', 'BEGIN', 'INSERT', 'COMMIT', 'end']);
  assert.equal(steps.length, 0);
});

test('accepts an identical existing pending order as an idempotent retry', async () => {
  const order = pendingOrder();
  const steps = [
    { match: /^BEGIN ISOLATION LEVEL SERIALIZABLE$/ },
    { match: /^INSERT INTO legend_commerce\.orders/, result: { rows: [] } },
    {
      match: /^SELECT \* FROM legend_commerce\.orders WHERE reference = \$1 FOR UPDATE$/,
      result: { rows: [databaseRow(order)] },
    },
    { match: /^COMMIT$/ },
  ];
  const store = createNeonOrderStore({
    connectionString: DATABASE_URL,
    clientFactory: createScriptedClientFactory(steps),
  });

  const result = await store.persistPendingCheckout(order);
  assert.equal(result.created, false);
  assert.deepEqual(result.order, order);
});

test('rolls back when an existing pending order conflicts', async () => {
  const order = pendingOrder();
  const trace = [];
  const conflict = pendingOrder({
    customer: { ...order.customer, email: 'different@example.com' },
  });
  const steps = [
    { match: /^BEGIN ISOLATION LEVEL SERIALIZABLE$/ },
    { match: /^INSERT INTO legend_commerce\.orders/, result: { rows: [] } },
    {
      match: /^SELECT \* FROM legend_commerce\.orders WHERE reference = \$1 FOR UPDATE$/,
      result: { rows: [databaseRow(conflict)] },
    },
    { match: /^ROLLBACK$/ },
  ];
  const store = createNeonOrderStore({
    connectionString: DATABASE_URL,
    clientFactory: createScriptedClientFactory(steps, trace),
  });

  await assert.rejects(
    () => store.persistPendingCheckout(order),
    (error) => error instanceof NeonOrderStoreError
      && error.code === 'ORDER_STORE_CONFLICT',
  );
  assert.equal(trace.at(-1), 'end');
});

test('looks up detached order values without opening a write transaction', async () => {
  const order = pendingOrder();
  const trace = [];
  const steps = [{
    match: /^SELECT \* FROM legend_commerce\.orders WHERE reference = \$1$/,
    result: { rows: [databaseRow(order)] },
  }];
  const store = createNeonOrderStore({
    connectionString: DATABASE_URL,
    clientFactory: createScriptedClientFactory(steps, trace),
  });

  const found = await store.getOrderByReference(reference);
  found.customer.email = 'mutated@example.com';
  assert.equal(order.customer.email, 'neon@example.com');
  assert.deepEqual(trace, ['connect', 'SELECT', 'end']);
});

test('core Neon store exposes no active Stripe event capability', () => {
  const store = createNeonOrderStore({
    connectionString: DATABASE_URL,
    clientFactory: async () => ({ connect() {}, query() {}, end() {} }),
  });
  assert.equal('processStripeEvent' in store, false);
});
