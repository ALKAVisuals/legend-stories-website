import assert from 'node:assert/strict';
import test from 'node:test';

import {
  escapeCartHtml,
  initCartControlDelegation,
  renderCartItemMarkup,
} from '../js/cart-controls.mjs';

class FakeContainer {
  constructor() {
    this.listeners = new Map();
    this.children = new Set();
  }

  addEventListener(type, listener) {
    this.listeners.set(type, listener);
  }

  removeEventListener(type, listener) {
    if (this.listeners.get(type) === listener) this.listeners.delete(type);
  }

  contains(element) {
    return this.children.has(element);
  }

  append(element) {
    this.children.add(element);
  }

  click(target) {
    const event = {
      target,
      defaultPrevented: false,
      preventDefault() {
        this.defaultPrevented = true;
      },
    };
    this.listeners.get('click')?.(event);
    return event;
  }
}

class FakeControl {
  constructor(action, index) {
    this.dataset = { cartAction: action, cartIndex: String(index) };
  }

  closest(selector) {
    return selector === '[data-cart-action][data-cart-index]' ? this : null;
  }
}

class FakeNestedTarget {
  constructor(control) {
    this.control = control;
  }

  closest(selector) {
    return selector === '[data-cart-action][data-cart-index]' ? this.control : null;
  }
}

function setup() {
  const container = new FakeContainer();
  const updates = [];
  const removals = [];
  const controller = initCartControlDelegation({
    container,
    onUpdateQuantity: (index, delta) => updates.push([index, delta]),
    onRemoveItem: (index) => removals.push(index),
  });
  return { container, controller, removals, updates };
}

test('delegates increment and decrement actions', () => {
  const { container, updates } = setup();
  const decrement = new FakeControl('decrement', 2);
  const increment = new FakeControl('increment', 4);
  container.append(decrement);
  container.append(increment);
  assert.equal(container.click(decrement).defaultPrevented, true);
  assert.equal(container.click(increment).defaultPrevented, true);
  assert.deepEqual(updates, [[2, -1], [4, 1]]);
});

test('delegates remove actions from nested icons', () => {
  const { container, removals } = setup();
  const remove = new FakeControl('remove', 3);
  container.append(remove);
  const event = container.click(new FakeNestedTarget(remove));
  assert.equal(event.defaultPrevented, true);
  assert.deepEqual(removals, [3]);
});

test('ignores controls outside the cart container', () => {
  const { container, removals, updates } = setup();
  container.click(new FakeControl('remove', 1));
  assert.deepEqual(removals, []);
  assert.deepEqual(updates, []);
});

test('ignores invalid actions and indexes', () => {
  const { container, removals, updates } = setup();
  const invalidAction = new FakeControl('checkout', 1);
  const invalidIndex = new FakeControl('increment', -1);
  container.append(invalidAction);
  container.append(invalidIndex);
  container.click(invalidAction);
  container.click(invalidIndex);
  assert.deepEqual(removals, []);
  assert.deepEqual(updates, []);
});

test('destroy removes the delegated listener', () => {
  const { container, controller, updates } = setup();
  const increment = new FakeControl('increment', 0);
  container.append(increment);
  controller.destroy();
  container.click(increment);
  assert.deepEqual(updates, []);
});

test('escapes cart text and attribute content', () => {
  assert.equal(
    escapeCartHtml(`A&B <script> "quote" 'single'`),
    'A&amp;B &lt;script&gt; &quot;quote&quot; &#039;single&#039;',
  );
});

test('renders delegated accessible cart controls without inline code', () => {
  const markup = renderCartItemMarkup({
    item: {
      name: `Hero <script>alert('x')</script>`,
      image: 'media/products/hero".webp',
      price: 12.5,
      quantity: 2,
    },
    index: 4,
    formatPrice: (value) => `€${value.toFixed(2)}`,
  });

  assert.match(markup, /data-cart-action="decrement" data-cart-index="4"/);
  assert.match(markup, /data-cart-action="increment" data-cart-index="4"/);
  assert.match(markup, /data-cart-action="remove" data-cart-index="4"/);
  assert.match(markup, /aria-label="Decrease quantity"/);
  assert.match(markup, /aria-label="Increase quantity"/);
  assert.match(markup, /aria-label="Remove Hero &lt;script&gt;/);
  assert.match(markup, /src="media\/products\/hero&quot;\.webp"/);
  assert.match(markup, /€25\.00/);
  assert.doesNotMatch(markup, /onclick=/);
  assert.doesNotMatch(markup, /<script>alert/);
});

test('rejects incomplete cart markup input', () => {
  assert.throws(
    () => renderCartItemMarkup({ item: null, index: 0, formatPrice: () => '' }),
    /requires an item/,
  );
});
