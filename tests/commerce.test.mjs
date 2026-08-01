import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateDiscount,
  calculateGrandTotal,
  calculateSubtotal,
  roundMoney,
} from '../js/commerce/pricing.mjs';
import { calculateShipping, getShippingZone, SHIPPING_ZONES } from '../js/commerce/shipping.mjs';
import { calculateCommerceTotals } from '../js/commerce/totals.mjs';

test('pricing calculations are deterministic at euro-cent precision', () => {
  const items = [{ price: 49.95, quantity: 2 }, { price: 20, quantity: 1 }];
  assert.equal(calculateSubtotal(items), 119.9);
  assert.equal(calculateDiscount(100, 10), 10);
  assert.equal(calculateDiscount(49.95, 10), 5);
  assert.equal(calculateGrandTotal({ items, shipping: 5.95, discountPercent: 10 }), 113.86);
  assert.equal(roundMoney(0.1 + 0.2), 0.3);
});

test('invalid pricing input cannot create negative totals', () => {
  assert.equal(calculateSubtotal([{ price: -5, quantity: -2 }]), 0);
  assert.equal(calculateDiscount(100, 150), 100);
  assert.equal(calculateGrandTotal({ items: [], shipping: -10 }), 0);
});

test('shipping zones match the live storefront coverage', () => {
  for (const countryCode of ['NL', 'BE', 'DE', 'FR', 'LU', 'AT', 'DK', 'SE', 'ES', 'IT', 'PT', 'IE', 'FI', 'PL', 'CZ', 'CH', 'NO', 'GB', 'US', 'CA', 'AU', 'JP', 'OTHER']) {
    assert.ok(SHIPPING_ZONES[countryCode], `Missing shipping zone for ${countryCode}`);
    assert.ok(SHIPPING_ZONES[countryCode].name);
  }
});

test('shipping uses thresholds and safe fallback zones', () => {
  assert.equal(calculateShipping({ countryCode: 'NL', subtotal: 49.99 }), 3.95);
  assert.equal(calculateShipping({ countryCode: 'NL', subtotal: 50 }), 0);
  assert.equal(calculateShipping({ countryCode: 'US', subtotal: 149.99 }), 14.95);
  assert.deepEqual(getShippingZone('UNKNOWN'), getShippingZone('OTHER'));
  assert.equal(calculateShipping({ hasItems: false }), 0);
});

test('canonical totals apply discount before the free-shipping threshold', () => {
  const totals = calculateCommerceTotals({
    items: [{ price: 50, quantity: 1 }],
    countryCode: 'NL',
    discountPercent: 10,
  });

  assert.equal(totals.subtotal, 50);
  assert.equal(totals.discount, 5);
  assert.equal(totals.discountedSubtotal, 45);
  assert.equal(totals.shipping, 3.95);
  assert.equal(totals.grandTotal, 48.95);
  assert.equal(totals.freeShippingRemaining, 5);
  assert.equal(totals.qualifiesForFreeShipping, false);
});

test('canonical totals are identical and reconcile exactly for cart and checkout consumers', () => {
  const input = {
    items: [{ price: 49.95, quantity: 2 }],
    countryCode: 'DE',
    discountPercent: 15,
  };

  const cartTotals = calculateCommerceTotals(input);
  const checkoutTotals = calculateCommerceTotals(input);
  assert.deepEqual(cartTotals, checkoutTotals);
  assert.equal(cartTotals.discount, 14.99);
  assert.equal(cartTotals.discountedSubtotal, 84.91);
  assert.equal(cartTotals.shipping, 0);
  assert.equal(cartTotals.grandTotal, 84.91);
  assert.equal(
    roundMoney(cartTotals.subtotal - cartTotals.discount + cartTotals.shipping),
    cartTotals.grandTotal,
  );
});

test('fractional discounts remain internally consistent to the cent', () => {
  const totals = calculateCommerceTotals({
    items: [{ price: 49.95, quantity: 1 }],
    countryCode: 'NL',
    discountPercent: 10,
  });

  assert.equal(totals.subtotal, 49.95);
  assert.equal(totals.discount, 5);
  assert.equal(totals.discountedSubtotal, 44.95);
  assert.equal(totals.shipping, 3.95);
  assert.equal(totals.grandTotal, 48.9);
  assert.equal(totals.freeShippingRemaining, 5.05);
});

test('canonical totals normalize unknown countries and empty carts', () => {
  const unknownCountry = calculateCommerceTotals({
    items: [{ price: 20, quantity: 1 }],
    countryCode: 'XX',
  });
  assert.equal(unknownCountry.countryCode, 'OTHER');
  assert.equal(unknownCountry.shipping, 14.95);

  const empty = calculateCommerceTotals({ countryCode: 'NL' });
  assert.equal(empty.subtotal, 0);
  assert.equal(empty.shipping, 0);
  assert.equal(empty.grandTotal, 0);
  assert.equal(empty.freeShippingRemaining, 0);
});
