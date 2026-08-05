import test from 'node:test';
import assert from 'node:assert/strict';

import {
  DEFAULT_SHIPPING_COUNTRY,
  FREE_SHIPPING_THRESHOLD,
  SHIPPING_ZONES,
  calculateShipping,
  getCheckoutCountryOptions,
  getPlacesCountryRestriction,
  getShippingMarketNotice,
  isShippingCountryEnabled,
} from '../js/commerce/shipping.mjs';

test('Netherlands remains the active default shipping market', () => {
  assert.equal(DEFAULT_SHIPPING_COUNTRY, 'NL');
  assert.equal(FREE_SHIPPING_THRESHOLD, 69);
  assert.equal(isShippingCountryEnabled('NL'), true);
  assert.equal(calculateShipping({ countryCode: 'NL', subtotal: 45 }), 4.95);
  assert.equal(calculateShipping({ countryCode: 'NL', subtotal: 69 }), 0);
});

test('United States is active at the approved launch rate', () => {
  const options = getCheckoutCountryOptions();
  const us = options.find((option) => option.code === 'US');

  assert.ok(us);
  assert.equal(us.enabled, true);
  assert.equal(us.status, 'active');
  assert.equal(us.label, 'United States');
  assert.equal(SHIPPING_ZONES.US.cost, 9.95);
  assert.equal(SHIPPING_ZONES.US.freeFrom, 69);
  assert.equal(SHIPPING_ZONES.US.customs, true);
  assert.equal(SHIPPING_ZONES.US.trackedShippingRequired, true);
  assert.equal(calculateShipping({ countryCode: 'US', subtotal: 45 }), 9.95);
  assert.equal(calculateShipping({ countryCode: 'US', subtotal: 69 }), 0);
  assert.match(getShippingMarketNotice('US'), /€9,95/i);
  assert.match(getShippingMarketNotice('US'), /free from €69/i);
  assert.match(getShippingMarketNotice('US'), /import duties and taxes/i);
});

test('all European Union delivery countries use the shared €9,95 rate', () => {
  const options = getCheckoutCountryOptions();
  const visibleCodes = options.map((option) => option.code);
  const euCodes = [
    'AT', 'BE', 'BG', 'HR', 'CY', 'CZ', 'DK', 'EE', 'FI', 'FR', 'DE', 'GR',
    'HU', 'IE', 'IT', 'LV', 'LT', 'LU', 'MT', 'PL', 'PT', 'RO', 'SK', 'SI',
    'ES', 'SE',
  ];

  assert.equal(options.length, 28);
  assert.equal(visibleCodes[0], 'NL');
  assert.equal(visibleCodes[1], 'US');
  euCodes.forEach((code) => {
    assert.equal(visibleCodes.includes(code), true);
    assert.equal(isShippingCountryEnabled(code), true);
    assert.equal(SHIPPING_ZONES[code].region, 'eu');
    assert.equal(calculateShipping({ countryCode: code, subtotal: 45 }), 9.95);
    assert.equal(calculateShipping({ countryCode: code, subtotal: 69 }), 0);
  });
});

test('destinations outside the launch markets remain unavailable', () => {
  assert.equal(isShippingCountryEnabled('CA'), false);
  assert.equal(SHIPPING_ZONES.OTHER.visibleInCheckout, false);
  assert.throws(() => calculateShipping({ countryCode: 'CA', subtotal: 45 }), /not enabled/);
});

test('Google Places follows each enabled checkout country', () => {
  assert.equal(getPlacesCountryRestriction('NL'), 'nl');
  assert.equal(getPlacesCountryRestriction('US'), 'us');
  assert.equal(getPlacesCountryRestriction('DE'), 'de');
  assert.equal(getPlacesCountryRestriction('unknown'), 'nl');
});
