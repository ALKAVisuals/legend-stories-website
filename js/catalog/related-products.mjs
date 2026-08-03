const registryCache = new Map();
const RELATED_SESSION_SEED_KEY = 'legendRelatedSeedV1';
const DEFAULT_RELATED_LIMIT = 4;

function pageFromLocation(locationLike = globalThis.location) {
  const pathname = String(locationLike?.pathname || '');
  const page = pathname.split('/').filter(Boolean).pop();
  return page || 'index.html';
}

function hashString(value) {
  let hash = 2166136261;
  for (const character of String(value)) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export function createSeededRandom(seed) {
  let state = hashString(seed) || 0x6d2b79f5;
  return function seededRandom() {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function randomSeed(cryptoRef = globalThis.crypto) {
  if (cryptoRef?.getRandomValues) {
    const values = new Uint32Array(2);
    cryptoRef.getRandomValues(values);
    return `${values[0].toString(36)}${values[1].toString(36)}`;
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

export function getRelatedSessionSeed(
  storage = globalThis.sessionStorage,
  cryptoRef = globalThis.crypto,
) {
  try {
    const saved = storage?.getItem?.(RELATED_SESSION_SEED_KEY);
    if (saved) return saved;
    const seed = randomSeed(cryptoRef);
    storage?.setItem?.(RELATED_SESSION_SEED_KEY, seed);
    return seed;
  } catch {
    return randomSeed(cryptoRef);
  }
}

function shuffle(items, random) {
  const shuffled = [...items];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
  }
  return shuffled;
}

function normalizeSelectionOptions(limitOrOptions) {
  if (typeof limitOrOptions === 'number') return { limit: limitOrOptions };
  return limitOrOptions && typeof limitOrOptions === 'object' ? limitOrOptions : {};
}

function uniqueAvailableProducts(products, currentProduct) {
  const seenPages = new Set([currentProduct.page]);
  const available = [];

  for (const product of products) {
    if (!product?.page || seenPages.has(product.page)) continue;
    seenPages.add(product.page);
    available.push(product);
  }
  return available;
}

export function findCurrentProduct(products = [], { page, name } = {}) {
  const currentPage = page || pageFromLocation();
  return products.find((product) => product.page === currentPage)
    || products.find((product) => product.name === name)
    || null;
}

export function selectRelatedProducts(products = [], currentProduct, limitOrOptions = {}) {
  if (!currentProduct) return [];

  const options = normalizeSelectionOptions(limitOrOptions);
  const requestedLimit = options.limit ?? DEFAULT_RELATED_LIMIT;
  const safeLimit = Number.isFinite(requestedLimit)
    ? Math.max(0, Math.floor(requestedLimit))
    : DEFAULT_RELATED_LIMIT;
  if (safeLimit === 0) return [];

  const sessionSeed = options.sessionSeed ?? getRelatedSessionSeed(
    options.storage,
    options.cryptoRef,
  );
  const seed = options.seed ?? `${sessionSeed}:${currentProduct.page || currentProduct.name || ''}`;
  const random = typeof options.random === 'function'
    ? options.random
    : createSeededRandom(seed);

  const available = uniqueAvailableProducts(products, currentProduct);
  const sameCollection = available.filter(
    (product) => product.collection === currentProduct.collection,
  );
  const otherCollections = available.filter(
    (product) => product.collection !== currentProduct.collection,
  );

  return [
    ...shuffle(sameCollection, random),
    ...shuffle(otherCollections, random),
  ].slice(0, safeLimit);
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
