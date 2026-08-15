import test from 'node:test';
import assert from 'node:assert/strict';

import {
  COMPLETE_ORDER_STORE_METHODS,
  OrderStoreContractError,
  missingOrderStoreMethods,
  requireCheckoutStore,
  requireOrderLookupStore,
  validateOrderStoreAdapter,
} from '../server/orders/store-contract.mjs';
import {
  createOrderStoreConformanceFixtures,
  runOrderStoreConformance,
} from '../server/orders/store-conformance.mjs';
import { createReferenceOrderStore } from './support/reference-order-store.mjs';

test('central contract recognizes complete and capability-specific adapters', () => {
  const store = createReferenceOrderStore();
  assert.equal(validateOrderStoreAdapter(store), store);
  assert.equal(requireCheckoutStore(store), store);
  assert.equal(requireOrderLookupStore(store), store);
  assert.deepEqual(missingOrderStoreMethods(store), []);
  assert.deepEqual(COMPLETE_ORDER_STORE_METHODS, [
    'persistPendingCheckout',
    'getOrderByReference',
  ]);
});

test('central contract reports exact missing capabilities', () => {
  const partial = {
    async persistPendingCheckout() {},
  };
  assert.deepEqual(
    missingOrderStoreMethods(partial),
    ['getOrderByReference'],
  );
  assert.throws(
    () => validateOrderStoreAdapter(partial),
    (error) => {
      assert.ok(error instanceof OrderStoreContractError);
      assert.equal(error.code, 'ORDER_STORE_NOT_CONFIGURED');
      assert.deepEqual(error.details.missingMethods, ['getOrderByReference']);
      return true;
    },
  );
});

test('central contract rejects provider-specific capabilities', () => {
  assert.throws(
    () => validateOrderStoreAdapter(createReferenceOrderStore(), {
      requiredMethods: ['processStripeEvent'],
    }),
    (error) => {
      assert.ok(error instanceof OrderStoreContractError);
      assert.equal(error.code, 'INVALID_ORDER_STORE_CONTRACT');
      assert.deepEqual(error.details.unknownMethods, ['processStripeEvent']);
      return true;
    },
  );
});

test('reference adapter passes the reusable conformance suite', async () => {
  const report = await runOrderStoreConformance(createReferenceOrderStore);
  assert.equal(report.passed, true);
  assert.equal(report.checkCount, 6);
  assert.deepEqual(report.checks, [
    'complete capabilities',
    'create and lookup pending order',
    'idempotent pending-order retry',
    'concurrent pending-order idempotency',
    'conflicting pending-order rejection',
    'retrieval isolation',
  ]);
});

test('conformance suite rejects an incomplete adapter factory', async () => {
  await assert.rejects(
    () => runOrderStoreConformance(async () => ({
      async getOrderByReference() {
        return null;
      },
    })),
    (error) => error instanceof OrderStoreContractError
      && error.code === 'ORDER_STORE_NOT_CONFIGURED',
  );
});

test('conformance fixtures are deterministic and provider-neutral', () => {
  const first = createOrderStoreConformanceFixtures('same-seed');
  const second = createOrderStoreConformanceFixtures('same-seed');
  assert.deepEqual(first, second);
  assert.match(first.order.reference, /^[a-f0-9]{64}$/);
  assert.equal(first.order.status, 'payment_pending');
  assert.equal(first.order.totals.grandTotal, first.order.amountTotal);
  assert.equal(first.order.paymentSessionId, '5O190127TN364715T');
  assert.equal(Object.hasOwn(first, 'paidEvent'), false);
});
