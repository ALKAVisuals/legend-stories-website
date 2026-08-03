export const DEFAULT_PRODUCT_VARIANT_ID = 'statement-45';

export const PRODUCT_VARIANTS = Object.freeze([
  Object.freeze({
    id: 'statement-45',
    label: 'Statement',
    sizeCm: 45,
    price: 45,
    skuSuffix: '45',
    isDefault: true,
  }),
  Object.freeze({
    id: 'compact-30',
    label: 'Compact',
    sizeCm: 30,
    price: 35,
    skuSuffix: '30',
    isDefault: false,
  }),
]);

function normalizeVariantId(value = '') {
  return String(value).trim().toLowerCase();
}

function normalizeMoney(value) {
  const amount = Number(value);
  return Number.isFinite(amount) ? Math.round((amount + Number.EPSILON) * 100) / 100 : NaN;
}

export function resolveProductVariant(variantId = DEFAULT_PRODUCT_VARIANT_ID, variants = PRODUCT_VARIANTS) {
  if (!Array.isArray(variants) || variants.length === 0) {
    throw new Error('Product variants are unavailable.');
  }

  const requested = normalizeVariantId(variantId || DEFAULT_PRODUCT_VARIANT_ID);
  const variant = variants.find((entry) => normalizeVariantId(entry?.id) === requested);
  if (!variant) {
    throw new Error(`Unknown product variant: ${variantId || '(empty)'}.`);
  }

  const price = normalizeMoney(variant.price);
  const sizeCm = Number(variant.sizeCm);
  if (!variant.id || !variant.label || !Number.isFinite(price) || price < 0 || !Number.isFinite(sizeCm) || sizeCm <= 0) {
    throw new Error(`Invalid product variant configuration: ${variant.id || '(missing id)'}.`);
  }

  return Object.freeze({
    id: String(variant.id),
    label: String(variant.label),
    sizeCm,
    price,
    skuSuffix: String(variant.skuSuffix || sizeCm),
    isDefault: Boolean(variant.isDefault),
  });
}

export function resolveCatalogProductVariant(product = {}, variantId = '') {
  const configuredVariants = Array.isArray(product.variants) && product.variants.length
    ? product.variants
    : [{
        id: 'legacy',
        label: 'Standard',
        sizeCm: Number(product.sizeCm) || 1,
        price: product.price,
        skuSuffix: 'standard',
        isDefault: true,
      }];

  const fallbackId = product.defaultVariantId
    || configuredVariants.find((entry) => entry?.isDefault)?.id
    || configuredVariants[0]?.id;
  return resolveProductVariant(variantId || fallbackId, configuredVariants);
}

export function createCartLineId(page, variantId) {
  const normalizedPage = String(page || '').trim();
  const normalizedVariant = normalizeVariantId(variantId);
  if (!normalizedPage || !normalizedVariant) {
    throw new Error('Cart line identity requires a product page and variant.');
  }
  return `${normalizedPage}::${normalizedVariant}`;
}

export function createProductSku(product = {}, variant = {}) {
  const slug = String(product.slug || '').trim();
  const suffix = String(variant.skuSuffix || variant.sizeCm || '').trim();
  if (!slug || !suffix) throw new Error('Product SKU requires a slug and variant suffix.');
  return `${slug}-${suffix}`;
}
