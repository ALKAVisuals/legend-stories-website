import {
  evaluateCollectionVideoPolicy,
  readConnectionPreferences,
} from './media/collection-video-policy.mjs';

const VIDEO_SELECTOR = 'video[data-collection-video]';
const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';

function setState(video, state) {
  video.dataset.collectionVideoState = state;
}

function prepareSources(video) {
  let changed = false;
  for (const source of video.querySelectorAll('source[data-src]')) {
    if (source.src) continue;
    source.src = source.dataset.src;
    changed = true;
  }
  if (changed) video.load();
  return changed || [...video.querySelectorAll('source')].some((source) => Boolean(source.src));
}

function createController(video, {
  motionQuery,
  connection,
  documentRef,
} = {}) {
  const state = {
    intersecting: false,
    loaded: false,
    playRequest: 0,
  };

  video.muted = true;
  video.defaultMuted = true;
  setState(video, 'poster');

  function snapshot() {
    const network = readConnectionPreferences(connection);
    return evaluateCollectionVideoPolicy({
      reducedMotion: Boolean(motionQuery?.matches),
      saveData: network.saveData,
      effectiveType: network.effectiveType,
      documentHidden: Boolean(documentRef?.hidden),
      intersecting: state.intersecting,
    });
  }

  async function synchronize() {
    const policy = snapshot();
    const request = ++state.playRequest;

    if (!policy.mayLoad) {
      video.pause();
      setState(video, policy.reason);
      return policy;
    }

    if (!state.loaded) {
      state.loaded = prepareSources(video);
      setState(video, state.loaded ? 'ready' : 'poster');
    }

    if (!policy.shouldPlay || !state.loaded) {
      video.pause();
      setState(video, state.loaded ? 'paused' : 'poster');
      return policy;
    }

    try {
      await video.play();
      if (request === state.playRequest && snapshot().shouldPlay) {
        setState(video, 'playing');
      } else {
        video.pause();
        setState(video, 'paused');
      }
    } catch {
      if (request === state.playRequest) setState(video, 'play-blocked');
    }
    return policy;
  }

  return Object.freeze({
    setIntersecting(value) {
      state.intersecting = Boolean(value);
      return synchronize();
    },
    synchronize,
    pause() {
      state.playRequest += 1;
      video.pause();
      if (state.loaded) setState(video, 'paused');
    },
  });
}

function initializeCollectionVideos() {
  const videos = [...document.querySelectorAll(VIDEO_SELECTOR)];
  if (!videos.length) return;

  const motionQuery = window.matchMedia?.(REDUCED_MOTION_QUERY) || { matches: false };
  const connection = navigator.connection
    || navigator.mozConnection
    || navigator.webkitConnection
    || null;
  const controllers = new Map(
    videos.map((video) => [
      video,
      createController(video, {
        motionQuery,
        connection,
        documentRef: document,
      }),
    ]),
  );

  let observer = null;
  if ('IntersectionObserver' in window) {
    observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        controllers.get(entry.target)?.setIntersecting(entry.isIntersecting);
      }
    }, {
      rootMargin: '100px 0px',
      threshold: 0.05,
    });
    for (const video of videos) observer.observe(video);
  } else {
    for (const controller of controllers.values()) controller.setIntersecting(true);
  }

  const synchronizeAll = () => {
    for (const controller of controllers.values()) controller.synchronize();
  };
  const pauseAll = () => {
    for (const controller of controllers.values()) controller.pause();
  };

  document.addEventListener('visibilitychange', synchronizeAll, { passive: true });
  motionQuery.addEventListener?.('change', synchronizeAll);
  connection?.addEventListener?.('change', synchronizeAll);
  window.addEventListener('pagehide', pauseAll, { passive: true });

  window.addEventListener('pageshow', synchronizeAll, { passive: true });
  window.addEventListener('beforeunload', () => observer?.disconnect(), { once: true });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeCollectionVideos, { once: true });
} else {
  initializeCollectionVideos();
}
