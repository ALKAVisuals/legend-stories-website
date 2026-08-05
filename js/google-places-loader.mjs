const DEFAULT_CALLBACK_NAME = '__legendGooglePlacesReady';
const DEFAULT_SCRIPT_ID = 'legend-google-places-script';
const DEFAULT_TIMEOUT_MS = 10000;
const DEFAULT_REQUEST_TIMEOUT_MS = 2500;
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

export function installPlacesRequestTimeout({
  windowRef = globalThis.window,
  timeoutMs = DEFAULT_REQUEST_TIMEOUT_MS,
} = {}) {
  const places = windowRef?.google?.maps?.places;
  const prototype = places?.PlacesService?.prototype;
  const originalFindPlaceFromQuery = prototype?.findPlaceFromQuery;

  if (typeof originalFindPlaceFromQuery !== 'function') return false;
  if (prototype[REQUEST_TIMEOUT_FLAG]) return true;

  const safeTimeoutMs = Math.max(500, Number(timeoutMs) || DEFAULT_REQUEST_TIMEOUT_MS);
  const fallbackStatus = places.PlacesServiceStatus?.UNKNOWN_ERROR || 'UNKNOWN_ERROR';

  function findPlaceFromQueryWithTimeout(request, callback) {
    if (typeof callback !== 'function') {
      return originalFindPlaceFromQuery.call(this, request, callback);
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
      safeTimeoutMs,
    );

    try {
      return originalFindPlaceFromQuery.call(this, request, settleOnce);
    } catch (error) {
      settled = true;
      if (timerId !== null) windowRef.clearTimeout?.(timerId);
      throw error;
    }
  }

  try {
    Object.defineProperty(prototype, 'findPlaceFromQuery', {
      configurable: true,
      writable: true,
      value: findPlaceFromQueryWithTimeout,
    });
    Object.defineProperty(prototype, REQUEST_TIMEOUT_FLAG, {
      configurable: false,
      enumerable: false,
      writable: false,
      value: true,
    });
    return true;
  } catch {
    return false;
  }
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
    installPlacesRequestTimeout({ windowRef, timeoutMs: requestTimeoutMs });
    return windowRef.google;
  }

  function load() {
    if (isReady()) return Promise.resolve(preparePlacesApi());
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
        resolve(preparePlacesApi());
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
