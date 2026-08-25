import assert from 'node:assert/strict';
import test from 'node:test';

import { installPlacesRequestTimeout } from '../js/google-places-loader.mjs';

function createPlacesWindow({ originalImplementation, timers }) {
  function PlacesService() {}

  const basePrototype = {
    findPlaceFromQuery: originalImplementation,
  };

  // Reproduce a browser/API shape where defineProperty is rejected but direct
  // assignment to the prototype is still allowed.
  PlacesService.prototype = new Proxy(basePrototype, {
    defineProperty() {
      throw new TypeError('prototype property is non-configurable');
    },
    set(target, property, value) {
      target[property] = value;
      return true;
    },
  });

  return {
    google: {
      maps: {
        places: {
          PlacesService,
          PlacesServiceStatus: {
            OK: 'OK',
            UNKNOWN_ERROR: 'UNKNOWN_ERROR',
          },
        },
      },
    },
    setTimeout(callback, delay) {
      return timers.set(callback, delay);
    },
    clearTimeout(id) {
      timers.clear(id);
    },
  };
}

function createFakeTimers() {
  let nextId = 1;
  const pending = new Map();

  return {
    set(callback, delay) {
      const id = nextId++;
      pending.set(id, { callback, delay });
      return id;
    },
    clear(id) {
      pending.delete(id);
    },
    runNext() {
      const entry = pending.entries().next();
      if (entry.done) return false;
      const [id, timer] = entry.value;
      pending.delete(id);
      timer.callback();
      return timer.delay;
    },
    get size() {
      return pending.size;
    },
  };
}

test('request timeout still installs when defineProperty is rejected', () => {
  const timers = createFakeTimers();
  const windowRef = createPlacesWindow({
    timers,
    originalImplementation() {
      // Simulate Google Places hanging forever without invoking its callback.
    },
  });

  const installed = installPlacesRequestTimeout({ windowRef, timeoutMs: 4000 });
  assert.equal(installed, true);

  const service = new windowRef.google.maps.places.PlacesService();
  const calls = [];
  service.findPlaceFromQuery({ query: 'Schutkolk 4d, 6582 DB Heumen' }, (results, status) => {
    calls.push({ results, status });
  });

  assert.equal(calls.length, 0);
  assert.equal(timers.size, 1);
  assert.equal(timers.runNext(), 4000);
  assert.deepEqual(calls, [{ results: null, status: 'UNKNOWN_ERROR' }]);
});

test('late Google response cannot trigger the checkout callback twice', () => {
  const timers = createFakeTimers();
  let googleCallback;
  const windowRef = createPlacesWindow({
    timers,
    originalImplementation(_request, callback) {
      googleCallback = callback;
    },
  });

  assert.equal(installPlacesRequestTimeout({ windowRef, timeoutMs: 4000 }), true);

  const service = new windowRef.google.maps.places.PlacesService();
  const calls = [];
  service.findPlaceFromQuery({ query: 'Example address' }, (results, status) => {
    calls.push({ results, status });
  });

  timers.runNext();
  googleCallback([{ formatted_address: 'Late result' }], 'OK');

  assert.deepEqual(calls, [{ results: null, status: 'UNKNOWN_ERROR' }]);
});
