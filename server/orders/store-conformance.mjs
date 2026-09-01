import { createHash } from 'node:crypto';

import {
  OrderStoreContractError,
  validateOrderStoreAdapter,
} from './store-contract.mjs';

function clone(value) {
  return structuredClone(value);
}

function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [key, canonicalize(value[key])]),
    );
  }
  return value;
}

function sameValue(left, right) {
  return JSON.stringify(canonicalize(left)) === JSON.stringify(canonicalize(right));
}

function sameLookupValue(actual, expected) {
  const normalized = clone(actual);
  if (normalized && Object.hasOwn(normalized, 'documentProfileVersion')) {
    if (normalized.documentProfileVersion !== 0) return false;
    delete normalized.documentProfileVersion;
  }
  return sameValue(normalized, expected);
}

function assertContract(condition, message, details = {}) {
  if (!condition) {
    throw new OrderStoreContractError(
      'ORDER_STORE_CONFORMANCE_FAILED',
      message,
      details,
    );
  }
}

async function expectErrorCode(action, expectedCode, label) {
  try {
    await action();
  } catch (error) {
    assertContract(
      error?.code === expectedCode,
      `${label} failed with ${error?.code || error?.name || 'UNKNOWN'} instead of ${expectedCode}.`,
      { expectedCode, actualCode: error?.code || error?.name || 'UNKNOWN' },
    );
    return;
  }
  assertContract(false, `${label} did not reject with ${expectedCode}.`, { expectedCode });
}

function validatePersistenceResult(result, expectedOrder, expectedCreated) {
  assertContract(
    result && typeof result === 'object' && typeof result.created === 'boolean',
    'persistPendingCheckout() returned an invalid result.',
  );
  assertContract(
    result.created === expectedCreated,
    `persistPendingCheckout() returned created=${result.created}; expected ${expectedCreated}.`,
  );
  assertContract(
    sameValue(result.order, expectedOrder),
    'persistPendingCheckout() did not return the complete stored order.',
  );
}

export function createOrderStoreConformanceFixtures(seed = 'legend-order-store') {
  const reference = createHash('sha256').update(String(seed)).digest('hex');
  const createdAt = 1_800_000_000;
  const order = Object.freeze({
    reference,
    status: 'payment_pending',
    amountTotal: 4890,
    currency: 'EUR',
    mode: 'test',
    paymentSessionId: '5O190127TN364715T',
    createdAt,
    updatedAt: createdAt,
    lastStripeEventCreated: 0,
    paidAt: null,
    version: 0,
    customer: Object.freeze({
      firstname: 'Store',
      lastname: 'Conformance',
      email: 'store-conformance@example.com',
      street: 'Teststraat 10',
      line2: '',
      zip: '1234 AB',
      city: 'Amsterdam',
      country: 'NL',
    }),
    items: Object.freeze([
      Object.freeze({
        slug: 'combat-grind-cycle',
        page: 'combat-grind-cycle.html',
        name: 'The Grind Cycle',
        image: 'media/stikkers/example.png',
        unitPrice: 49.95,
        quantity: 1,
        lineTotal: 49.95,
      }),
    ]),
    discount: Object.freeze({
      code: 'LEGEND10',
      percent: 10,
      amount: 5,
    }),
    shipping: Object.freeze({
      deliveryCountry: 'NL',
      zoneCode: 'NL',
      zone: 'Netherlands',
      cost: 3.95,
      freeFrom: 50,
      qualifiesForFreeShipping: false,
    }),
    totals: Object.freeze({
      subtotal: 4995,
      discount: 500,
      discountedSubtotal: 4495,
      shipping: 395,
      grandTotal: 4890,
    }),
  });

  return Object.freeze({ order });
}

export async function runOrderStoreConformance(createStore, {
  fixtures = createOrderStoreConformanceFixtures(),
} = {}) {
  if (typeof createStore !== 'function') {
    throw new OrderStoreContractError(
      'INVALID_ORDER_STORE_FACTORY',
      'Order store conformance requires a fresh adapter factory.',
    );
  }

  const checks = [];
  const run = async (name, action) => {
    await action();
    checks.push(name);
  };

  await run('complete capabilities', async () => {
    validateOrderStoreAdapter(await createStore());
  });

  await run('create and lookup pending order', async () => {
    const store = validateOrderStoreAdapter(await createStore());
    const expected = clone(fixtures.order);
    const created = await store.persistPendingCheckout(clone(expected));
    validatePersistenceResult(created, expected, true);
    const found = await store.getOrderByReference(expected.reference);
    assertContract(sameLookupValue(found, expected), 'getOrderByReference() returned a different order.');
  });

  await run('idempotent pending-order retry', async () => {
    const store = validateOrderStoreAdapter(await createStore());
    const expected = clone(fixtures.order);
    validatePersistenceResult(
      await store.persistPendingCheckout(clone(expected)),
      expected,
      true,
    );
    validatePersistenceResult(
      await store.persistPendingCheckout(clone(expected)),
      expected,
      false,
    );
  });

  await run('concurrent pending-order idempotency', async () => {
    const store = validateOrderStoreAdapter(await createStore());
    const expected = clone(fixtures.order);
    const results = await Promise.all([
      store.persistPendingCheckout(clone(expected)),
      store.persistPendingCheckout(clone(expected)),
    ]);
    const createdCount = results.filter((result) => result?.created === true).length;
    const existingCount = results.filter((result) => result?.created === false).length;
    assertContract(
      createdCount === 1 && existingCount === 1,
      'Concurrent identical pending orders were not resolved as one create and one retry.',
      { createdCount, existingCount },
    );
    for (const result of results) {
      assertContract(sameValue(result.order, expected), 'Concurrent persistence returned divergent orders.');
    }
  });

  await run('conflicting pending-order rejection', async () => {
    const store = validateOrderStoreAdapter(await createStore());
    const expected = clone(fixtures.order);
    await store.persistPendingCheckout(clone(expected));
    const conflict = clone(expected);
    conflict.customer.email = 'conflict@example.com';
    await expectErrorCode(
      () => store.persistPendingCheckout(conflict),
      'ORDER_STORE_CONFLICT',
      'Conflicting pending order',
    );
  });

  await run('retrieval isolation', async () => {
    const store = validateOrderStoreAdapter(await createStore());
    const expected = clone(fixtures.order);
    await store.persistPendingCheckout(clone(expected));
    const first = await store.getOrderByReference(expected.reference);
    first.customer.email = 'mutated@example.com';
    first.items[0].unitPrice = 1;
    const second = await store.getOrderByReference(expected.reference);
    assertContract(
      sameLookupValue(second, expected),
      'Mutating a retrieved order changed durable store state.',
    );
  });

  return Object.freeze({
    passed: true,
    checkCount: checks.length,
    checks: Object.freeze(checks),
  });
}
