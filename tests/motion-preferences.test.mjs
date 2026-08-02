import assert from 'node:assert/strict';
import test from 'node:test';

import { createAutomaticMotionGate } from '../js/motion-preferences.mjs';

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

  emit(type) {
    for (const listener of this.listeners.get(type) || []) listener({ type, target: this });
  }
}

class FakeMediaQuery extends FakeEventTarget {
  constructor(matches = false) {
    super();
    this.matches = matches;
  }

  setMatches(matches) {
    this.matches = Boolean(matches);
    this.emit('change');
  }
}

class FakeIntersectionObserver {
  static instances = [];

  constructor(callback) {
    this.callback = callback;
    this.observed = new Set();
    this.disconnected = false;
    FakeIntersectionObserver.instances.push(this);
  }

  observe(element) {
    this.observed.add(element);
  }

  disconnect() {
    this.disconnected = true;
    this.observed.clear();
  }

  setIntersecting(element, isIntersecting) {
    this.callback([{ target: element, isIntersecting }]);
  }
}

function setup({ reducedMotion = false, visibilityState = 'visible' } = {}) {
  FakeIntersectionObserver.instances = [];
  const element = { id: 'animated-surface' };
  const documentRef = new FakeEventTarget();
  documentRef.visibilityState = visibilityState;
  const mediaQuery = new FakeMediaQuery(reducedMotion);
  const windowRef = {
    matchMedia: () => mediaQuery,
    IntersectionObserver: FakeIntersectionObserver,
  };
  const gate = createAutomaticMotionGate({ element, windowRef, documentRef });
  const observer = FakeIntersectionObserver.instances[0];
  return { documentRef, element, gate, mediaQuery, observer };
}

test('allows automatic motion when visible, intersecting and unrestricted', () => {
  const { gate } = setup();
  assert.deepEqual(gate.snapshot(), {
    allowed: true,
    reducedMotion: false,
    documentVisible: true,
    intersecting: true,
  });
});

test('blocks automatic motion for reduced-motion preferences', () => {
  const { gate, mediaQuery } = setup();
  mediaQuery.setMatches(true);
  assert.equal(gate.isAllowed(), false);
  assert.equal(gate.prefersReducedMotion(), true);
});

test('blocks automatic motion while the document is hidden', () => {
  const { documentRef, gate } = setup();
  documentRef.visibilityState = 'hidden';
  documentRef.emit('visibilitychange');
  assert.equal(gate.isAllowed(), false);
});

test('blocks automatic motion while the target is outside the viewport', () => {
  const { element, gate, observer } = setup();
  observer.setIntersecting(element, false);
  assert.equal(gate.isAllowed(), false);
  observer.setIntersecting(element, true);
  assert.equal(gate.isAllowed(), true);
});

test('subscribers receive state transitions and can unsubscribe', () => {
  const { gate, mediaQuery } = setup();
  const states = [];
  const unsubscribe = gate.subscribe((state) => states.push(state.allowed));
  mediaQuery.setMatches(true);
  unsubscribe();
  mediaQuery.setMatches(false);
  assert.deepEqual(states, [true, false]);
});

test('destroy removes observers and future notifications', () => {
  const { documentRef, gate, mediaQuery, observer } = setup();
  const states = [];
  gate.subscribe((state) => states.push(state.allowed));
  gate.destroy();
  mediaQuery.setMatches(true);
  documentRef.visibilityState = 'hidden';
  documentRef.emit('visibilitychange');
  assert.deepEqual(states, [true]);
  assert.equal(observer.disconnected, true);
});
