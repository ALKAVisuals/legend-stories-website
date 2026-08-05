import test from 'node:test';
import assert from 'node:assert/strict';

import {
  DEFAULT_SHIPPING_COUNTRY,
  SHIPPING_ZONES,
  calculateShipping,
  getCheckoutCountryOptions,
  getPlacesCountryRestriction,
  getShippingMarketNotice,
  isShippingCountryEnabled,
} from '../js/commerce/shipping.mjs';

test('Netherlands remains the active default shipping market', () => {
  assert.equal(DEFAULT_SHIPPING_COUNTRY, 'NL');
  assert.equal(isShippingCountryEnabled('NL'), true);
  assert.equal(calculateShipping({ countryCode: 'NL', subtotal: 45 }), 4.95);
  assert.equal(calculateShipping({ countryCode: 'NL', subtotal: 69 }), 0);
});

test('United States is visible as the priority pilot without an invented rate', () => {
  const options = getCheckoutCountryOptions();
  const us = options.find((option) => option.code === 'US');

  assert.ok(us);
  assert.equal(us.enabled, false);
  assert.equal(us.status, 'preparing');
  assert.match(us.label, /launching soon/i);
  assert.equal(SHIPPING_ZONES.US.cost, null);
  assert.equal(SHIPPING_ZONES.US.customs, true);
  assert.equal(SHIPPING_ZONES.US.trackedShippingRequired, true);
  assert.throws(() => calculateShipping({ countryCode: 'US', subtotal: 200 }), /not enabled/);
  assert.match(getShippingMarketNotice('US'), /tracked rates and import charges/i);
});

test('planned European markets stay hidden until a validated rate is configured', () => {
  const visibleCodes = getCheckoutCountryOptions().map((option) => option.code);

  assert.deepEqual(visibleCodes, ['NL', 'US']);
  assert.equal(SHIPPING_ZONES.BE.status, 'planned');
  assert.equal(SHIPPING_ZONES.DE.status, 'planned');
  assert.equal(SHIPPING_ZONES.FR.status, 'planned');
  assert.equal(SHIPPING_ZONES.BE.visibleInCheckout, false);
  assert.equal(isShippingCountryEnabled('DE'), false);
});

test('Google Places remains restricted to an enabled checkout market', () => {
  assert.equal(getPlacesCountryRestriction('NL'), 'nl');
  assert.equal(getPlacesCountryRestriction('US'), 'nl');
  assert.equal(getPlacesCountryRestriction('unknown'), 'nl');
});
