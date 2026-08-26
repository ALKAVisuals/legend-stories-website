const DEFAULT_CALLBACK_NAME = '__legendGooglePlacesReady';
const DEFAULT_SCRIPT_ID = 'legend-google-places-script';
const DEFAULT_TIMEOUT_MS = 10000;
const DEFAULT_REQUEST_TIMEOUT_MS = 4000;
const REQUEST_TIMEOUT_FLAG = '__legendPlacesRequestTimeoutInstalled';

function hasPlacesApi(windowRef) {
  return Boolean(windowRef?.google?.maps?.places);
}

function deleteTemporaryCallback(windowRef, callbackName) {
  try {
    delete windowRef[callbackName];
  } catch {
    windowRef[callbackName] = undefined;
  }
}

function createFindPlaceFromQueryWithTimeout({
  originalFindPlaceFromQuery,
  windowRef,
  places,
  timeoutMs,
  receiver = null,
}) {
  const fallbackStatus = places.PlacesServiceStatus?.UNKNOWN_ERROR || 'UNKNOWN_ERROR';

  function findPlaceFromQueryWithTimeout(request, callback) {
    const target = receiver || this;
    if (typeof callback !== 'function') {
      return originalFindPlaceFromQuery.call(target, request, callback);
    }

    let settled = false;
    let timerId = null;

    const settleOnce = (results, status) => {
      if (settled) return;
      settled = true;
      if (timerId !== null) windowRef.clearTimeout?.(timerId);
      callback(results, status);
    };

    timerId = windowRef.setTimeout(
      () => settleOnce(null, fallbackStatus),
      timeoutMs,
    );

    try {
      return originalFindPlaceFromQuery.call(target, request, settleOnce);
    } catch (error) {
      settled = true;
      if (timerId !== null) windowRef.clearTimeout?.(timerId);
      throw error;
    }
  }

  try {
    Object.defineProperty(findPlaceFromQueryWithTimeout, REQUEST_TIMEOUT_FLAG, {
      configurable: false,
      enumerable: false,
      writable: false,
      value: true,
    });
  } catch {
    // The wrapper still works even if the marker cannot be attached.
  }

  return findPlaceFromQueryWithTimeout;
}

function installPrototypeRequestTimeout({
  prototype,
  originalFindPlaceFromQuery,
  windowRef,
  places,
  timeoutMs,
}) {
  const wrapped = createFindPlaceFromQueryWithTimeout({
    originalFindPlaceFromQuery,
    windowRef,
    places,
    timeoutMs,
  });
  const descriptor = Object.getOwnPropertyDescriptor(prototype, 'findPlaceFromQuery');

  try {
    Object.defineProperty(prototype, 'findPlaceFromQuery', {
      configurable: descriptor?.configurable ?? true,
      enumerable: descriptor?.enumerable ?? false,
      writable: descriptor && 'writable' in descriptor ? descriptor.writable : true,
      value: wrapped,
    });
    try {
      Object.defineProperty(prototype, REQUEST_TIMEOUT_FLAG, {
        configurable: false,
        enumerable: false,
        writable: false,
        value: true,
      });
    } catch {
      // The wrapped method itself is marked, so a prototype marker is optional.
    }
    return true;
  } catch {
    // Some browser/API combinations expose a non-configurable prototype method.
    // Direct assignment can still be allowed in that case. Without this fallback,
    // Google Places may never call back and the checkout can remain stuck forever.
    try {
      prototype.findPlaceFromQuery = findPlaceFromQueryWithTimeout;
      if (prototype.findPlaceFromQuery !== findPlaceFromQueryWithTimeout) return false;
      try {
        prototype[REQUEST_TIMEOUT_FLAG] = true;
      } catch {
        // The timeout wrapper itself is the important part; the flag is optional here.
      }
      return true;
    } catch {
      return false;
    }
  }
}

function installConstructorRequestTimeout({
  places,
  OriginalPlacesService,
  windowRef,
  timeoutMs,
}) {
  function TimedPlacesService(...args) {
    const service = Reflect.construct(OriginalPlacesService, args, OriginalPlacesService);
    const originalFindPlaceFromQuery = service?.findPlaceFromQuery;

    if (typeof originalFindPlaceFromQuery !== 'function') {
      return service;
    }

    const wrapped = createFindPlaceFromQueryWithTimeout({
      originalFindPlaceFromQuery,
      windowRef,
      places,
      timeoutMs,
      receiver: service,
    });

    try {
      Object.defineProperty(service, 'findPlaceFromQuery', {
        configurable: true,
        enumerable: false,
        writable: true,
        value: wrapped,
      });
      return service;
    } catch {
      if (typeof Proxy !== 'function') {
        throw new Error('Google Places request timeout guard could not be installed.');
      }
      return new Proxy(service, {
        get(target, property, receiverRef) {
          if (property === 'findPlaceFromQuery') return wrapped;
          return Reflect.get(target, property, receiverRef);
        },
      });
    }
  }

  try {
    TimedPlacesService.prototype = OriginalPlacesService.prototype;
    Object.setPrototypeOf?.(TimedPlacesService, OriginalPlacesService);
    Object.defineProperty(TimedPlacesService, REQUEST_TIMEOUT_FLAG, {
      configurable: false,
      enumerable: false,
      writable: false,
      value: true,
    });
  } catch {
    // Static/prototype metadata is best-effort; construction still returns the real service instance.
  }

  const descriptor = Object.getOwnPropertyDescriptor(places, 'PlacesService');
  try {
    Object.defineProperty(places, 'PlacesService', {
      configurable: descriptor?.configurable ?? true,
      enumerable: descriptor?.enumerable ?? true,
      writable: descriptor && 'writable' in descriptor ? descriptor.writable : true,
      value: TimedPlacesService,
    });
    return places.PlacesService === TimedPlacesService;
  } catch {
    return false;
  }
}

export function installPlacesRequestTimeout({
  windowRef = globalThis.window,
  timeoutMs = DEFAULT_REQUEST_TIMEOUT_MS,
} = {}) {
  const places = windowRef?.google?.maps?.places;
  const PlacesService = places?.PlacesService;
  const prototype = PlacesService?.prototype;
  const originalFindPlaceFromQuery = prototype?.findPlaceFromQuery;

  if (typeof originalFindPlaceFromQuery !== 'function') return false;
  if (
    prototype?.[REQUEST_TIMEOUT_FLAG]
    || originalFindPlaceFromQuery?.[REQUEST_TIMEOUT_FLAG]
    || PlacesService?.[REQUEST_TIMEOUT_FLAG]
  ) {
    return true;
  }

  const safeTimeoutMs = Math.max(500, Number(timeoutMs) || DEFAULT_REQUEST_TIMEOUT_MS);
  if (installPrototypeRequestTimeout({
    prototype,
    originalFindPlaceFromQuery,
    windowRef,
    places,
    timeoutMs: safeTimeoutMs,
  })) {
    return true;
  }

  return installConstructorRequestTimeout({
    places,
    OriginalPlacesService: PlacesService,
    windowRef,
    timeoutMs: safeTimeoutMs,
  });
}

export function createGooglePlacesLoader({
  apiKey,
  windowRef = globalThis.window,
  documentRef = globalThis.document,
  callbackName = DEFAULT_CALLBACK_NAME,
  scriptId = DEFAULT_SCRIPT_ID,
  timeoutMs = DEFAULT_TIMEOUT_MS,
  requestTimeoutMs = DEFAULT_REQUEST_TIMEOUT_MS,
} = {}) {
  if (!apiKey || typeof apiKey !== 'string') {
    throw new Error('Google Places loader requires an API key.');
  }
  if (!windowRef?.setTimeout || !documentRef?.createElement || !documentRef?.head?.appendChild) {
    throw new Error('Google Places loader requires browser window and document references.');
  }

  let loadPromise = null;

  function isReady() {
    return hasPlacesApi(windowRef);
  }

  function preparePlacesApi() {
    const timeoutInstalled = installPlacesRequestTimeout({
      windowRef,
      timeoutMs: requestTimeoutMs,
    });
    if (!timeoutInstalled) {
      throw new Error('Google Places request timeout guard could not be installed.');
    }
    return windowRef.google;
  }

  function load() {
    if (isReady()) return Promise.resolve().then(() => preparePlacesApi());
    if (loadPromise) return loadPromise;

    loadPromise = new Promise((resolve, reject) => {
      let settled = false;
      let timerId = null;
      let script = null;

      function cleanup() {
        if (timerId !== null) windowRef.clearTimeout?.(timerId);
        deleteTemporaryCallback(windowRef, callbackName);
        if (script) script.onerror = null;
      }

      function succeed() {
        if (settled) return;
        settled = true;
        cleanup();
        try {
          resolve(preparePlacesApi());
        } catch (error) {
          reject(error);
        }
      }

      function fail(message) {
        if (settled) return;
        settled = true;
        cleanup();
        script?.remove?.();
        reject(message instanceof Error ? message : new Error(String(message)));
      }

      const staleScript = documentRef.getElementById?.(scriptId);
      staleScript?.remove?.();

      windowRef[callbackName] = () => {
        if (isReady()) succeed();
        else fail('Google Places loaded without the Places library.');
      };

      script = documentRef.createElement('script');
      script.id = scriptId;
      script.src = 'https://maps.googleapis.com/maps/api/js?' + new URLSearchParams({
        key: apiKey,
        libraries: 'places',
        callback: callbackName,
        loading: 'async',
      }).toString();
      script.async = true;
      script.defer = true;
      script.onerror = () => fail('Google Places could not be loaded.');

      timerId = windowRef.setTimeout(
        () => fail('Google Places loading timed out.'),
        Math.max(1000, Number(timeoutMs) || DEFAULT_TIMEOUT_MS),
      );

      documentRef.head.appendChild(script);
    }).catch((error) => {
      loadPromise = null;
      throw error;
    });

    return loadPromise;
  }

  return Object.freeze({
    isReady,
    load,
  });
}
