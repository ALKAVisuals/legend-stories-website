import assert from 'node:assert/strict';
import test from 'node:test';

import { escapeCartHtml, initCartControlDelegation } from '../js/cart-controls.mjs';

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
