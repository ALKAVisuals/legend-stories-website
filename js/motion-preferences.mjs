const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';

function addMediaQueryListener(mediaQuery, listener) {
  if (mediaQuery?.addEventListener) {
    mediaQuery.addEventListener('change', listener);
    return () => mediaQuery.removeEventListener?.('change', listener);
  }
  if (mediaQuery?.addListener) {
    mediaQuery.addListener(listener);
    return () => mediaQuery.removeListener?.(listener);
  }
  return () => {};
}

export function createAutomaticMotionGate({
  element,
  windowRef = globalThis.window,
  documentRef = globalThis.document,
  observerFactory,
} = {}) {
  if (!element) {
    throw new Error('Automatic motion requires a target element.');
  }
  if (!documentRef?.addEventListener || !windowRef) {
    throw new Error('Automatic motion requires window and document references.');
  }

  const mediaQuery = windowRef.matchMedia?.(REDUCED_MOTION_QUERY) || { matches: false };
  const Observer = observerFactory || windowRef.IntersectionObserver;
  const listeners = new Set();
  let intersecting = true;
  let destroyed = false;
  let previousSignature = '';
  let observer = null;

  function snapshot() {
    const reducedMotion = Boolean(mediaQuery.matches);
    const documentVisible = documentRef.visibilityState !== 'hidden';
    const allowed = !reducedMotion && documentVisible && intersecting;
    return Object.freeze({
      allowed,
      reducedMotion,
      documentVisible,
      intersecting,
    });
  }

  function notify({ force = false } = {}) {
    if (destroyed) return;
    const state = snapshot();
    const signature = [
      state.allowed,
      state.reducedMotion,
      state.documentVisible,
      state.intersecting,
    ].join(':');
    if (!force && signature === previousSignature) return;
    previousSignature = signature;
    for (const listener of listeners) listener(state);
  }

  const handlePreferenceChange = () => notify();
  const handleVisibilityChange = () => notify();
  const removeMediaQueryListener = addMediaQueryListener(mediaQuery, handlePreferenceChange);
  documentRef.addEventListener('visibilitychange', handleVisibilityChange);

  if (Observer) {
    observer = new Observer((entries) => {
      const entry = entries.find?.((candidate) => candidate.target === element) || entries[0];
      intersecting = Boolean(entry?.isIntersecting);
      notify();
    }, { threshold: 0.01 });
    observer.observe(element);
  }

  return Object.freeze({
    snapshot,
    isAllowed: () => snapshot().allowed,
    prefersReducedMotion: () => snapshot().reducedMotion,
    subscribe(listener, { immediate = true } = {}) {
      if (typeof listener !== 'function') {
        throw new TypeError('Automatic motion subscribers must be functions.');
      }
      listeners.add(listener);
      if (immediate) listener(snapshot());
      return () => listeners.delete(listener);
    },
    destroy() {
      if (destroyed) return;
      destroyed = true;
      listeners.clear();
      removeMediaQueryListener();
      documentRef.removeEventListener?.('visibilitychange', handleVisibilityChange);
      observer?.disconnect?.();
    },
  });
}
