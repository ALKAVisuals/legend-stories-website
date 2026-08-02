import assert from 'node:assert/strict';
import test from 'node:test';

import { createMobileNavigationController } from '../js/mobile-navigation.mjs';

class FakeEventTarget {
  constructor() {
    this.listeners = new Map();
  }

  addEventListener(type, listener) {
    const listeners = this.listeners.get(type) || new Set();
    listeners.add(listener);
    this.listeners.set(type, listeners);
  }

  removeEventListener(type, listener) {
    this.listeners.get(type)?.delete(listener);
  }

  emit(type, init = {}) {
    const event = {
      type,
      target: init.target || this,
      key: init.key,
      defaultPrevented: false,
      preventDefault() {
        this.defaultPrevented = true;
      },
    };
    for (const listener of this.listeners.get(type) || []) listener(event);
    return event;
  }
}

class FakeElement extends FakeEventTarget {
  constructor(id = '') {
    super();
    this.id = id;
    this.hidden = false;
    this.attributes = new Map();
    this.children = new Set();
    this.focused = false;
    this.style = {
      removed: [],
      removeProperty: (name) => this.style.removed.push(name),
    };
  }

  setAttribute(name, value) {
    this.attributes.set(name, String(value));
  }

  getAttribute(name) {
    return this.attributes.get(name) || null;
  }

  contains(target) {
    return target === this || this.children.has(target);
  }

  append(child) {
    this.children.add(child);
  }

  focus() {
    this.focused = true;
  }
}

class FakeLink extends FakeElement {
  closest(selector) {
    return selector === 'a[href]' ? this : null;
  }
}

function setup({ width = 390 } = {}) {
  const documentRef = new FakeEventTarget();
  const windowRef = new FakeEventTarget();
  windowRef.innerWidth = width;
  const button = new FakeElement('mobile-menu-btn');
  button.setAttribute('aria-label', 'Open menu');
  const menu = new FakeElement('mobile-menu');
  const link = new FakeLink('menu-link');
  menu.append(link);
  const controller = createMobileNavigationController({
    button,
    menu,
    documentRef,
    windowRef,
  });
  return { button, controller, documentRef, link, menu, windowRef };
}

test('initializes a closed disclosure contract', () => {
  const { button, controller, menu } = setup();
  assert.equal(controller.isOpen(), false);
  assert.equal(menu.hidden, true);
  assert.equal(menu.getAttribute('aria-hidden'), 'true');
  assert.equal(button.getAttribute('aria-expanded'), 'false');
  assert.equal(button.getAttribute('aria-controls'), 'mobile-menu');
  assert.equal(button.getAttribute('aria-label'), 'Open menu');
  assert.deepEqual(menu.style.removed, ['display']);
});

test('button toggles the menu and its accessible state', () => {
  const { button, controller, menu } = setup();
  button.emit('click');
  assert.equal(controller.isOpen(), true);
  assert.equal(menu.hidden, false);
  assert.equal(menu.getAttribute('aria-hidden'), 'false');
  assert.equal(button.getAttribute('aria-expanded'), 'true');
  assert.equal(button.getAttribute('aria-label'), 'Close menu');

  button.emit('click');
  assert.equal(controller.isOpen(), false);
  assert.equal(menu.hidden, true);
});

test('Escape closes the menu and restores focus to the trigger', () => {
  const { button, controller, documentRef } = setup();
  controller.open();
  const event = documentRef.emit('keydown', { key: 'Escape' });
  assert.equal(controller.isOpen(), false);
  assert.equal(button.focused, true);
  assert.equal(event.defaultPrevented, true);
});

test('outside click and menu-link activation close without stealing focus', () => {
  const { button, controller, documentRef, link, menu } = setup();
  controller.open();
  documentRef.emit('click', { target: new FakeElement('outside') });
  assert.equal(controller.isOpen(), false);
  assert.equal(button.focused, false);

  controller.open();
  menu.emit('click', { target: link });
  assert.equal(controller.isOpen(), false);
  assert.equal(button.focused, false);
});

test('inside clicks stay open and desktop resize closes the mobile menu', () => {
  const { controller, documentRef, menu, windowRef } = setup();
  controller.open();
  documentRef.emit('click', { target: menu });
  assert.equal(controller.isOpen(), true);

  windowRef.innerWidth = 768;
  windowRef.emit('resize');
  assert.equal(controller.isOpen(), false);
});

test('destroy removes listeners and returns the menu to its closed state', () => {
  const { button, controller, menu } = setup();
  controller.open();
  controller.destroy();
  assert.equal(controller.isOpen(), false);
  button.emit('click');
  assert.equal(controller.isOpen(), false);
  assert.equal(menu.hidden, true);
});
