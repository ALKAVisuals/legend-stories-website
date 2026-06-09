// ═══════════════════════════════════════════════════════════
// Social Video Showcase — iframe autoplay, adaptive layout
// ═══════════════════════════════════════════════════════════

(function () {
  'use strict';

  // ── State ──
  var autoTimer = null;
  var currentIdx = 0;
  var isPlaying = false;
  var ADVANCE_MS = 8000;

  // ── Video data from DOM ──
  function getVideos() {
    var result = [];
    document.querySelectorAll('.social-thumb').forEach(function (t) {
      result.push({
        url:     t.getAttribute('data-url'),
        platform:t.getAttribute('data-platform'),
        videoId: t.getAttribute('data-video-id') || '',
        ratio:   t.getAttribute('data-ratio') || '9/16'
      });
    });
    return result;
  }

  // ── Build embed URL ──
  function embedURL(v) {
    if (v.platform === 'tiktok') {
      return 'https://www.tiktok.com/embed/v2/' + (v.videoId || '') + '?autoplay=1&mute=1';
    }
    // Instagram
    var sc = v.url.match(/instagram\.com\/(?:p|reel)\/([A-Za-z0-9_-]+)/);
    return sc
      ? 'https://www.instagram.com/p/' + sc[1] + '/embed/'
      : v.url;
  }

  // ── Switch video ──
  window.switchVideo = function (thumb) {
    var videos = getVideos();
    var idx = parseInt(thumb.getAttribute('data-index'), 10);
    if (idx < 0 || idx >= videos.length) return;

    var v = videos[idx];
    currentIdx = idx;
    isPlaying = false;

    // Update iframe
    var iframe = document.getElementById('social-embed');
    if (iframe) iframe.src = embedURL(v);

    // Update container aspect ratio
    var wrap = document.getElementById('social-featured__wrap');
    if (wrap) wrap.setAttribute('data-ar', v.ratio);

    // Update badge
    var badge = document.getElementById('social-platform-badge');
    if (badge) {
      badge.className = 'social-featured__badge social-featured__badge--' + v.platform;
      badge.innerHTML = v.platform === 'tiktok'
        ? '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.5 2.89 2.89 0 01-2.89-2.89 2.89 2.89 0 012.89-2.89c.28 0 .54.04.79.1v-3.5a6.37 6.37 0 00-.79-.05A6.34 6.34 0 003.15 15.2a6.34 6.34 0 006.34 6.34 6.34 6.34 0 006.34-6.34V8.73a8.19 8.19 0 004.76 1.52V6.8a4.84 4.84 0 01-1-.11z"/></svg><span>TikTok</span>'
        : '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069z"/></svg><span>Instagram</span>';
    }

    // Show overlay
    var overlay = document.getElementById('social-overlay');
    if (overlay) overlay.classList.remove('is-hidden');

    // Active thumbnail
    document.querySelectorAll('.social-thumb').forEach(function (t) {
      t.classList.toggle('social-thumb--active', parseInt(t.getAttribute('data-index'), 10) === idx);
    });

    resetTimer();
  };

  // ── Hide overlay on click ──
  window.activateFeatured = function () {
    var overlay = document.getElementById('social-overlay');
    if (overlay) { overlay.classList.add('is-hidden'); isPlaying = true; }
    stopTimer();
  };

  // ── Auto-advance ──
  function startTimer() {
    stopTimer();
    autoTimer = setInterval(function () {
      if (isPlaying) return;
      var videos = getVideos();
      if (!videos.length) return;
      currentIdx = (currentIdx + 1) % videos.length;
      var next = document.querySelector('.social-thumb[data-index="' + currentIdx + '"]');
      if (next) next.click();
    }, ADVANCE_MS);
  }
  function stopTimer() { if (autoTimer) { clearInterval(autoTimer); autoTimer = null; } }
  function resetTimer() { isPlaying = false; startTimer(); }

  // ── Init ──
  function init() {
    var showcase = document.getElementById('social-showcase');
    if (!showcase) return;

    // Set initial ratio from active thumb
    var active = document.querySelector('.social-thumb--active');
    if (active) {
      var wrap = document.getElementById('social-featured__wrap');
      if (wrap) wrap.setAttribute('data-ar', active.getAttribute('data-ratio') || '9/16');
    }

    startTimer();

    showcase.addEventListener('mouseenter', stopTimer);
    showcase.addEventListener('mouseleave', function () { if (!isPlaying) startTimer(); });
    showcase.addEventListener('touchstart', stopTimer, { passive: true });
    showcase.addEventListener('touchend', function () { setTimeout(function () { if (!isPlaying) startTimer(); }, 3000); });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
