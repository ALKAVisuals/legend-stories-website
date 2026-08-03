const registryCache = new Map();
const RELATED_SESSION_SEED_KEY = 'legendRelatedSeedV1';
const DEFAULT_RELATED_LIMIT = 4;
const COLLECTION_PAGE_FILES = Object.freeze([
  'music-legends.html',
  'sport-legends.html',
  'combat-legends.html',
  'wisdom-legends.html',
]);

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

export function collectionPageUrls(baseUri = globalThis.document?.baseURI) {
  if (!baseUri) throw new Error('A document base URI is required to resolve collection pages.');
  return COLLECTION_PAGE_FILES.map((page) => new URL(page, baseUri).href);
}

function extractAttribute(source = '', name) {
  const escapedName = String(name).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = String(source).match(new RegExp(`\\b${escapedName}\\s*=\\s*(["'])(.*?)\\1`, 'i'));
  return match?.[2] || '';
}

function decodeHtmlEntities(value = '') {
  return String(value)
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#0*39;|&apos;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&nbsp;/gi, ' ');
}

function textFromHtml(value = '') {
  return decodeHtmlEntities(String(value).replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim());
}

function collectionFromPage(page = '') {
  if (String(page).startsWith('music-')) return 'Music Legends';
  if (String(page).startsWith('sport-')) return 'Sport Legends';
  if (String(page).startsWith('combat-')) return 'Combat Legends';
  if (String(page).startsWith('wisdom-')) return 'Wisdom Legends';
  return 'LegendMural';
}

function categoryFromCollection(collection = '') {
  return String(collection).replace(/\s+Legends$/i, '').trim().toLowerCase().replace(/\s+/g, '-');
}

export function parseCollectionProducts(html = '', fallbackCollection = '') {
  const products = [];
  const articlePattern = /<article\b([^>]*)>([\s\S]*?)<\/article>/gi;
  let match;

  while ((match = articlePattern.exec(String(html)))) {
    const attributes = match[1] || '';
    const body = match[2] || '';
    const className = extractAttribute(attributes, 'class');
    if (!/(?:^|\s)product-card(?:\s|$)/.test(className)) continue;

    const page = decodeHtmlEntities(
      extractAttribute(attributes, 'data-product-href') || extractAttribute(attributes, 'data-page'),
    );
    if (!page || !/\.html(?:$|[?#])/i.test(page)) continue;

    const heading = body.match(/<h3\b[^>]*>([\s\S]*?)<\/h3>/i)?.[1] || '';
    const imageTag = body.match(/<img\b[^>]*>/i)?.[0] || '';
    const collectionTag = (body.match(/<p\b[^>]*>[\s\S]*?<\/p>/gi) || []).find((tag) => {
      const openingTag = tag.match(/^<p\b[^>]*>/i)?.[0] || '';
      return /(?:^|\s)text-mint(?:\s|$)/.test(extractAttribute(openingTag, 'class'));
    }) || '';
    const collection = textFromHtml(collectionTag) || fallbackCollection || collectionFromPage(page);
    const category = decodeHtmlEntities(extractAttribute(attributes, 'data-category'))
      || categoryFromCollection(collection);
    const name = textFromHtml(heading);
    const image = decodeHtmlEntities(extractAttribute(imageTag, 'src'));

    if (!name || !image) continue;
    products.push({
      slug: page.replace(/\.html(?:$|[?#].*)/i, ''),
      page,
      name,
      image,
      category,
      collection,
      batchId: null,
    });
  }

  return products;
}

async function loadGeneratedRegistry(url, fetchImpl) {
  const response = await fetchImpl(url, { credentials: 'same-origin' });
  if (!response.ok) {
    const error = new Error(`Product registry request failed with status ${response.status}.`);
    error.code = 'REGISTRY_UNAVAILABLE';
    throw error;
  }
  const registry = await response.json();
  if (registry.schemaVersion !== 1 || !Array.isArray(registry.products)) {
    const error = new Error('Product registry has an unsupported schema.');
    error.code = 'UNSUPPORTED_SCHEMA';
    throw error;
  }
  return registry.products;
}

async function loadCollectionPageRegistry(baseUri, fetchImpl) {
  const urls = collectionPageUrls(baseUri);
  const results = await Promise.allSettled(urls.map(async (url) => {
    const response = await fetchImpl(url, { credentials: 'same-origin' });
    if (!response.ok) throw new Error(`Collection page request failed with status ${response.status}.`);
    const pageFile = new URL(url).pathname.split('/').filter(Boolean).pop() || '';
    return parseCollectionProducts(await response.text(), collectionFromPage(pageFile));
  }));

  const products = results.flatMap((result) => result.status === 'fulfilled' ? result.value : []);
  const unique = [];
  const seenPages = new Set();
  for (const product of products) {
    if (!product.page || seenPages.has(product.page)) continue;
    seenPages.add(product.page);
    unique.push(product);
  }

  if (unique.length === 0) {
    throw new Error('No products could be recovered from the collection pages.');
  }
  return unique;
}

export async function loadProductRegistry(baseUri, fetchImpl = globalThis.fetch) {
  if (typeof fetchImpl !== 'function') throw new Error('A fetch implementation is required.');
  const url = registryUrl(baseUri);
  if (!registryCache.has(url)) {
    registryCache.set(url, (async () => {
      try {
        return await loadGeneratedRegistry(url, fetchImpl);
      } catch (error) {
        if (error?.code === 'UNSUPPORTED_SCHEMA') throw error;
        try {
          return await loadCollectionPageRegistry(baseUri, fetchImpl);
        } catch (fallbackError) {
          const combined = new Error(
            `Product recommendations could not load the runtime registry or collection pages: ${fallbackError.message}`,
          );
          combined.cause = error;
          throw combined;
        }
      }
    })().catch((error) => {
      registryCache.delete(url);
      throw error;
    }));
  }
  return registryCache.get(url);
}

export function clearProductRegistryCache() {
  registryCache.clear();
}
