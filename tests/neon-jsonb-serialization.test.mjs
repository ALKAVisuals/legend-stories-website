import test from 'node:test';
import assert from 'node:assert/strict';

import { createNeonOrderStore } from '../server/adapters/neon-order-store.mjs';

const DATABASE_URL = 'postgresql://legend:secret@ep-legend-pooler.eu-central-1.aws.neon.tech/neondb?sslmode=require';
const reference = 'e'.repeat(64);

function pendingOrder() {
  return {
    reference,
    status: 'payment_pending',
    amountTotal: 4890,
    currency: 'EUR',
    mode: 'test',
    paymentSessionId: 'cs_test_jsonb_serialization',
    createdAt: 1_800_000_000,
    updatedAt: 1_800_000_000,
    paidAt: null,
    lastStripeEventCreated: 0,
    version: 0,
    customer: {
      firstname: 'JSON',
      lastname: 'Serialization',
      email: 'json@example.com',
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
  };
}

function databaseRow(order, values) {
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
    last_stripe_event_id: null,
    last_stripe_event_type: null,
    last_stripe_event_created: order.lastStripeEventCreated,
    version: order.version,
    customer: JSON.parse(values[13]),
    items: JSON.parse(values[14]),
    discount: JSON.parse(values[15]),
    shipping: JSON.parse(values[16]),
    totals: JSON.parse(values[17]),
  };
}

test('serializes every pending-order JSONB parameter as JSON text', async () => {
  const order = pendingOrder();
  let insertValues;
  const clientFactory = async () => ({
    async connect() {},
    async query(sql, values = []) {
      const normalized = String(sql).replace(/\s+/g, ' ').trim();
      if (normalized === 'BEGIN ISOLATION LEVEL SERIALIZABLE') return { rows: [] };
      if (normalized.startsWith('INSERT INTO legend_commerce.orders')) {
        insertValues = values;
        return { rows: [databaseRow(order, values)] };
      }
      if (normalized === 'COMMIT') return { rows: [] };
      throw new Error(`Unexpected SQL query: ${normalized}`);
    },
    async end() {},
  });

  const store = createNeonOrderStore({
    connectionString: DATABASE_URL,
    clientFactory,
  });

  const result = await store.persistPendingCheckout(order);

  assert.equal(result.created, true);
  assert.deepEqual(result.order, order);
  assert.ok(insertValues);

  const expectedJsonValues = [
    order.customer,
    order.items,
    order.discount,
    order.shipping,
    order.totals,
  ];

  for (let offset = 0; offset < expectedJsonValues.length; offset += 1) {
    const parameter = insertValues[13 + offset];
    assert.equal(typeof parameter, 'string');
    assert.deepEqual(JSON.parse(parameter), expectedJsonValues[offset]);
  }

  assert.match(insertValues[14], /^\[/, 'items must be a JSON array, not a PostgreSQL array literal');
});
