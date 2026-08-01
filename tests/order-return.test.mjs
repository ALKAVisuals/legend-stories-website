import test from 'node:test';
import assert from 'node:assert/strict';

import {
  applyVerifiedOrderStatus,
  clearVerifiedCheckoutStorage,
  resolveOrderReturnCopy,
} from '../js/commerce/order-return.mjs';

function memoryStorage(initial = {}) {
  const values = new Map(Object.entries(initial));
  return {
    getItem(key) {
      return values.has(key) ? values.get(key) : null;
    },
    setItem(key, value) {
      values.set(key, String(value));
    },
    removeItem(key) {
      values.delete(key);
    },
    has(key) {
      return values.has(key);
    },
  };
}

function checkoutStorage() {
  return {
    localStorage: memoryStorage({
      legendCart: '[{"page":"example.html"}]',
      legendDiscountCode: 'LEGEND10',
      legendDiscountPercent: '10',
      unrelatedPreference: 'keep',
    }),
    sessionStorage: memoryStorage({
      legendOrder: '{}',
      legendOrderRequest: '{}',
      legendCheckoutReference: 'a'.repeat(64),
      legendCheckoutSessionId: 'cs_test_return',
      unrelatedSession: 'keep',
    }),
  };
}

test('only a server-verified paid status clears Checkout storage', () => {
  for (const status of ['payment_pending', 'payment_processing', 'payment_failed', 'expired']) {
    const storage = checkoutStorage();
    const copy = applyVerifiedOrderStatus({
      status,
      paid: false,
    }, storage);
    assert.equal(copy.clearCart, false);
    assert.equal(storage.localStorage.has('legendCart'), true);
    assert.equal(storage.sessionStorage.has('legendCheckoutReference'), true);
  }

  const paidStorage = checkoutStorage();
  const paidCopy = applyVerifiedOrderStatus({
    status: 'paid',
    paid: true,
  }, paidStorage);
  assert.equal(paidCopy.clearCart, true);
  assert.equal(paidStorage.localStorage.has('legendCart'), false);
  assert.equal(paidStorage.localStorage.has('legendDiscountCode'), false);
  assert.equal(paidStorage.sessionStorage.has('legendCheckoutReference'), false);
  assert.equal(paidStorage.sessionStorage.has('legendCheckoutSessionId'), false);
  assert.equal(paidStorage.localStorage.has('unrelatedPreference'), true);
  assert.equal(paidStorage.sessionStorage.has('unrelatedSession'), true);
});

test('inconsistent paid flags can never clear the cart', () => {
  const storage = checkoutStorage();
  assert.throws(
    () => applyVerifiedOrderStatus({ status: 'paid', paid: false }, storage),
    /inconsistent/,
  );
  assert.equal(storage.localStorage.has('legendCart'), true);
});

test('unknown statuses remain non-destructive', () => {
  const copy = resolveOrderReturnCopy('unknown');
  assert.equal(copy.clearCart, false);
  assert.match(copy.message, /cart remains saved/i);
});

test('verified cleanup requires both browser storage scopes', () => {
  assert.throws(
    () => clearVerifiedCheckoutStorage({ localStorage: memoryStorage() }),
    /Browser storage is required/,
  );
});
