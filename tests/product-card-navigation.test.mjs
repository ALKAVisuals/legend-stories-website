import test from 'node:test';
import assert from 'node:assert/strict';

import {
  initProductCardNavigation,
  isProductCardActivationKey,
  resolveProductCardHref,
  shouldIgnoreProductCardClick,
} from '../js/product-card-navigation.mjs';

function createCard({ href = '', name = 'Example Product' } = {}) {
  const handlers = {};
  const attributes = new Map();
  return {
    dataset: { productHref: href },
    handlers,
    querySelector(selector) {
      return selector === 'h3' ? { textContent: name } : null;
    },
    addEventListener(type, handler) {
      handlers[type] = handler;
    },
    hasAttribute(name) {
      return attributes.has(name);
    },
    setAttribute(name, value) {
      attributes.set(name, value);
    },
    getAttribute(name) {
      return attributes.get(name);
    },
  };
}

test('uses Enter as the link activation key', () => {
  assert.equal(isProductCardActivationKey('Enter'), true);
  assert.equal(isProductCardActivationKey(' '), false);
});

test('resolves explicit and legacy card destinations', () => {
  assert.equal(resolveProductCardHref(createCard({ href: 'explicit.html' })), 'explicit.html');
  assert.equal(
    resolveProductCardHref(createCard({ name: 'The Free Spirit' }), {
      'The Free Spirit': 'music-free-spirit.html',
    }),
    'music-free-spirit.html',
  );
});

test('ignores nested controls but not the card itself', () => {
  const card = createCard();
  const button = {};
  const buttonTarget = { closest: () => button };
  const cardTarget = { closest: () => card };
  assert.equal(shouldIgnoreProductCardClick(card, buttonTarget), true);
  assert.equal(shouldIgnoreProductCardClick(card, cardTarget), false);
});

test('binds click and keyboard navigation with accessible semantics', () => {
  const card = createCard({ href: 'product.html', name: 'Product' });
  const root = { querySelectorAll: () => [card] };
  const navigations = [];
  const initialized = initProductCardNavigation({
    root,
    navigate: (href) => navigations.push(href),
  });

  assert.equal(initialized, 1);
  assert.equal(card.getAttribute('role'), 'link');
  assert.equal(card.getAttribute('tabindex'), '0');
  assert.equal(card.getAttribute('aria-label'), 'View Product');

  card.handlers.click({ target: { closest: () => card } });
  let prevented = false;
  card.handlers.keydown({
    target: card,
    key: 'Enter',
    preventDefault: () => { prevented = true; },
  });

  assert.equal(prevented, true);
  assert.deepEqual(navigations, ['product.html', 'product.html']);
});

test('does not hijack add-to-cart button clicks', () => {
  const card = createCard({ href: 'product.html' });
  const button = {};
  const root = { querySelectorAll: () => [card] };
  const navigations = [];
  initProductCardNavigation({ root, navigate: (href) => navigations.push(href) });

  card.handlers.click({ target: { closest: () => button } });
  assert.deepEqual(navigations, []);
});
