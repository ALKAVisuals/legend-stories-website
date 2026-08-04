import { createHash } from 'node:crypto';

import { browserProductImageFor } from './lib/product-browser-derivatives.mjs';

const CATEGORY_LINKS = [
  ['music', 'Music Legends'],
  ['sport', 'Sport Legends'],
  ['combat', 'Combat Legends'],
  ['wisdom', 'Wisdom Legends'],
];

function replaceRequired(source, pattern, replacement, label, expectedCount = 1) {
  let count = 0;
  if (pattern.global) {
    pattern.lastIndex = 0;
    count = [...source.matchAll(pattern)].length;
    pattern.lastIndex = 0;
  } else {
    pattern.lastIndex = 0;
    count = pattern.test(source) ? 1 : 0;
    pattern.lastIndex = 0;
  }
  if (count !== expectedCount) {
    throw new Error(`${label}: expected ${expectedCount} match(es), found ${count}.`);
  }
  return source.replace(pattern, replacement);
}

function matchRequired(source, pattern, label, group = 1) {
  const match = source.match(pattern);
  if (!match) throw new Error(`${label}: required markup was not found.`);
  return match[group];
}

export function escapeHtml(value = '') {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function decodeHtmlText(value = '') {
  return String(value)
    .replaceAll('&quot;', '"')
    .replaceAll('&gt;', '>')
    .replaceAll('&lt;', '<')
    .replaceAll('&amp;', '&');
}

export function formatEuro(value) {
  return `€${Number(value).toFixed(2).replace('.', ',')}`;
}

function parseEuro(value) {
  const normalized = String(value).replace(/[^0-9,.-]/g, '').replace(',', '.');
  const parsed = Number(normalized);
  if (!Number.isFinite(parsed)) throw new Error(`Invalid euro value: ${value}`);
  return parsed;
}

function absoluteImageUrl(product, image = product.image) {
  const canonical = String(product.canonical || '');
  const slash = canonical.lastIndexOf('/');
  if (slash < 0) return image;
  return `${canonical.slice(0, slash + 1)}${image}`;
}

function structuredData(product) {
  const variants = Array.isArray(product.variants) && product.variants.length
    ? product.variants
    : [{ id: 'legacy', label: 'Standard', sizeLabel: '', widthCm: 1, heightCm: 1, longestSideCm: 1, price: product.price, skuSuffix: 'standard', isDefault: true }];
  const orderedVariants = [...variants].sort((left, right) => Number(Boolean(right.isDefault)) - Number(Boolean(left.isDefault)));
  return JSON.stringify({
    '@context': 'https://schema.org/',
    '@type': 'Product',
    name: product.name,
    image: absoluteImageUrl(product),
    description: product.description,
    brand: { '@type': 'Brand', name: 'Legend Stories' },
    offers: orderedVariants.map((variant) => ({
      '@type': 'Offer',
      name: variant.id === 'legacy' ? product.name : `${product.name} — ${variant.label} (${variant.sizeLabel})`,
      sku: `${product.slug}-${variant.skuSuffix || variant.id || 'standard'}`,
      price: Number(variant.price).toFixed(2),
      priceCurrency: product.currency || 'EUR',
      availability: product.availability,
      url: variant.id === 'legacy' ? product.canonical : `${product.canonical}?variant=${encodeURIComponent(variant.id)}`,
    })),
  }, null, 2).replaceAll('<', '\\u003c');
}

export function extractProductPresentation(html, product) {
  const story = matchRequired(
    html,
    /<!-- FACT -->[\s\S]*?<p class=\"text-text-secondary text-base md:text-lg leading-relaxed italic\">([\s\S]*?)<\/p>/,
    `${product.page} story`,
  ).trim();
  const imageAlt = matchRequired(
    html,
    /<!-- IMAGE -->[\s\S]*?<img\s+src=\"[^\"]*\"\s+alt=\"([^\"]*)\"\s+class=\"w-full h-full object-contain\"[^>]*>/,
    `${product.page} image alt`,
  );
  const announcementHtml = matchRequired(
    html,
    /<div class=\"w-full bg-gradient-mint[^>]*\" role=\"banner\">\s*<p>([\s\S]*?)<\/p>\s*<\/div>/,
    `${product.page} announcement`,
  ).trim();
  const pageTitle = decodeHtmlText(matchRequired(
    html,
    /<title>([\s\S]*?)<\/title>/,
    `${product.page} page title`,
  ).trim());
  const defaultPageTitle = `${product.name} — ${product.collection} | Legend Stories`;
  const presentation = { page: product.page, story, imageAlt, announcementHtml };
  if (pageTitle !== defaultPageTitle) presentation.pageTitle = pageTitle;
  return presentation;
}

export function templatizeProductPage(input) {
  let html = input;

  html = replaceRequired(html, /<meta name="description" content="[^"]*">/, '<meta name="description" content="{{META_DESCRIPTION}}">', 'meta description');
  html = replaceRequired(html, /<title>[\s\S]*?<\/title>/, '<title>{{PAGE_TITLE}}</title>', 'document title');
  html = replaceRequired(html, /<meta property="og:title" content="[^"]*">/, '<meta property="og:title" content="{{PAGE_TITLE}}">', 'Open Graph title');
  html = replaceRequired(html, /<meta property="og:description" content="[^"]*">/, '<meta property="og:description" content="{{META_DESCRIPTION}}">', 'Open Graph description');
  html = replaceRequired(html, /<meta property="og:image" content="[^"]*">/, '<meta property="og:image" content="{{ABSOLUTE_IMAGE}}">', 'Open Graph image');
  html = replaceRequired(html, /<meta property="og:url" content="[^"]*">/, '<meta property="og:url" content="{{CANONICAL}}">', 'Open Graph URL');
  html = replaceRequired(html, /<meta name="twitter:title" content="[^"]*">/, '<meta name="twitter:title" content="{{PAGE_TITLE}}">', 'Twitter title');
  html = replaceRequired(html, /<meta name="twitter:description" content="[^"]*">/, '<meta name="twitter:description" content="{{META_DESCRIPTION}}">', 'Twitter description');
  html = replaceRequired(html, /<meta name="twitter:image" content="[^"]*">/, '<meta name="twitter:image" content="{{ABSOLUTE_IMAGE}}">', 'Twitter image');
  html = replaceRequired(html, /<link rel="canonical" href="[^"]*">/, '<link rel="canonical" href="{{CANONICAL}}">', 'canonical link');
  html = replaceRequired(html, /<script type="application\/ld\+json">[\s\S]*?<\/script>/, '{{STRUCTURED_DATA_SCRIPT}}', 'Product structured data');

  html = replaceRequired(
    html,
    /(<div class="w-full bg-gradient-mint[^>]*" role="banner">)\s*<p>[\s\S]*?<\/p>\s*(<\/div>)/,
    '$1\n    <p>{{ANNOUNCEMENT_HTML}}</p>\n  $2',
    'announcement bar',
  );

  for (const [category, label] of CATEGORY_LINKS) {
    const desktop = new RegExp(`<a href="${category}-legends\\.html" class="[^"]*">${label}<\/a>`);
    const mobile = new RegExp(`<a href="${category}-legends\\.html" class="[^"]* py-2">${label}<\/a>`);
    html = replaceRequired(html, desktop, `<a href="${category}-legends.html" class="{{NAV_${category.toUpperCase()}_DESKTOP_CLASS}}">${label}</a>`, `${label} desktop navigation`);
    html = replaceRequired(html, mobile, `<a href="${category}-legends.html" class="{{NAV_${category.toUpperCase()}_MOBILE_CLASS}}">${label}</a>`, `${label} mobile navigation`);
  }

  html = replaceRequired(
    html,
    /<nav class="text-sm text-text-muted" aria-label="Breadcrumb">[\s\S]*?<\/nav>/,
    '{{BREADCRUMB}}',
    'breadcrumb',
  );
  html = replaceRequired(
    html,
    /(<!-- IMAGE -->[\s\S]*?<img\s+)src="[^"]*"\s+alt="[^"]*"(\s+class="w-full h-full object-contain"[^>]*>)/,
    '$1src="{{IMAGE}}" alt="{{IMAGE_ALT}}"$2',
    'primary product image',
  );
  html = replaceRequired(
    html,
    /<p class="text-mint text-xs font-medium uppercase tracking-widest mb-2">[^<]*<\/p>/,
    '<p class="text-mint text-xs font-medium uppercase tracking-widest mb-2">{{COLLECTION}}</p>',
    'collection label',
  );
  html = replaceRequired(
    html,
    /<h1 class="font-display text-3xl md:text-4xl lg:text-5xl font-bold mb-4">[^<]*<\/h1>/,
    '<h1 class="font-display text-3xl md:text-4xl lg:text-5xl font-bold mb-4">{{NAME}}</h1>',
    'product heading',
  );
  html = replaceRequired(
    html,
    /(<!-- FACT -->[\s\S]*?<p class="text-text-secondary text-base md:text-lg leading-relaxed italic">)[\s\S]*?(<\/p>)/,
    '$1{{STORY}}$2',
    'product story',
  );
  html = replaceRequired(
    html,
    /<button class="([^"]*\badd-to-cart-btn\b[^"]*)" data-name="[^"]*" data-price="45" data-variant-id="statement-50x50" data-size-label="50 × 50 cm" data-width-cm="50" data-height-cm="50" data-longest-side-cm="50" data-variant-label="Statement" data-img="[^"]*">[\s\S]*?<\/button>/,
    '<button class="$1" data-name="{{NAME}}" data-price="45" data-variant-id="statement-50x50" data-size-label="50 × 50 cm" data-width-cm="50" data-height-cm="50" data-longest-side-cm="50" data-variant-label="Statement" data-img="{{IMAGE}}">\n              Add to cart — €45\n            </button>',
    'add-to-cart button',
  );
  html = replaceRequired(
    html,
    /<div id="related-carousel" data-current-product="[^"]*"><\/div>/,
    '<div id="related-carousel" data-current-product="{{NAME}}"></div>',
    'related-products identity',
  );

  return html;
}

function navClass(category, activeCategory, mobile) {
  if (category === activeCategory) {
    return mobile
      ? 'text-sm text-mint font-medium py-2'
      : 'text-sm text-mint font-medium';
  }
  return mobile
    ? 'text-sm text-text-secondary hover:text-mint transition-colors font-medium py-2'
    : 'text-sm text-text-secondary hover:text-mint transition-colors font-medium';
}

function breadcrumb(product) {
  return `<nav class="text-sm text-text-muted" aria-label="Breadcrumb">
        <a href="index.html" class="hover:text-mint transition-colors">Home</a>
        <span class="mx-2">/</span>
        <a href="${escapeHtml(product.category)}-legends.html" class="hover:text-mint transition-colors">${escapeHtml(product.collection)}</a>
        <span class="mx-2">/</span>
        <span class="text-text-secondary">${escapeHtml(product.name)}</span>
      </nav>`;
}

export function renderProductPage(template, product, presentation) {
  const title = presentation.pageTitle || `${product.name} — ${product.collection} | Legend Stories`;
  const browserImage = browserProductImageFor(product.image);
  const values = {
    META_DESCRIPTION: escapeHtml(product.description),
    PAGE_TITLE: escapeHtml(title),
    ABSOLUTE_IMAGE: escapeHtml(absoluteImageUrl(product)),
    CANONICAL: escapeHtml(product.canonical),
    STRUCTURED_DATA_SCRIPT: `<script type="application/ld+json">\n${structuredData(product)}\n  </script>`,
    ANNOUNCEMENT_HTML: presentation.announcementHtml,
    BREADCRUMB: breadcrumb(product),
    IMAGE: escapeHtml(browserImage),
    IMAGE_ALT: escapeHtml(presentation.imageAlt),
    COLLECTION: escapeHtml(product.collection),
    NAME: escapeHtml(product.name),
    STORY: escapeHtml(presentation.story),
  };

  for (const [category] of CATEGORY_LINKS) {
    values[`NAV_${category.toUpperCase()}_DESKTOP_CLASS`] = navClass(category, product.category, false);
    values[`NAV_${category.toUpperCase()}_MOBILE_CLASS`] = navClass(category, product.category, true);
  }

  return template.replace(/{{([A-Z0-9_]+)}}/g, (_, key) => {
    if (!(key in values)) throw new Error(`${product.page}: missing template value ${key}.`);
    return values[key];
  });
}

export function templateHash(template) {
  return createHash('sha256').update(template).digest('hex');
}
