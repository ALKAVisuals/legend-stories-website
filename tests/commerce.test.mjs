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

test('launch markets use the approved shipping rates', () => {
  assert.equal(SHIPPING_ZONES.NL.cost, 4.95);
  assert.equal(SHIPPING_ZONES.NL.freeFrom, 69);
  assert.equal(SHIPPING_ZONES.NL.enabled, true);
  assert.equal(getShippingZone('DE').cost, 9.95);
  assert.equal(getShippingZone('DE').freeFrom, 69);
  assert.equal(getShippingZone('DE').enabled, true);
  assert.equal(getShippingZone('US').cost, 9.95);
  assert.equal(getShippingZone('US').freeFrom, 69);
  assert.equal(getShippingZone('US').enabled, true);
});

test('shipping applies the approved country-zone policy', () => {
  assert.equal(calculateShipping({ countryCode: 'NL', subtotal: 68.99 }), 4.95);
  assert.equal(calculateShipping({ countryCode: 'NL', subtotal: 69 }), 0);
  assert.equal(calculateShipping({ countryCode: 'DE', subtotal: 45 }), 9.95);
  assert.equal(calculateShipping({ countryCode: 'DE', subtotal: 69 }), 0);
  assert.equal(calculateShipping({ countryCode: 'US', subtotal: 45 }), 9.95);
  assert.equal(calculateShipping({ countryCode: 'US', subtotal: 69 }), 0);
  assert.throws(() => calculateShipping({ countryCode: 'CA', subtotal: 200 }), /not enabled/);
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
  ['NL', 'FR', 'US'].forEach((countryCode) => {
    const totals = calculateCommerceTotals({ items: [{ price: 69, quantity: 1 }], countryCode });
    assert.equal(totals.shipping, 0);
    assert.equal(totals.grandTotal, 69);
    assert.equal(totals.qualifiesForFreeShipping, true);
  });
});

test('EU and United States totals use €9,95 below the threshold', () => {
  const eu = calculateCommerceTotals({ items: [{ price: 45, quantity: 1 }], countryCode: 'FR' });
  const us = calculateCommerceTotals({ items: [{ price: 45, quantity: 1 }], countryCode: 'US' });

  assert.equal(eu.shipping, 9.95);
  assert.equal(eu.grandTotal, 54.95);
  assert.equal(eu.qualifiesForFreeShipping, false);
  assert.equal(us.shipping, 9.95);
  assert.equal(us.grandTotal, 54.95);
  assert.equal(us.qualifiesForFreeShipping, false);
});

test('countries outside the launch policy remain blocked', () => {
  assert.throws(() => calculateCommerceTotals({ items: [{ price: 45, quantity: 1 }], countryCode: 'CA' }), /not enabled/);
  const empty = calculateCommerceTotals({ countryCode: 'NL' });
  assert.equal(empty.subtotal, 0);
  assert.equal(empty.shipping, 0);
  assert.equal(empty.grandTotal, 0);
});
