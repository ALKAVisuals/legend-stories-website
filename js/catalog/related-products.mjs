const registryCache = new Map();

function pageFromLocation(locationLike = globalThis.location) {
  const pathname = String(locationLike?.pathname || '');
  const page = pathname.split('/').filter(Boolean).pop();
  return page || 'index.html';
}

export function findCurrentProduct(products = [], { page, name } = {}) {
  const currentPage = page || pageFromLocation();
  return products.find((product) => product.page === currentPage)
    || products.find((product) => product.name === name)
    || null;
}

export function selectRelatedProducts(products = [], currentProduct, limit = Number.POSITIVE_INFINITY) {
  if (!currentProduct) return [];
  const safeLimit = Number.isFinite(limit) ? Math.max(0, Math.floor(limit)) : products.length;

  return products
    .filter((product) => (
      product.page !== currentProduct.page
      && product.collection === currentProduct.collection
    ))
    .slice(0, safeLimit);
}

export function registryUrl(baseUri = globalThis.document?.baseURI) {
  if (!baseUri) throw new Error('A document base URI is required to resolve the product registry.');
  return new URL('data/product-registry.json', baseUri).href;
}

export async function loadProductRegistry(baseUri, fetchImpl = globalThis.fetch) {
  if (typeof fetchImpl !== 'function') throw new Error('A fetch implementation is required.');
  const url = registryUrl(baseUri);
  if (!registryCache.has(url)) {
    registryCache.set(url, fetchImpl(url, { credentials: 'same-origin' }).then(async (response) => {
      if (!response.ok) throw new Error(`Product registry request failed with status ${response.status}.`);
      const registry = await response.json();
      if (registry.schemaVersion !== 1 || !Array.isArray(registry.products)) {
        throw new Error('Product registry has an unsupported schema.');
      }
      return registry.products;
    }).catch((error) => {
      registryCache.delete(url);
      throw error;
    }));
  }
  return registryCache.get(url);
}

export function clearProductRegistryCache() {
  registryCache.clear();
}
