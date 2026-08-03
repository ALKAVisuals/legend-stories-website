import { readFile, writeFile } from 'node:fs/promises';

const appPath = new URL('../js/app.js', import.meta.url);
const source = await readFile(appPath, 'utf8');

const startMarker = `  // ==========================================
  // RELATED PRODUCTS CAROUSEL
  // ==========================================`;
const endMarker = `
  function initCarousel() {`;
const start = source.indexOf(startMarker);
const end = source.indexOf(endMarker, start);

if (start === -1 || end === -1) {
  throw new Error('Could not locate the existing related-products carousel block.');
}

const replacement = `  // ==========================================
  // RELATED PRODUCT DISCOVERY
  // ==========================================
  function ensureRelatedProductsStyles() {
    if (document.querySelector('link[data-related-products-styles]')) return;
    var link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = new URL('css/related-products.css', document.baseURI).href;
    link.dataset.relatedProductsStyles = 'true';
    document.head.appendChild(link);
  }

  function enhanceRelatedProductsSection(el) {
    var section = el.closest('section');
    if (!section) return;
    section.classList.add('related-discovery-section');

    var heading = section.querySelector('h2');
    if (heading) {
      heading.className = 'related-discovery-heading';
      heading.textContent = 'Discover more legends';
    }

    if (!section.querySelector('.related-discovery-intro')) {
      var intro = document.createElement('p');
      intro.className = 'related-discovery-intro';
      intro.textContent = 'A fresh selection of wall art, chosen for this visit.';
      heading?.insertAdjacentElement('afterend', intro);
    }
  }

  async function initRelatedProducts() {
    var el = document.getElementById('related-carousel');
    if (!el) return;

    try {
      ensureRelatedProductsStyles();
      var catalog = await loadRelatedProductsModule();
      var products = await catalog.loadProductRegistry(document.baseURI);
      var currentProduct = catalog.findCurrentProduct(products, {
        page: currentPageFileName(),
        name: el.dataset.currentProduct || '',
      });
      var related = catalog.selectRelatedProducts(products, currentProduct, { limit: 4 });
      if (!currentProduct || related.length === 0) return;

      enhanceRelatedProductsSection(el);

      var html = '<div class="related-discovery-track" role="list" aria-label="Other LegendMural wall stickers">';
      for (var index = 0; index < related.length; index += 1) {
        var product = related[index];
        var page = escapeRelatedHtml(product.page);
        var image = escapeRelatedHtml(product.image);
        var name = escapeRelatedHtml(product.name);
        var collection = escapeRelatedHtml(product.collection || 'LegendMural');

        html += '<a href="' + page + '" class="related-discovery-card" role="listitem" aria-label="View ' + name + '">';
        html += '<span class="related-discovery-image">';
        html += '<img src="' + image + '" alt="' + name + ' wall sticker" loading="lazy" decoding="async" fetchpriority="low">';
        html += '</span>';
        html += '<span class="related-discovery-copy">';
        html += '<span class="related-discovery-collection">' + collection + '</span>';
        html += '<span class="related-discovery-name">' + name + '</span>';
        html += '<span class="related-discovery-meta">';
        html += '<span class="related-discovery-price">From €35</span>';
        html += '<span class="related-discovery-arrow" aria-hidden="true"></span>';
        html += '</span>';
        html += '</span>';
        html += '</a>';
      }
      html += '</div>';
      el.innerHTML = html;
    } catch (error) {
      console.warn('Related products could not be loaded:', error);
    }
  }
`;

const nextSource = `${source.slice(0, start)}${replacement}${source.slice(end)}`;
if (nextSource === source) throw new Error('Related-products migration produced no changes.');
if (!nextSource.includes("Discover more legends")) throw new Error('New related-products heading is missing.');
if (!nextSource.includes("catalog.selectRelatedProducts(products, currentProduct, { limit: 4 })")) {
  throw new Error('Four-product randomized selection contract is missing.');
}
if (nextSource.includes('scheduleAutoScroll(3900)')) {
  throw new Error('Legacy automatic related-products scrolling is still present.');
}

await writeFile(appPath, nextSource, 'utf8');
console.log('Replaced the legacy related-products carousel with randomized premium discovery cards.');
