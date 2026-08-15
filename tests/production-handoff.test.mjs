import assert from 'node:assert/strict';
import test from 'node:test';

import {
  ProductionHandoffError,
  createProductionHandoff,
} from '../server/orders/production-handoff.mjs';

const reference = 'a'.repeat(64);

function paidOrder(overrides = {}) {
  return {
    reference,
    status: 'paid',
    customer: {
      name: 'Must not leave order storage',
      email: 'private@example.test',
    },
    shipping: {
      deliveryCountry: 'NL',
      address: 'Must not leave order storage',
    },
    items: [
      {
        productId: 'LM-2026-00002',
        slug: 'combat-beast-within',
        page: 'combat-beast-within.html',
        sizeCm: 45,
        quantity: 1,
        unitPrice: 45,
      },
    ],
    ...overrides,
  };
}

function errorCode(fn, expectedCode) {
  assert.throws(fn, (error) => {
    assert.ok(error instanceof ProductionHandoffError);
    assert.equal(error.code, expectedCode);
    return true;
  });
}

test('paid order creates exact PII-free production payload', () => {
  const handoff = createProductionHandoff(paidOrder());
  assert.deepEqual(handoff, {
    schema_version: 1,
    order_ref: reference,
    source_system: 'legendmural-web',
    items: [
      {
        line_ref: '1',
        product_id: 'LM-2026-00002',
        size_cm: 45,
        quantity: 1,
      },
    ],
  });
  const serialized = JSON.stringify(handoff).toLowerCase();
  for (const forbidden of ['customer', 'email', 'shipping', 'address', 'name', 'unitprice', 'slug', 'page']) {
    assert.equal(serialized.includes(forbidden), false, `handoff leaked ${forbidden}`);
  }
});

test('payment_pending order cannot enter production', () => {
  errorCode(
    () => createProductionHandoff(paidOrder({ status: 'payment_pending' })),
    'ORDER_NOT_PAID',
  );
});

test('legacy 50 cm size cannot enter production', () => {
  const order = paidOrder();
  order.items[0].sizeCm = 50;
  errorCode(() => createProductionHandoff(order), 'INVALID_PRODUCTION_SIZE');
});

test('missing canonical production product ID is rejected', () => {
  const order = paidOrder();
  delete order.items[0].productId;
  errorCode(() => createProductionHandoff(order), 'INVALID_PRODUCTION_PRODUCT_ID');
});

test('both active production sizes are accepted and line refs are deterministic', () => {
  const order = paidOrder({
    items: [
      { productId: 'LM-2026-00015', sizeCm: 30, quantity: 2 },
      { productId: 'LM-2026-00079', sizeCm: 45, quantity: 1 },
    ],
  });
  const handoff = createProductionHandoff(order);
  assert.deepEqual(handoff.items, [
    { line_ref: '1', product_id: 'LM-2026-00015', size_cm: 30, quantity: 2 },
    { line_ref: '2', product_id: 'LM-2026-00079', size_cm: 45, quantity: 1 },
  ]);
});
