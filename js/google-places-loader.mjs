const DEFAULT_CALLBACK_NAME = '__legendGooglePlacesReady';
const DEFAULT_SCRIPT_ID = 'legend-google-places-script';
const DEFAULT_TIMEOUT_MS = 10000;

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

export function createGooglePlacesLoader({
  apiKey,
  windowRef = globalThis.window,
  documentRef = globalThis.document,
  callbackName = DEFAULT_CALLBACK_NAME,
  scriptId = DEFAULT_SCRIPT_ID,
  timeoutMs = DEFAULT_TIMEOUT_MS,
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

  function load() {
    if (isReady()) return Promise.resolve(windowRef.google);
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
        resolve(windowRef.google);
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
