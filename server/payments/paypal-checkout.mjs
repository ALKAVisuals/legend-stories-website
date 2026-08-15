import { createHash } from 'node:crypto';

import { createAuthoritativeOrderQuote } from '../commerce/order-quote.mjs';
import {
  CheckoutSessionError,
  allocateDiscountCents,
  normalizeCheckoutCustomer,
} from './checkout-core.mjs';
import { normalizePayPalOrderId } from './paypal-api.mjs';

const PAYPAL_REFERENCE_VERSION = 1;

function fail(code, message, details) {
  throw new CheckoutSessionError(code, message, details);
}

function normalizeCountryCode(value, field = 'Country') {
  const country = String(value || '').trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(country)) {
    fail('INVALID_COUNTRY', `${field} must be a two-letter country code.`, { field });
  }
  return country;
}

function normalizeUrl(value, label) {
  let url;
  try {
    url = new URL(String(value || ''));
  } catch {
    fail('INVALID_CHECKOUT_URL', `${label} must be a valid absolute URL.`);
  }
  const localDevelopment = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
  if (url.protocol !== 'https:' && !(localDevelopment && url.protocol === 'http:')) {
    fail('INVALID_CHECKOUT_URL', `${label} must use HTTPS.`);
  }
  if (url.username || url.password) {
    fail('INVALID_CHECKOUT_URL', `${label} must not contain embedded credentials.`);
  }
  return url.toString();
}

function cents(value) {
  const amount = Number(value);
  if (!Number.isInteger(amount) || amount < 0) {
    fail('QUOTE_RECONCILIATION_FAILED', 'PayPal amount is invalid.');
  }
  return (amount / 100).toFixed(2);
}

function itemDescription(item) {
  const parts = [];
  if (item.variantLabel) parts.push(item.variantLabel);
  if (item.sizeLabel) parts.push(item.sizeLabel);
  if (item.quantity > 1) parts.push(`Cart quantity: ${item.quantity}`);
  return parts.join(' · ').slice(0, 127);
}

function buildPayPalItems(quote) {
  const allocations = allocateDiscountCents(quote);
  return quote.items.map((item, index) => {
    const lineCents = Math.round(item.lineTotal * 100);
    const discountedLineCents = lineCents - (allocations[index]?.allocation || 0);
    if (discountedLineCents < 0) {
      fail('QUOTE_RECONCILIATION_FAILED', 'A discounted PayPal product line became negative.');
    }
    return Object.freeze({
      name: String(item.name || 'LegendMural wall sticker').slice(0, 127),
      description: itemDescription(item),
      sku: String(item.sku || item.slug || item.page || 'legendmural').slice(0, 127),
      quantity: '1',
      category: 'PHYSICAL_GOODS',
      unit_amount: Object.freeze({
        currency_code: quote.currency,
        value: cents(discountedLineCents),
      }),
    });
  });
}

function createPayPalReference({ quote, customer, successUrl, cancelUrl, deliveryCountry }) {
  const canonical = JSON.stringify({
    version: PAYPAL_REFERENCE_VERSION,
    provider: 'paypal',
    currency: quote.currency,
    items: quote.items.map((item) => ({
      page: item.page,
      slug: item.slug,
      sku: item.sku,
      variantId: item.variantId,
      unitPrice: item.unitPrice,
      quantity: item.quantity,
      lineTotal: item.lineTotal,
    })),
    discount: quote.discount,
    shipping: {
      deliveryCountry,
      zoneCode: quote.shipping.countryCode,
      cost: quote.shipping.cost,
    },
    totals: quote.amountInCents,
    customer,
    successUrl,
    cancelUrl,
  });
  return createHash('sha256').update(canonical).digest('hex');
}

export function buildPayPalOrderPayload({
  quote,
  customer,
  successUrl,
  cancelUrl,
  reference,
  deliveryCountry = customer.country,
}) {
  const items = buildPayPalItems(quote);
  const itemTotal = items.reduce(
    (sum, item) => sum + Math.round(Number(item.unit_amount.value) * 100),
    0,
  );
  const expectedItemTotal = quote.amountInCents.subtotal - quote.amountInCents.discount;
  if (itemTotal !== expectedItemTotal) {
    fail('QUOTE_RECONCILIATION_FAILED', 'PayPal product items do not match the discounted subtotal.');
  }
  if (itemTotal + quote.amountInCents.shipping !== quote.amountInCents.grandTotal) {
    fail('QUOTE_RECONCILIATION_FAILED', 'PayPal order lines do not match the order total.');
  }

  return Object.freeze({
    intent: 'CAPTURE',
    purchase_units: [Object.freeze({
      reference_id: reference,
      custom_id: reference,
      description: 'LegendMural order',
      amount: Object.freeze({
        currency_code: quote.currency,
        value: cents(quote.amountInCents.grandTotal),
        breakdown: Object.freeze({
          item_total: Object.freeze({
            currency_code: quote.currency,
            value: cents(itemTotal),
          }),
          shipping: Object.freeze({
            currency_code: quote.currency,
            value: cents(quote.amountInCents.shipping),
          }),
        }),
      }),
      items,
      shipping: Object.freeze({
        name: Object.freeze({
          full_name: `${customer.firstname} ${customer.lastname}`,
        }),
        address: Object.freeze({
          address_line_1: customer.street,
          ...(customer.line2 ? { address_line_2: customer.line2 } : {}),
          admin_area_2: customer.city,
          postal_code: customer.zip,
          country_code: deliveryCountry,
        }),
      }),
    })],
    payment_source: Object.freeze({
      paypal: Object.freeze({
        experience_context: Object.freeze({
          brand_name: 'LegendMural',
          user_action: 'PAY_NOW',
          shipping_preference: 'SET_PROVIDED_ADDRESS',
          return_url: normalizeUrl(successUrl, 'PayPal return URL'),
          cancel_url: normalizeUrl(cancelUrl, 'PayPal cancel URL'),
        }),
      }),
    }),
  });
}

function findApprovalUrl(order) {
  const link = Array.isArray(order?.links)
    ? order.links.find((candidate) => ['payer-action', 'approve'].includes(candidate?.rel))
    : null;
  if (!link?.href) {
    fail('INVALID_PAYPAL_ORDER', 'PayPal returned no buyer approval URL.');
  }
  let url;
  try {
    url = new URL(link.href);
  } catch {
    fail('INVALID_PAYPAL_ORDER', 'PayPal returned an invalid buyer approval URL.');
  }
  if (url.protocol !== 'https:') {
    fail('INVALID_PAYPAL_ORDER', 'PayPal returned an insecure buyer approval URL.');
  }
  return url;
}

function validateApprovalUrl(url, mode) {
  const host = url.hostname.toLowerCase();
  const sandboxHost = host === 'sandbox.paypal.com' || host.endsWith('.sandbox.paypal.com');
  const liveHost = host === 'paypal.com' || host.endsWith('.paypal.com');
  if (mode === 'test' && !sandboxHost) {
    fail('INVALID_PAYPAL_ORDER', 'PayPal Sandbox returned an unexpected approval host.');
  }
  if (mode === 'live' && (!liveHost || sandboxHost)) {
    fail('INVALID_PAYPAL_ORDER', 'PayPal live mode returned an unexpected approval host.');
  }
}

export async function createPayPalHostedCheckout({
  request,
  customer: customerInput,
  catalogProducts,
  paypalClient,
  successUrl,
  cancelUrl,
}) {
  if (!paypalClient?.createOrder || !['test', 'live'].includes(paypalClient?.mode)) {
    fail('INVALID_PAYPAL_CLIENT', 'A configured PayPal client is required.');
  }

  const deliveryCountry = normalizeCountryCode(request?.countryCode || 'NL', 'Shipping country');
  const quote = createAuthoritativeOrderQuote(request, catalogProducts);
  const customer = normalizeCheckoutCustomer(customerInput);
  if (customer.country !== deliveryCountry) {
    fail('COUNTRY_MISMATCH', 'Customer country does not match the requested shipping country.');
  }

  const normalizedSuccessUrl = normalizeUrl(successUrl, 'PayPal return URL');
  const normalizedCancelUrl = normalizeUrl(cancelUrl, 'PayPal cancel URL');
  const reference = createPayPalReference({
    quote,
    customer,
    successUrl: normalizedSuccessUrl,
    cancelUrl: normalizedCancelUrl,
    deliveryCountry,
  });
  const payload = buildPayPalOrderPayload({
    quote,
    customer,
    successUrl: normalizedSuccessUrl,
    cancelUrl: normalizedCancelUrl,
    reference,
    deliveryCountry,
  });
  const order = await paypalClient.createOrder(payload, {
    idempotencyKey: `legend-paypal-create-${reference}`,
  });
  const orderId = normalizePayPalOrderId(order?.id);
  if (!['CREATED', 'APPROVED', 'PAYER_ACTION_REQUIRED'].includes(String(order?.status || ''))) {
    fail('INVALID_PAYPAL_ORDER', 'PayPal returned an unexpected order status.');
  }
  const approvalUrl = findApprovalUrl(order);
  validateApprovalUrl(approvalUrl, paypalClient.mode);

  return Object.freeze({
    provider: 'paypal',
    sessionId: orderId,
    url: approvalUrl.toString(),
    mode: paypalClient.mode,
    reference,
    quote: Object.freeze({
      currency: quote.currency,
      subtotal: quote.amountInCents.subtotal,
      discount: quote.amountInCents.discount,
      shipping: quote.amountInCents.shipping,
      grandTotal: quote.amountInCents.grandTotal,
    }),
  });
}
