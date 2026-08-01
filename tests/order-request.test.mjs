import test from 'node:test';
import assert from 'node:assert/strict';

import {
  createOrderRequest,
  pageFileFromPath,
  resolveProductPage,
} from '../js/commerce/order-request.mjs';

test('extracts stable HTML page identifiers from paths and URLs', () => {
  assert.equal(pageFileFromPath('/shop/combat-grind-cycle.html?source=card'), 'combat-grind-cycle.html');
  assert.equal(pageFileFromPath('music-truth-seeker.html#buy'), 'music-truth-seeker.html');
  assert.equal(pageFileFromPath('/shop/'), '');
});

test('resolves product identity from explicit, container, product-page and homepage sources', () => {
  assert.equal(resolveProductPage({ explicitPage: 'combat-grind-cycle.html' }), 'combat-grind-cycle.html');
  assert.equal(resolveProductPage({ containerPage: '/products/music-truth-seeker.html' }), 'music-truth-seeker.html');
  assert.equal(resolveProductPage({ currentPath: '/sport-lions-pride.html' }), 'sport-lions-pride.html');
  assert.equal(resolveProductPage({
    currentPath: '/index.html',
    name: 'The Grind Cycle',
    pageByName: { 'The Grind Cycle': 'combat-grind-cycle.html' },
  }), 'combat-grind-cycle.html');
  assert.equal(resolveProductPage({ currentPath: '/shop.html', name: 'Unknown' }), '');
});

test('creates a minimal order request without browser prices or totals', () => {
  const request = createOrderRequest({
    items: [{
      page: 'combat-grind-cycle.html',
      name: 'Tampered name',
      price: 0.01,
      quantity: 2,
      lineTotal: 0.02,
    }],
    countryCode: 'de',
    discountCode: ' legend10 ',
  });

  assert.deepEqual(request, {
    items: [{ page: 'combat-grind-cycle.html', quantity: 2 }],
    countryCode: 'DE',
    discountCode: 'LEGEND10',
  });
  assert.equal('price' in request.items[0], false);
  assert.equal('total' in request, false);
});

test('rejects empty carts, unstable product identities and invalid quantities', () => {
  assert.throws(() => createOrderRequest({ items: [] }), /empty cart/);
  assert.throws(() => createOrderRequest({
    items: [{ name: 'Legacy item', quantity: 1 }],
  }), /no stable product page/);
  assert.throws(() => createOrderRequest({
    items: [{ page: 'combat-grind-cycle.html', quantity: 0 }],
  }), /invalid quantity/);
});
