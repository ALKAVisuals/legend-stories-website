const NON_PRODUCT_PAGES = new Set([
  '',
  'index.html',
  'shop.html',
  'about.html',
  'music-legends.html',
  'sport-legends.html',
  'combat-legends.html',
  'wisdom-legends.html',
]);

export function pageFileFromPath(pathname = '') {
  const clean = String(pathname).split('#')[0].split('?')[0].replace(/\\/g, '/');
  const page = clean.slice(clean.lastIndexOf('/') + 1);
  return page.endsWith('.html') ? page : '';
}

export function resolveProductPage({
  explicitPage = '',
  containerPage = '',
  currentPath = '',
  name = '',
  pageByName = {},
} = {}) {
  const candidates = [explicitPage, containerPage]
    .map(pageFileFromPath)
    .filter(Boolean);
  if (candidates.length) return candidates[0];

  const currentPage = pageFileFromPath(currentPath);
  if (currentPage && !NON_PRODUCT_PAGES.has(currentPage)) return currentPage;

  const mappedPage = pageFileFromPath(pageByName[String(name).trim()] || '');
  return mappedPage;
}

export function createOrderRequest({
  items = [],
  countryCode = 'NL',
  discountCode = '',
} = {}) {
  if (!Array.isArray(items) || items.length === 0) {
    throw new Error('Cannot create an order request from an empty cart.');
  }

  return Object.freeze({
    items: Object.freeze(items.map((item) => {
      const page = pageFileFromPath(item.page || item.id || '');
      const quantity = Number(item.quantity);
      const variantId = String(item.variantId || '').trim().toLowerCase();
      if (!page) {
        throw new Error(`Cart item "${item.name || 'Unknown product'}" has no stable product page.`);
      }
      if (!Number.isInteger(quantity) || quantity < 1) {
        throw new Error(`${page} has an invalid quantity.`);
      }
      return Object.freeze(variantId ? { page, variantId, quantity } : { page, quantity });
    })),
    countryCode: String(countryCode || 'NL').trim().toUpperCase(),
    discountCode: String(discountCode || '').trim().toUpperCase(),
  });
}
