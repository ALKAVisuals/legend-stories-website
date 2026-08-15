import { createAuthoritativeOrderQuote } from '../commerce/order-quote.mjs';
import { normalizeCheckoutCustomer } from '../payments/checkout-core.mjs';
import { createPendingOrderRecord } from './order-status.mjs';
import {
  OrderStoreContractError,
  requireCheckoutStore as requireCheckoutStoreCapability,
} from './store-contract.mjs';

const REFERENCE_PATTERN = /^[a-f0-9]{64}$/;
const PAYPAL_ORDER_ID_PATTERN = /^[A-Z0-9]{1,36}$/;

export class CheckoutPersistenceError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = 'CheckoutPersistenceError';
    this.code = code;
    this.details = details;
  }
}

function fail(code, message, details) {
  throw new CheckoutPersistenceError(code, message, details);
}

function requireCheckoutStore(checkoutStore) {
  try {
    return requireCheckoutStoreCapability(checkoutStore);
  } catch (error) {
    if (error instanceof OrderStoreContractError) {
      fail(
        'CHECKOUT_STORE_NOT_CONFIGURED',
        'Durable pending-order storage is not configured.',
        error.details,
      );
    }
    throw error;
  }
}

function normalizeDeliveryCountry(value) {
  const country = String(value || '').trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(country)) {
    fail('INVALID_CHECKOUT_RECORD', 'The delivery country is invalid.');
  }
  return country;
}

function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [key, canonicalize(value[key])]),
    );
  }
  return value;
}

function sameImmutableValue(left, right) {
  return JSON.stringify(canonicalize(left)) === JSON.stringify(canonicalize(right));
}

function isTrustedPayPalCheckoutUrl(url, mode) {
  const host = url.hostname.toLowerCase();
  const sandboxHost = host === 'sandbox.paypal.com' || host.endsWith('.sandbox.paypal.com');
  const liveHost = host === 'paypal.com' || host.endsWith('.paypal.com');
  return mode === 'test' ? sandboxHost : (liveHost && !sandboxHost);
}

function validateCheckoutResult(checkout) {
  if (!REFERENCE_PATTERN.test(String(checkout?.reference || ''))) {
    fail('INVALID_CHECKOUT_RECORD', 'The Checkout reference is invalid.');
  }
  if (!['test', 'live'].includes(checkout?.mode)) {
    fail('INVALID_CHECKOUT_RECORD', 'The Checkout mode is invalid.');
  }

  const provider = String(checkout?.provider || '').trim().toLowerCase();
  if (provider !== 'paypal') {
    fail('INVALID_CHECKOUT_RECORD', 'The Checkout provider must be PayPal.');
  }

  const sessionId = String(checkout?.sessionId || '').trim();
  if (!PAYPAL_ORDER_ID_PATTERN.test(sessionId)) {
    fail('INVALID_CHECKOUT_RECORD', 'The PayPal order ID is invalid.');
  }

  let checkoutUrl;
  try {
    checkoutUrl = new URL(String(checkout?.url || ''));
  } catch {
    fail('INVALID_CHECKOUT_RECORD', 'The hosted Checkout URL is invalid.');
  }
  if (checkoutUrl.protocol !== 'https:') {
    fail('INVALID_CHECKOUT_RECORD', 'The hosted Checkout URL must use HTTPS.');
  }
  if (!isTrustedPayPalCheckoutUrl(checkoutUrl, checkout.mode)) {
    fail('INVALID_CHECKOUT_RECORD', 'The PayPal Checkout URL is not trusted.');
  }

  const grandTotal = Number(checkout?.quote?.grandTotal);
  if (!Number.isInteger(grandTotal) || grandTotal < 0) {
    fail('INVALID_CHECKOUT_RECORD', 'The Checkout total is invalid.');
  }
  if (String(checkout?.quote?.currency || '').toUpperCase() !== 'EUR') {
    fail('INVALID_CHECKOUT_RECORD', 'The Checkout currency is invalid.');
  }
}

function createPendingCheckoutRecord({
  checkout,
  quote,
  customer,
  deliveryCountry,
  createdAt,
}) {
  if (checkout.quote.grandTotal !== quote.amountInCents.grandTotal) {
    fail('CHECKOUT_AMOUNT_MISMATCH', 'The Checkout result does not match the authoritative quote.');
  }
  if (checkout.quote.currency !== quote.currency) {
    fail('CHECKOUT_CURRENCY_MISMATCH', 'The Checkout result currency does not match the quote.');
  }

  const pending = createPendingOrderRecord({
    reference: checkout.reference,
    amountTotal: checkout.quote.grandTotal,
    currency: checkout.quote.currency,
    mode: checkout.mode,
    paymentSessionId: checkout.sessionId,
    createdAt,
  });

  return Object.freeze({
    ...pending,
    customer: Object.freeze({ ...customer }),
    items: Object.freeze(quote.items.map((item) => Object.freeze({
      slug: item.slug,
      page: item.page,
      sku: item.sku,
      name: item.name,
      image: item.image,
      variantId: item.variantId,
      variantLabel: item.variantLabel,
      sizeLabel: item.sizeLabel,
      widthCm: item.widthCm,
      heightCm: item.heightCm,
      longestSideCm: item.longestSideCm,
      sizeCm: item.sizeCm,
      unitPrice: item.unitPrice,
      quantity: item.quantity,
      lineTotal: item.lineTotal,
    }))),
    discount: Object.freeze({ ...quote.discount }),
    shipping: Object.freeze({
      deliveryCountry,
      zoneCode: quote.shipping.countryCode,
      zone: quote.shipping.zone,
      cost: quote.shipping.cost,
      freeFrom: quote.shipping.freeFrom,
      qualifiesForFreeShipping: quote.shipping.qualifiesForFreeShipping,
    }),
    totals: Object.freeze({ ...quote.amountInCents }),
  });
}

function validatePersistedOrder(order, expected) {
  if (!order || typeof order !== 'object') {
    fail('INVALID_CHECKOUT_STORE_RESULT', 'The checkout store returned no order.');
  }

  for (const [field, expectedValue] of [
    ['reference', expected.reference],
    ['status', 'payment_pending'],
    ['amountTotal', expected.amountTotal],
    ['currency', expected.currency],
    ['mode', expected.mode],
    ['paymentSessionId', expected.paymentSessionId],
  ]) {
    if (order[field] !== expectedValue) {
      fail('CHECKOUT_STORE_CONFLICT', `The persisted order has a conflicting ${field}.`, {
        field,
      });
    }
  }

  for (const field of ['customer', 'items', 'discount', 'shipping', 'totals']) {
    if (!sameImmutableValue(order[field], expected[field])) {
      fail(
        'CHECKOUT_STORE_CONFLICT',
        `The persisted order has conflicting or incomplete ${field}.`,
        { field },
      );
    }
  }

  if (!Number.isInteger(order.version) || order.version < 0) {
    fail('INVALID_CHECKOUT_STORE_RESULT', 'The persisted order version is invalid.');
  }
}

export async function persistPendingHostedCheckout({
  checkout,
  request,
  customer: customerInput,
  catalogProducts,
  checkoutStore,
  createdAt = Math.floor(Date.now() / 1000),
}) {
  const store = requireCheckoutStore(checkoutStore);
  validateCheckoutResult(checkout);

  const deliveryCountry = normalizeDeliveryCountry(request?.countryCode || 'NL');
  const quote = createAuthoritativeOrderQuote(request, catalogProducts);
  const customer = normalizeCheckoutCustomer(customerInput);
  if (customer.country !== deliveryCountry) {
    fail('COUNTRY_MISMATCH', 'Customer country does not match the delivery country.');
  }

  const record = createPendingCheckoutRecord({
    checkout,
    quote,
    customer,
    deliveryCountry,
    createdAt,
  });

  let result;
  try {
    result = await store.persistPendingCheckout(record);
  } catch (error) {
    if (error instanceof CheckoutPersistenceError) throw error;
    if (error?.code === 'ORDER_STORE_CONFLICT') {
      fail('CHECKOUT_STORE_CONFLICT', 'A conflicting pending order already exists.');
    }
    fail('CHECKOUT_PERSISTENCE_FAILED', 'The pending order could not be stored.', {
      causeCode: error?.code || error?.name || 'UNKNOWN',
    });
  }

  if (!result || typeof result.created !== 'boolean') {
    fail(
      'INVALID_CHECKOUT_STORE_RESULT',
      'The checkout store returned an invalid persistence result.',
    );
  }
  validatePersistedOrder(result.order, record);

  return Object.freeze({
    checkout,
    order: Object.freeze({ ...result.order }),
    reservationCreated: result.created,
  });
}
