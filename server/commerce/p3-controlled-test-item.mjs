const TEST_TOKEN_HEADER = 'x-legendmural-p3-test-token';
const MIN_TOKEN_LENGTH = 32;
const MAX_TOKEN_LENGTH = 512;

export const P3_CONTROLLED_TEST_PRODUCT = Object.freeze({
  productId: 'LM-2099-99999',
  slug: '__p3-controlled-payment-test__',
  page: '__p3-controlled-payment-test__.html',
  name: 'LegendMural controlled P3 payment test',
  description: 'Internal one-cent Production payment proof only.',
  image: '',
  price: 0.01,
  defaultVariantId: 'p3-test',
  variants: Object.freeze([
    Object.freeze({
      id: 'p3-test',
      label: 'P3 Test',
      sizeLabel: '1 cm',
      widthCm: 1,
      heightCm: 1,
      longestSideCm: 1,
      sizeCm: 1,
      price: 0.01,
      skuSuffix: 'p3-test',
      isDefault: true,
    }),
  ]),
  currency: 'EUR',
  availability: 'https://schema.org/InStock',
  shippingExempt: true,
});

export const P3_CONTROLLED_TEST_CATALOG = Object.freeze([
  P3_CONTROLLED_TEST_PRODUCT,
]);

function enabled(value) {
  return String(value || '').trim().toLowerCase() === 'true';
}

function validToken(value) {
  const token = String(value || '');
  return token.length >= MIN_TOKEN_LENGTH
    && token.length <= MAX_TOKEN_LENGTH
    && !/[\u0000-\u001f\u007f]/.test(token);
}

function timingSafeStringEqual(left, right) {
  const a = String(left || '');
  const b = String(right || '');
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let index = 0; index < a.length; index += 1) {
    diff |= a.charCodeAt(index) ^ b.charCodeAt(index);
  }
  return diff === 0;
}

export function isP3ControlledCheckoutEnabled(env = process.env) {
  return enabled(env.P3_TEST_CHECKOUT_ENABLED);
}

export function isAuthorizedP3ControlledCheckout(request, env = process.env) {
  if (!isP3ControlledCheckoutEnabled(env)) return false;
  const expected = String(env.P3_TEST_CHECKOUT_TOKEN || '');
  const provided = String(request?.headers?.get?.(TEST_TOKEN_HEADER) || '');
  if (!validToken(expected) || !validToken(provided)) return false;
  return timingSafeStringEqual(provided, expected);
}

export function isExactP3ControlledOrderRequest(orderRequest = {}) {
  const items = orderRequest?.items;
  if (!Array.isArray(items) || items.length !== 1) return false;
  const line = items[0] || {};
  const page = String(line.page || '').trim();
  const slug = String(line.slug || '').trim();
  const quantity = Number(line.quantity);
  const variantId = String(line.variantId || '').trim();
  const discountCode = String(orderRequest.discountCode || '').trim();
  const countryCode = String(orderRequest.countryCode || 'NL').trim().toUpperCase();

  const identifiesTestItem = page === P3_CONTROLLED_TEST_PRODUCT.page
    || slug === P3_CONTROLLED_TEST_PRODUCT.slug;

  return identifiesTestItem
    && quantity === 1
    && !variantId
    && !discountCode
    && countryCode === 'NL';
}
