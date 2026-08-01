import { resolveDiscount } from '../../js/commerce/discounts.mjs';
import { calculateCommerceTotals } from '../../js/commerce/totals.mjs';

const MAX_LINE_ITEMS = 50;
const MAX_QUANTITY_PER_LINE = 10;
const MAX_TOTAL_QUANTITY = 100;
const SUPPORTED_CURRENCY = 'EUR';
const IN_STOCK = 'https://schema.org/InStock';

export class OrderQuoteError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = 'OrderQuoteError';
    this.code = code;
    this.details = details;
  }
}

function fail(code, message, details) {
  throw new OrderQuoteError(code, message, details);
}

function roundMoney(value) {
  return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
}

function toCents(value) {
  return Math.round(roundMoney(value) * 100);
}

function normalizeIdentifier(value = '') {
  return String(value).trim();
}

function normalizeQuantity(value) {
  const quantity = Number(value);
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > MAX_QUANTITY_PER_LINE) {
    fail(
      'INVALID_QUANTITY',
      `Quantity must be an integer between 1 and ${MAX_QUANTITY_PER_LINE}.`,
      { quantity: value },
    );
  }
  return quantity;
}

export function createCatalogIndex(products = []) {
  if (!Array.isArray(products) || products.length === 0) {
    fail('INVALID_CATALOG', 'The product catalog is empty or unavailable.');
  }

  const byPage = new Map();
  const bySlug = new Map();

  for (const product of products) {
    const page = normalizeIdentifier(product.page);
    const slug = normalizeIdentifier(product.slug);
    if (!page || !slug) {
      fail('INVALID_CATALOG', 'Every catalog product must have a page and slug.');
    }
    if (byPage.has(page) || bySlug.has(slug)) {
      fail('INVALID_CATALOG', 'Product pages and slugs must be unique.', { page, slug });
    }
    byPage.set(page, product);
    bySlug.set(slug, product);
  }

  return Object.freeze({ byPage, bySlug });
}

function resolveProduct(line, catalogIndex) {
  const page = normalizeIdentifier(line?.page);
  const slug = normalizeIdentifier(line?.slug);
  const productByPage = page ? catalogIndex.byPage.get(page) : null;
  const productBySlug = slug ? catalogIndex.bySlug.get(slug) : null;

  if (!page && !slug) {
    fail('MISSING_PRODUCT_ID', 'Every order line must contain a product page or slug.');
  }
  if (page && !productByPage) {
    fail('UNKNOWN_PRODUCT', 'The requested product page does not exist.', { page });
  }
  if (slug && !productBySlug) {
    fail('UNKNOWN_PRODUCT', 'The requested product slug does not exist.', { slug });
  }
  if (productByPage && productBySlug && productByPage !== productBySlug) {
    fail('PRODUCT_ID_MISMATCH', 'The product page and slug identify different products.', { page, slug });
  }

  const product = productByPage || productBySlug;
  if (product.currency !== SUPPORTED_CURRENCY) {
    fail('UNSUPPORTED_CURRENCY', 'The product currency is not supported.', {
      page: product.page,
      currency: product.currency,
    });
  }
  if (product.availability !== IN_STOCK) {
    fail('PRODUCT_UNAVAILABLE', 'The requested product is not available.', { page: product.page });
  }

  return product;
}

export function createAuthoritativeOrderQuote(payload = {}, catalogProducts = []) {
  const requestedItems = payload?.items;
  if (!Array.isArray(requestedItems) || requestedItems.length === 0) {
    fail('EMPTY_CART', 'At least one product is required.');
  }
  if (requestedItems.length > MAX_LINE_ITEMS) {
    fail('TOO_MANY_LINE_ITEMS', `No more than ${MAX_LINE_ITEMS} order lines are allowed.`);
  }

  const catalogIndex = createCatalogIndex(catalogProducts);
  const quantitiesByPage = new Map();
  let totalQuantity = 0;

  for (const line of requestedItems) {
    const product = resolveProduct(line, catalogIndex);
    const quantity = normalizeQuantity(line.quantity);
    totalQuantity += quantity;
    if (totalQuantity > MAX_TOTAL_QUANTITY) {
      fail('TOO_MANY_ITEMS', `No more than ${MAX_TOTAL_QUANTITY} products are allowed per order.`);
    }
    quantitiesByPage.set(product.page, (quantitiesByPage.get(product.page) || 0) + quantity);
  }

  const authoritativeItems = [...quantitiesByPage.entries()]
    .map(([page, quantity]) => {
      const product = catalogIndex.byPage.get(page);
      if (quantity > MAX_QUANTITY_PER_LINE) {
        fail(
          'INVALID_QUANTITY',
          `Combined quantity per product may not exceed ${MAX_QUANTITY_PER_LINE}.`,
          { page, quantity },
        );
      }
      const unitPrice = roundMoney(product.price);
      return Object.freeze({
        slug: product.slug,
        page: product.page,
        name: product.name,
        image: product.image,
        unitPrice,
        quantity,
        lineTotal: roundMoney(unitPrice * quantity),
      });
    })
    .sort((left, right) => left.page.localeCompare(right.page));

  const requestedDiscountCode = String(payload?.discountCode || '').trim();
  const discount = resolveDiscount(requestedDiscountCode);
  if (requestedDiscountCode && !discount.valid) {
    fail('INVALID_DISCOUNT_CODE', 'The discount code is invalid.');
  }

  const totals = calculateCommerceTotals({
    items: authoritativeItems.map((item) => ({ price: item.unitPrice, quantity: item.quantity })),
    countryCode: String(payload?.countryCode || 'NL').trim().toUpperCase(),
    discountPercent: discount.percent,
  });

  const subtotal = roundMoney(totals.subtotal);
  const discountAmount = roundMoney(totals.discount);
  const discountedSubtotal = roundMoney(totals.discountedSubtotal);
  const shipping = roundMoney(totals.shipping);
  const grandTotal = roundMoney(totals.grandTotal);

  return Object.freeze({
    currency: SUPPORTED_CURRENCY,
    items: Object.freeze(authoritativeItems),
    discount: Object.freeze({
      code: discount.code,
      percent: discount.percent,
      amount: discountAmount,
    }),
    shipping: Object.freeze({
      countryCode: totals.countryCode,
      zone: totals.zone.name,
      cost: shipping,
      freeFrom: totals.zone.freeFrom,
      qualifiesForFreeShipping: totals.qualifiesForFreeShipping,
    }),
    totals: Object.freeze({
      subtotal,
      discountedSubtotal,
      shipping,
      grandTotal,
    }),
    amountInCents: Object.freeze({
      subtotal: toCents(subtotal),
      discount: toCents(discountAmount),
      discountedSubtotal: toCents(discountedSubtotal),
      shipping: toCents(shipping),
      grandTotal: toCents(grandTotal),
    }),
  });
}
