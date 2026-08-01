import test from 'node:test';
import assert from 'node:assert/strict';

import { createNeonOrderStore } from '../server/adapters/neon-order-store.mjs';

const connectionString = 'postgresql://legend:secret@ep-normalize-pooler.eu-central-1.aws.neon.tech/neondb?sslmode=require';
const reference = 'e'.repeat(64);

const input = {
  reference,
  status: 'payment_pending',
  amountTotal: 5390,
  currency: 'EUR',
  mode: 'test',
  paymentSessionId: 'cs_test_normalize_pending',
  createdAt: 1_800_000_000,
  updatedAt: 1_800_000_000,
  paidAt: null,
  version: 0,
  customer: {
    firstname: 'Initial',
    lastname: 'Buyer',
    email: 'initial@example.com',
    street: 'Teststraat 1',
    line2: '',
    zip: '1234 AB',
    city: 'Amsterdam',
    country: 'NL',
  },
  items: [{
    slug: 'example',
    page: 'example.html',
    name: 'Example',
    image: 'media/example.png',
    unitPrice: 53.9,
    quantity: 1,
    lineTotal: 53.9,
  }],
  discount: { code: null, percent: 0, amount: 0 },
  shipping: {
    deliveryCountry: 'NL',
    zoneCode: 'NL',
    zone: 'Netherlands',
    cost: 0,
    freeFrom: 50,
    qualifiesForFreeShipping: true,
  },
  totals: {
    subtotal: 5390,
    discount: 0,
    discountedSubtotal: 5390,
    shipping: 0,
    grandTotal: 5390,
  },
};

function row() {
  return {
    reference,
    status: input.status,
    amount_total: input.amountTotal,
    currency: input.currency,
    mode: input.mode,
    payment_session_id: input.paymentSessionId,
    created_at: input.createdAt,
    updated_at: input.updatedAt,
    paid_at: null,
    last_stripe_event_id: null,
    last_stripe_event_type: null,
    last_stripe_event_created: 0,
    version: 0,
    customer: structuredClone(input.customer),
    items: structuredClone(input.items),
    discount: structuredClone(input.discount),
    shipping: structuredClone(input.shipping),
    totals: structuredClone(input.totals),
  };
}

test('normalizes the initial missing Stripe-event timestamp to zero', async () => {
  const responses = [
    { rows: [] },
    { rows: [row()] },
    { rows: [] },
  ];
  const store = createNeonOrderStore({
    connectionString,
    clientFactory: async () => ({
      async connect() {},
      async query() {
        return responses.shift();
      },
      async end() {},
    }),
  });

  const result = await store.persistPendingCheckout(input);
  assert.equal(result.created, true);
  assert.equal(result.order.lastStripeEventCreated, 0);
  assert.equal('lastStripeEventCreated' in input, false);
  assert.equal(responses.length, 0);
});
