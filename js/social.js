// ═══════════════════════════════════════════════════════════
// Social Video Showcase v2 — iframe autoplay
// ═══════════════════════════════════════════════════════════

function switchVideo(thumb) {
  var index = parseInt(thumb.getAttribute('data-index'), 10);
  var videos = getVideoData();
  if (index < 0 || index >= videos.length) return;

  var video = videos[index];
  socialCurrentIndex = index;
  socialIsPlaying = false;

  // 1. Update iframe src — browser autoplay kicks in via ?autoplay=1&mute=1
  var iframe = document.getElementById('social-embed');
  if (iframe) {
    iframe.src = buildEmbedURL(video);
  }

  // 2. Update platform badge
  updateBadge(video.platform);

  // 3. Show overlay (user can click to unmute / interact)
  var overlay = document.getElementById('social-overlay');
  if (overlay) overlay.classList.remove('is-hidden');

  // 4. Update active thumbnail
  document.querySelectorAll('.social-thumb').forEach(function(t) {
    t.classList.remove('social-thumb--active');
  });
  thumb.classList.add('social-thumb--active');

  // 5. Reset auto-advance
  resetAutoAdvance();
}

function activateFeatured() {
  var overlay = document.getElementById('social-overlay');
  if (overlay) {
    overlay.classList.add('is-hidden');
    socialIsPlaying = true;
  }
  stopAutoAdvance();
}

// ── Helpers ──

function getVideoData() {
  var thumbs = document.querySelectorAll('.social-thumb');
  var data = [];
  thumbs.forEach(function(t) {
    data.push({
      url: t.getAttribute('data-url'),
      platform: t.getAttribute('data-platform'),
      videoId: t.getAttribute('data-video-id') || ''
    });
  });
  return data;
}

function buildEmbedURL(video) {
  if (video.platform === 'tiktok') {
    return 'https://www.tiktok.com/embed/v2/' + (video.videoId || '') + '?autoplay=1&mute=1';
  }
  // Instagram: extract shortcode and use embed URL
  var shortcode = extractInstagramShortcode(video.url);
  return shortcode
    ? 'https://www.instagram.com/p/' + shortcode + '/embed/?autoplay=1'
    : video.url;
}

function extractInstagramShortcode(url) {
  if (!url) return '';
  var m = url.match(/instagram\.com\/(?:p|reel)\/([A-Za-z0-9_-]+)/);
  return m ? m[1] : '';
}

function updateBadge(platform) {
  var badge = document.getElementById('social-platform-badge');
  if (!badge) return;
  badge.className = 'social-featured__badge social-featured__badge--' + platform;
  badge.innerHTML = (platform === 'tiktok')
    ? '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.5 2.89 2.89 0 01-2.89-2.89 2.89 2.89 0 012.89-2.89c.28 0 .54.04.79.1v-3.5a6.37 6.37 0 00-.79-.05A6.34 6.34 0 003.15 15.2a6.34 6.34 0 006.34 6.34 6.34 6.34 0 006.34-6.34V8.73a8.19 8.19 0 004.76 1.52V6.8a4.84 4.84 0 01-1-.11z"/></svg><span>TikTok</span>'
    : '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069z"/></svg><span>Instagram</span>';
}

// Auto-advance carousel
var socialAutoAdvance = null;
var socialCurrentIndex = 0;
var socialIsPlaying = false;
var socialAdvanceInterval = 8000;

function startAutoAdvance() {
  stopAutoAdvance();
  socialAutoAdvance = setInterval(function() {
    if (socialIsPlaying) return;
    var videos = getVideoData();
    if (!videos.length) return;
    socialCurrentIndex = (socialCurrentIndex + 1) % videos.length;
    var next = document.querySelector('.social-thumb[data-index="' + socialCurrentIndex + '"]');
    if (next) next.click();
  }, socialAdvanceInterval);
}

function stopAutoAdvance() {
  if (socialAutoAdvance) { clearInterval(socialAutoAdvance); socialAutoAdvance = null; }
}

function resetAutoAdvance() {
  socialIsPlaying = false;
  startAutoAdvance();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', startAutoAdvance);
} else {
  startAutoAdvance();
}

var showcaseEl = document.getElementById('social-showcase');
if (showcaseEl) {
  showcaseEl.addEventListener('mouseenter', stopAutoAdvance);
  showcaseEl.addEventListener('mouseleave', function() { if (!socialIsPlaying) startAutoAdvance(); });
}

document.addEventListener('DOMContentLoaded', function() {
  var sc = document.getElementById('social-showcase');
  if (!sc) return;
  sc.addEventListener('touchstart', stopAutoAdvance, { passive: true });
  sc.addEventListener('touchend', function() { setTimeout(function() { if (!socialIsPlaying) startAutoAdvance(); }, 3000); });
});

function initHoverExpandMobile() {}
