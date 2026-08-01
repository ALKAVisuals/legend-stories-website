import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateDiscount, calculateGrandTotal, calculateSubtotal } from '../js/commerce/pricing.mjs';
import { calculateShipping, getShippingZone } from '../js/commerce/shipping.mjs';

test('pricing calculations are deterministic', () => {
  const items = [{ price: 49.95, quantity: 2 }, { price: 20, quantity: 1 }];
  assert.equal(calculateSubtotal(items), 119.9);
  assert.equal(calculateDiscount(100, 10), 10);
  assert.equal(calculateGrandTotal({ items, shipping: 5.95, discountPercent: 10 }), 113.86);
});

test('invalid pricing input cannot create negative totals', () => {
  assert.equal(calculateSubtotal([{ price: -5, quantity: -2 }]), 0);
  assert.equal(calculateDiscount(100, 150), 100);
  assert.equal(calculateGrandTotal({ items: [], shipping: -10 }), 0);
});

test('shipping uses thresholds and safe fallback zones', () => {
  assert.equal(calculateShipping({ countryCode: 'NL', subtotal: 49.99 }), 3.95);
  assert.equal(calculateShipping({ countryCode: 'NL', subtotal: 50 }), 0);
  assert.equal(calculateShipping({ countryCode: 'US', subtotal: 149.99 }), 14.95);
  assert.deepEqual(getShippingZone('UNKNOWN'), getShippingZone('OTHER'));
  assert.equal(calculateShipping({ hasItems: false }), 0);
});
