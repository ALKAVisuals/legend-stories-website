import assert from 'node:assert/strict';
import test from 'node:test';

import { createGooglePlacesLoader } from '../js/google-places-loader.mjs';

class FakeScript {
  constructor(documentRef) {
    this.documentRef = documentRef;
    this.id = '';
    this.src = '';
    this.async = false;
    this.defer = false;
    this.onerror = null;
    this.removed = false;
  }

  remove() {
    this.removed = true;
    this.documentRef.scripts = this.documentRef.scripts.filter((script) => script !== this);
  }
}

class FakeDocument {
  constructor() {
    this.scripts = [];
    this.head = {
      appendChild: (script) => {
        this.scripts.push(script);
        return script;
      },
    };
  }

  createElement(tag) {
    assert.equal(tag, 'script');
    return new FakeScript(this);
  }

  getElementById(id) {
    return this.scripts.find((script) => script.id === id) || null;
  }
}

function setup({ ready = false, timeoutMs = 10000 } = {}) {
  const documentRef = new FakeDocument();
  const timers = new Map();
  let nextTimer = 1;
  const windowRef = {
    google: ready ? { maps: { places: {} } } : undefined,
    setTimeout(callback) {
      const id = nextTimer++;
      timers.set(id, callback);
      return id;
    },
    clearTimeout(id) {
      timers.delete(id);
    },
  };
  const loader = createGooglePlacesLoader({
    apiKey: 'test-key',
    windowRef,
    documentRef,
    timeoutMs,
  });
  return {
    documentRef,
    loader,
    timers,
    windowRef,
    triggerTimeout() {
      const callback = [...timers.values()][0];
      callback?.();
    },
  };
}

test('resolves immediately when the Places API already exists', async () => {
  const { documentRef, loader, windowRef } = setup({ ready: true });
  assert.equal(loader.isReady(), true);
  assert.equal(await loader.load(), windowRef.google);
  assert.equal(documentRef.scripts.length, 0);
});

test('deduplicates concurrent script loads', () => {
  const { documentRef, loader } = setup();
  const first = loader.load();
  const second = loader.load();
  assert.equal(first, second);
  assert.equal(documentRef.scripts.length, 1);
  assert.match(documentRef.scripts[0].src, /libraries=places/);
  assert.match(documentRef.scripts[0].src, /loading=async/);
});

test('resolves through a temporary callback and cleans it up', async () => {
  const { documentRef, loader, timers, windowRef } = setup();
  const promise = loader.load();
  windowRef.google = { maps: { places: { Autocomplete: class {} } } };
  windowRef.__legendGooglePlacesReady();
  assert.equal(await promise, windowRef.google);
  assert.equal('__legendGooglePlacesReady' in windowRef, false);
  assert.equal(timers.size, 0);
  assert.equal(documentRef.scripts[0].removed, false);
});

test('rejects script errors, removes the failed script and permits retry', async () => {
  const { documentRef, loader } = setup();
  const first = loader.load();
  documentRef.scripts[0].onerror();
  await assert.rejects(first, /could not be loaded/);
  assert.equal(documentRef.scripts.length, 0);

  const second = loader.load();
  assert.notEqual(second, first);
  assert.equal(documentRef.scripts.length, 1);
  documentRef.scripts[0].onerror();
  await assert.rejects(second, /could not be loaded/);
});

test('rejects and cleans up when loading times out', async () => {
  const { documentRef, loader, triggerTimeout, windowRef } = setup({ timeoutMs: 1500 });
  const promise = loader.load();
  triggerTimeout();
  await assert.rejects(promise, /timed out/);
  assert.equal(documentRef.scripts.length, 0);
  assert.equal('__legendGooglePlacesReady' in windowRef, false);
});

test('rejects a callback that arrives without the Places library', async () => {
  const { loader, windowRef } = setup();
  const promise = loader.load();
  windowRef.__legendGooglePlacesReady();
  await assert.rejects(promise, /without the Places library/);
});
