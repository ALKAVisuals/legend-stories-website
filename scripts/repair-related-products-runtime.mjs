import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const APP_FILE = join(process.cwd(), 'js/app.js');
const source = await readFile(APP_FILE, 'utf8');
const databaseMarker = '  // PRODUCT DATABASE - Used for related products carousel';
const relatedMarker = '  // RELATED PRODUCTS CAROUSEL';
const functionMarker = '  function initRelatedProducts() {';
const carouselMarker = '  function initCarousel() {';

const databaseMarkerIndex = source.indexOf(databaseMarker);
const databaseBlockStart = source.lastIndexOf('  // ==========================================', databaseMarkerIndex);
const relatedMarkerIndex = source.indexOf(relatedMarker, databaseMarkerIndex);
const relatedBlockStart = source.lastIndexOf('  // ==========================================', relatedMarkerIndex);
const functionStart = source.indexOf(functionMarker, relatedMarkerIndex);
const carouselStart = source.indexOf(carouselMarker, functionStart);

if ([databaseMarkerIndex, databaseBlockStart, relatedMarkerIndex, relatedBlockStart, functionStart, carouselStart].some((value) => value < 0)) {
  throw new Error('Could not locate the legacy related-products database or function.');
}

const runtimePrelude = `  // ==========================================
  // RELATED PRODUCTS RUNTIME - Generated registry + browser module
  // ==========================================
  var relatedProductsModulePromise = null;

  function loadRelatedProductsModule() {
    if (!relatedProductsModulePromise) {
      relatedProductsModulePromise = import('./catalog/related-products.mjs');
    }
    return relatedProductsModulePromise;
  }

  function escapeRelatedHtml(value) {
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function currentPageFileName() {
    var page = window.location.pathname.split('/').filter(Boolean).pop();
    try { return decodeURIComponent(page || 'index.html'); }
    catch (error) { return page || 'index.html'; }
  }

`;

const relatedFunction = `  // ==========================================
  // RELATED PRODUCTS CAROUSEL
  // ==========================================
  async function initRelatedProducts() {
    var el = document.getElementById('related-carousel');
    if (!el) return;

    try {
      var catalog = await loadRelatedProductsModule();
      var products = await catalog.loadProductRegistry(document.baseURI);
      var currentProduct = catalog.findCurrentProduct(products, {
        page: currentPageFileName(),
        name: el.dataset.currentProduct || '',
      });
      var related = catalog.selectRelatedProducts(products, currentProduct);
      if (!currentProduct || related.length === 0) return;

      var styleId = 'related-carousel-style';
      if (!document.getElementById(styleId)) {
        var style = document.createElement('style');
        style.id = styleId;
        style.textContent = '.related-carousel-item{width:45%;flex:0 0 45%}@media(min-width:640px){.related-carousel-item{width:30%;flex:0 0 30%}}@media(min-width:1024px){.related-carousel-item{width:22%;flex:0 0 22%}}' +
                '.related-track{scrollbar-width:none;-ms-overflow-style:none;pointer-events:auto}.related-track::-webkit-scrollbar{display:none}' +
                '.related-arrow{z-index:20;pointer-events:auto}' +
                '.related-track-wrap{position:relative;max-width:100%;pointer-events:none}';
        document.head.appendChild(style);
      }

      var html = '';
      for (var index = 0; index < related.length; index++) {
        var product = related[index];
        var page = escapeRelatedHtml(product.page);
        var image = escapeRelatedHtml(product.image);
        var name = escapeRelatedHtml(product.name);
        html += '<a href="' + page + '" class="inline-block flex-none snap-start group related-carousel-item">';
        html += '<div class="aspect-[4/3] rounded-xl overflow-hidden border border-surface-border/30 mb-2 bg-neutral-200">';
        html += '<img src="' + image + '" alt="' + name + '" class="w-full h-full object-contain group-hover:scale-105 transition-transform duration-500" loading="lazy">';
        html += '</div>';
        html += '<p class="text-sm text-text-secondary group-hover:text-mint transition-colors truncate">' + name + '</p>';
        html += '</a>';
      }

      el.innerHTML =
        '<div class="related-track-wrap">' +
        '<button class="related-arrow related-prev absolute left-0 top-[40%] -translate-y-1/2 w-10 h-10 rounded-full bg-surface/90 backdrop-blur-sm border border-surface-border/30 flex items-center justify-center text-text-secondary hover:text-mint hover:bg-surface transition-all shadow-lg z-20" aria-label="Previous">' +
        '<svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7"/></svg>' +
        '</button>' +
        '<button class="related-arrow related-next absolute right-0 top-[40%] -translate-y-1/2 w-10 h-10 rounded-full bg-surface/90 backdrop-blur-sm border border-surface-border/30 flex items-center justify-center text-text-secondary hover:text-mint hover:bg-surface transition-all shadow-lg z-20" aria-label="Next">' +
        '<svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7"/></svg>' +
        '</button>' +
        '<div class="flex gap-4 overflow-x-auto snap-x snap-mandatory pb-2 related-track" style="-webkit-overflow-scrolling:touch;overflow-y:hidden">' +
        html +
        '</div>' +
        '</div>';

      var track = el.querySelector('.related-track');
      var previous = el.querySelector('.related-prev');
      var next = el.querySelector('.related-next');

      function smoothScrollTo(targetX, duration) {
        if (!track) return;
        duration = duration || 800;
        var start = track.scrollLeft;
        var distance = targetX - start;
        if (Math.abs(distance) < 1) return;
        var startTime = null;
        function ease(progress) { return progress < 0.5 ? 2 * progress * progress : -1 + (4 - 2 * progress) * progress; }
        function step(timestamp) {
          if (!startTime) startTime = timestamp;
          var elapsed = timestamp - startTime;
          var progress = Math.min(elapsed / duration, 1);
          track.scrollLeft = start + distance * ease(progress);
          if (progress < 1) requestAnimationFrame(step);
        }
        requestAnimationFrame(step);
      }

      if (track && previous) {
        previous.addEventListener('click', function(event) {
          event.stopPropagation();
          smoothScrollTo(track.scrollLeft - track.clientWidth * 0.66, 600);
        });
      }
      if (track && next) {
        next.addEventListener('click', function(event) {
          event.stopPropagation();
          smoothScrollTo(track.scrollLeft + track.clientWidth * 0.66, 600);
        });
      }

      var autoTimer = null;
      var autoActive = false;
      function doAutoScroll() {
        if (!track || !autoActive) return;
        var maxScroll = track.scrollWidth - track.clientWidth;
        if (maxScroll <= 1) { autoActive = false; return; }
        var target = track.scrollLeft + track.clientWidth * 0.66;
        if (target >= maxScroll - 5) target = 0;
        smoothScrollTo(target, 900);
        setTimeout(function() { doAutoScroll(); }, 3900);
      }
      function startAutoScroll() {
        if (autoTimer) { clearTimeout(autoTimer); autoTimer = null; }
        autoActive = true;
        autoTimer = setTimeout(function() { doAutoScroll(); }, 1500);
      }
      function stopAutoScroll() {
        autoActive = false;
        if (autoTimer) { clearTimeout(autoTimer); autoTimer = null; }
      }

      setTimeout(startAutoScroll, 600);
      track.addEventListener('mouseenter', stopAutoScroll);
      track.addEventListener('mouseleave', startAutoScroll);
      track.addEventListener('touchstart', stopAutoScroll, { passive: true });
      track.addEventListener('touchend', startAutoScroll);
      if (previous) previous.addEventListener('click', stopAutoScroll);
      if (next) next.addEventListener('click', stopAutoScroll);
    } catch (error) {
      console.warn('Related products could not be loaded:', error);
    }
  }

`;

let repaired = `${source.slice(0, databaseBlockStart)}${runtimePrelude}${relatedFunction}${source.slice(carouselStart)}`;

if (/\bvar\s+PRODUCTS\s*=\s*\[/.test(repaired)) {
  throw new Error('The hard-coded product database remains after migration.');
}
if (!repaired.includes("import('./catalog/related-products.mjs')")) {
  throw new Error('The related products module import was not added.');
}
if (repaired === source) throw new Error('Related products runtime migration produced no changes.');

await writeFile(APP_FILE, repaired, 'utf8');
console.log('Migrated related products from hard-coded app data to the generated runtime registry.');
