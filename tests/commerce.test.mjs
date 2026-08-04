import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateDiscount, calculateGrandTotal, calculateSubtotal, roundMoney } from '../js/commerce/pricing.mjs';
import { calculateShipping, getShippingZone, SHIPPING_ZONES } from '../js/commerce/shipping.mjs';
import { calculateCommerceTotals } from '../js/commerce/totals.mjs';

test('pricing calculations are deterministic at euro-cent precision', () => {
  const items = [{ price: 49.95, quantity: 2 }, { price: 20, quantity: 1 }];
  assert.equal(calculateSubtotal(items), 119.9);
  assert.equal(calculateDiscount(100, 10), 10);
  assert.equal(calculateDiscount(49.95, 10), 5);
  assert.equal(calculateGrandTotal({ items, shipping: 4.95, discountPercent: 10 }), 112.86);
  assert.equal(roundMoney(0.1 + 0.2), 0.3);
});

test('invalid pricing input cannot create negative totals', () => {
  assert.equal(calculateSubtotal([{ price: -5, quantity: -2 }]), 0);
  assert.equal(calculateDiscount(100, 150), 100);
  assert.equal(calculateGrandTotal({ items: [], shipping: -10 }), 0);
});

test('only the validated Netherlands shipping market is enabled', () => {
  assert.equal(SHIPPING_ZONES.NL.cost, 4.95);
  assert.equal(SHIPPING_ZONES.NL.freeFrom, 69);
  assert.equal(SHIPPING_ZONES.NL.enabled, true);
  assert.equal(getShippingZone("US").enabled, false);
});

test('Netherlands shipping uses the approved threshold', () => {
  assert.equal(calculateShipping({ countryCode: 'NL', subtotal: 68.99 }), 4.95);
  assert.equal(calculateShipping({ countryCode: 'NL', subtotal: 69 }), 0);
  assert.throws(() => calculateShipping({ countryCode: 'US', subtotal: 200 }), /not enabled/);
  assert.equal(calculateShipping({ hasItems: false }), 0);
});

test('canonical totals apply discount before the free-shipping threshold', () => {
  const totals = calculateCommerceTotals({ items: [{ price: 50, quantity: 1 }], countryCode: 'NL', discountPercent: 10 });
  assert.equal(totals.subtotal, 50);
  assert.equal(totals.discount, 5);
  assert.equal(totals.discountedSubtotal, 45);
  assert.equal(totals.shipping, 4.95);
  assert.equal(totals.grandTotal, 49.95);
  assert.equal(totals.freeShippingRemaining, 24);
  assert.equal(totals.qualifiesForFreeShipping, false);
});

test('orders at the €69 threshold receive free shipping', () => {
  const totals = calculateCommerceTotals({ items: [{ price: 69, quantity: 1 }], countryCode: 'NL' });
  assert.equal(totals.shipping, 0);
  assert.equal(totals.grandTotal, 69);
  assert.equal(totals.qualifiesForFreeShipping, true);
});

test('unknown countries are blocked until their landed cost is validated', () => {
  assert.throws(() => calculateCommerceTotals({ items: [{ price: 45, quantity: 1 }], countryCode: 'US' }), /not enabled/);
  const empty = calculateCommerceTotals({ countryCode: 'NL' });
  assert.equal(empty.subtotal, 0);
  assert.equal(empty.shipping, 0);
  assert.equal(empty.grandTotal, 0);
});
