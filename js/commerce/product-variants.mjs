export const DEFAULT_PRODUCT_VARIANT_ID = 'statement-45';

export const PRODUCT_VARIANTS = Object.freeze([
  Object.freeze({
    id: 'statement-45',
    label: 'Statement',
    sizeLabel: '45 cm',
    widthCm: 45,
    heightCm: 45,
    longestSideCm: 45,
    sizeCm: 45,
    price: 45,
    skuSuffix: '45cm',
    isDefault: true,
  }),
  Object.freeze({
    id: 'compact-30',
    label: 'Compact',
    sizeLabel: '30 cm',
    widthCm: 30,
    heightCm: 30,
    longestSideCm: 30,
    sizeCm: 30,
    price: 35,
    skuSuffix: '30cm',
    isDefault: false,
  }),
]);

const LEGACY_VARIANT_ALIASES = Object.freeze({
  'statement-50x50': 'statement-45',
  'compact-50x30': 'compact-30',
});

function normalizeVariantId(value = '') {
  const normalized = String(value).trim().toLowerCase();
  return LEGACY_VARIANT_ALIASES[normalized] || normalized;
}

function normalizeMoney(value) {
  const amount = Number(value);
  return Number.isFinite(amount) ? Math.round((amount + Number.EPSILON) * 100) / 100 : NaN;
}

function normalizeVariant(entry = {}) {
  const id = normalizeVariantId(entry.id);
  const canonical = PRODUCT_VARIANTS.find((variant) => variant.id === id);
  const source = canonical || entry;
  const price = normalizeMoney(source.price);
  const widthCm = Number(source.widthCm);
  const heightCm = Number(source.heightCm);
  const longestSideCm = Number(source.longestSideCm || Math.max(widthCm, heightCm));
  const sizeLabel = String(source.sizeLabel || `${longestSideCm} cm`);
  if (!id || !source.label || !Number.isFinite(price) || price < 0
    || !Number.isFinite(widthCm) || widthCm <= 0
    || !Number.isFinite(heightCm) || heightCm <= 0
    || !Number.isFinite(longestSideCm) || longestSideCm <= 0) {
    throw new Error(`Invalid product variant configuration: ${id || '(missing id)'}.`);
  }
  return Object.freeze({
    id,
    label: String(source.label),
    sizeLabel,
    widthCm,
    heightCm,
    longestSideCm,
    sizeCm: longestSideCm,
    price,
    skuSuffix: String(source.skuSuffix || `${longestSideCm}cm`),
    isDefault: Boolean(source.isDefault),
  });
}

export function resolveProductVariant(variantId = DEFAULT_PRODUCT_VARIANT_ID, variants = PRODUCT_VARIANTS) {
  if (!Array.isArray(variants) || variants.length === 0) {
    throw new Error('Product variants are unavailable.');
  }
  const requested = normalizeVariantId(variantId || DEFAULT_PRODUCT_VARIANT_ID);
  const configured = variants.find((entry) => normalizeVariantId(entry?.id) === requested);
  const canonical = PRODUCT_VARIANTS.find((entry) => entry.id === requested);
  if (!configured && !canonical) {
    throw new Error(`Unknown product variant: ${variantId || '(empty)'}.`);
  }
  return normalizeVariant(canonical || configured);
}

export function resolveCatalogProductVariant(product = {}, variantId = "") {
  if (!Array.isArray(product.variants) || product.variants.length === 0) {
    if (Number.isFinite(Number(product.price))) {
      return Object.freeze({
        id: 'legacy', label: 'Standard', sizeLabel: '', widthCm: 1, heightCm: 1,
        longestSideCm: 1, sizeCm: 1, price: Number(product.price),
        skuSuffix: 'standard', isDefault: true,
      });
    }
    throw new Error('Product variants are unavailable.');
  }
  const fallbackId = product.defaultVariantId
    || product.variants.find((entry) => entry?.isDefault)?.id
    || DEFAULT_PRODUCT_VARIANT_ID;
  return resolveProductVariant(variantId || fallbackId, product.variants);
}

export function createCartLineId(page, variantId) {
  const normalizedPage = String(page || "").trim();
  const normalizedVariant = normalizeVariantId(variantId);
  if (!normalizedPage || !normalizedVariant) {
    throw new Error('Cart line identity requires a product page and variant.');
  }
  return `${normalizedPage}::${normalizedVariant}`;
}

export function createProductSku(product = {}, variant = {}) {
  const slug = String(product.slug || "").trim();
  const suffix = String(variant.skuSuffix || "").trim();
  if (!slug || !suffix) throw new Error('Product SKU requires a slug and variant suffix.');
  return `${slug}-${suffix}`;
}
