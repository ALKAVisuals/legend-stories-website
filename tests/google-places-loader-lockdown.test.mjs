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

function createRuntime({ google } = {}) {
  const timers = new Map();
  let nextTimer = 1;
  const windowRef = {
    google,
    setTimeout(callback) {
      const id = nextTimer++;
      timers.set(id, callback);
      return id;
    },
    clearTimeout(id) {
      timers.delete(id);
    },
  };
  const documentRef = new FakeDocument();
  return {
    documentRef,
    timers,
    windowRef,
    triggerNextTimer() {
      const [id, callback] = [...timers.entries()][0] || [];
      if (id !== undefined) timers.delete(id);
      callback?.();
    },
  };
}

function createLockedPlacesService() {
  class PlacesService {
    findPlaceFromQuery(request, callback) {
      this.request = request;
      this.googleCallback = callback;
      return 'request-handle';
    }
  }

  const original = PlacesService.prototype.findPlaceFromQuery;
  Object.defineProperty(PlacesService.prototype, 'findPlaceFromQuery', {
    configurable: false,
    enumerable: false,
    writable: false,
    value: original,
  });

  return PlacesService;
}

test('uses a constructor guard when Google locks the PlacesService prototype method', async () => {
  const OriginalPlacesService = createLockedPlacesService();
  const places = {
    PlacesService: OriginalPlacesService,
    PlacesServiceStatus: {
      OK: 'OK',
      UNKNOWN_ERROR: 'UNKNOWN_ERROR',
    },
  };
  const { documentRef, timers, triggerNextTimer, windowRef } = createRuntime({
    google: { maps: { places } },
  });
  const loader = createGooglePlacesLoader({
    apiKey: 'test-key',
    windowRef,
    documentRef,
    requestTimeoutMs: 1200,
  });

  await loader.load();
  assert.notEqual(places.PlacesService, OriginalPlacesService);

  const service = new places.PlacesService();
  const callbacks = [];
  const requestHandle = service.findPlaceFromQuery(
    { query: 'Schutkolk 4d, 6582 DB Heumen, NL' },
    (results, status) => callbacks.push({ results, status }),
  );

  assert.equal(requestHandle, 'request-handle');
  assert.equal(timers.size, 1);
  triggerNextTimer();
  assert.deepEqual(callbacks, [{ results: null, status: 'UNKNOWN_ERROR' }]);

  service.googleCallback([{ formatted_address: 'Schutkolk 4d' }], 'OK');
  assert.equal(callbacks.length, 1);
});

test('rejects instead of hanging when neither prototype nor constructor can be guarded', async () => {
  const OriginalPlacesService = createLockedPlacesService();
  const places = {
    PlacesServiceStatus: {
      OK: 'OK',
      UNKNOWN_ERROR: 'UNKNOWN_ERROR',
    },
  };
  Object.defineProperty(places, 'PlacesService', {
    configurable: false,
    enumerable: true,
    writable: false,
    value: OriginalPlacesService,
  });

  const { documentRef, timers, windowRef } = createRuntime();
  const loader = createGooglePlacesLoader({
    apiKey: 'test-key',
    windowRef,
    documentRef,
    timeoutMs: 1500,
    requestTimeoutMs: 1200,
  });

  const loadPromise = loader.load();
  assert.equal(documentRef.scripts.length, 1);
  assert.equal(timers.size, 1);

  windowRef.google = { maps: { places } };
  windowRef.__legendGooglePlacesReady();

  await assert.rejects(loadPromise, /request timeout guard could not be installed/);
  assert.equal(timers.size, 0);
  assert.equal('__legendGooglePlacesReady' in windowRef, false);
});
