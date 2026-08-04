import { createHash } from 'node:crypto';

import { createAuthoritativeOrderQuote } from '../commerce/order-quote.mjs';

const REFERENCE_VERSION = 2;

export class CheckoutSessionError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = 'CheckoutSessionError';
    this.code = code;
    this.details = details;
  }
}

function fail(code, message, details) {
  throw new CheckoutSessionError(code, message, details);
}

function hasControlCharacters(value) {
  return /[\u0000-\u001F\u007F]/.test(value);
}

function requiredText(value, field, maxLength) {
  const normalized = String(value || '').trim();
  if (!normalized) fail('INVALID_CUSTOMER', `${field} is required.`, { field });
  if (normalized.length > maxLength) {
    fail('INVALID_CUSTOMER', `${field} is too long.`, { field, maxLength });
  }
  if (hasControlCharacters(normalized)) {
    fail('INVALID_CUSTOMER', `${field} contains invalid characters.`, { field });
  }
  return normalized;
}

function optionalText(value, field, maxLength) {
  const normalized = String(value || '').trim();
  if (normalized.length > maxLength) {
    fail('INVALID_CUSTOMER', `${field} is too long.`, { field, maxLength });
  }
  if (hasControlCharacters(normalized)) {
    fail('INVALID_CUSTOMER', `${field} contains invalid characters.`, { field });
  }
  return normalized;
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

function successUrlWithSessionId(value) {
  const url = new URL(normalizeUrl(value, 'Checkout success URL'));
  const placeholder = 'LEGEND_CHECKOUT_SESSION_ID';
  url.searchParams.set('session_id', placeholder);
  return url.toString().replace(placeholder, '{CHECKOUT_SESSION_ID}');
}

export function normalizeCheckoutCustomer(customer = {}) {
  const firstname = requiredText(customer.firstname, 'First name', 80);
  const lastname = requiredText(customer.lastname, 'Last name', 80);
  const email = requiredText(customer.email, 'Email', 254).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    fail('INVALID_CUSTOMER', 'Email address is invalid.', { field: 'email' });
  }

  return Object.freeze({
    firstname,
    lastname,
    email,
    street: requiredText(customer.street, 'Street', 160),
    line2: optionalText(customer.line2, 'Address line 2', 160),
    zip: requiredText(customer.zip, 'Postal code', 32),
    city: requiredText(customer.city, 'City', 100),
    country: normalizeCountryCode(customer.country),
  });
}

export function allocateDiscountCents(quote) {
  const subtotal = quote.amountInCents.subtotal;
  const discount = quote.amountInCents.discount;
  const lines = quote.items.map((item) => ({
    page: item.page,
    lineCents: Math.round(item.lineTotal * 100),
    allocation: 0,
    remainder: 0,
  }));

  const lineSum = lines.reduce((sum, line) => sum + line.lineCents, 0);
  if (lineSum !== subtotal) {
    fail('QUOTE_RECONCILIATION_FAILED', 'Product line totals do not match the quote subtotal.');
  }
  if (discount === 0) return Object.freeze(lines.map((line) => Object.freeze(line)));
  if (discount < 0 || discount > subtotal) {
    fail('QUOTE_RECONCILIATION_FAILED', 'The quote discount is outside the valid range.');
  }

  let allocated = 0;
  for (const line of lines) {
    const numerator = line.lineCents * discount;
    line.allocation = Math.floor(numerator / subtotal);
    line.remainder = numerator % subtotal;
    allocated += line.allocation;
  }

  const remaining = discount - allocated;
  const ranked = lines
    .map((line, index) => ({
      line,
      index,
      variantId: String(quote.items[index]?.variantId || ''),
    }))
    .sort((left, right) => {
      if (right.line.remainder !== left.line.remainder) {
        return right.line.remainder - left.line.remainder;
      }
      const pageOrder = left.line.page.localeCompare(right.line.page);
      if (pageOrder !== 0) return pageOrder;
      const variantOrder = left.variantId.localeCompare(right.variantId);
      return variantOrder || left.index - right.index;
    });
  for (let index = 0; index < remaining; index += 1) {
    ranked[index % ranked.length].line.allocation += 1;
  }

  return Object.freeze(lines.map((line) => Object.freeze(line)));
}

function productDescription(item) {
  const parts = [];
  if (item.sizeLabel) parts.push(`Size: ${item.sizeLabel}`);
  parts.push(`Quantity: ${item.quantity}`);
  return parts.join(' · ');
}

function buildStripeLineItems(quote, deliveryCountry) {
  const allocations = allocateDiscountCents(quote);

  const lineItems = quote.items.map((item, index) => {
    const lineCents = Math.round(item.lineTotal * 100);
    const discountedLineCents = lineCents - (allocations[index]?.allocation || 0);
    if (discountedLineCents < 0) {
      fail('QUOTE_RECONCILIATION_FAILED', 'A discounted product line became negative.', {
        page: item.page,
        variantId: item.variantId,
      });
    }

    return {
      price_data: {
        currency: quote.currency.toLowerCase(),
        unit_amount: discountedLineCents,
        product_data: {
          name: item.name,
          description: productDescription(item),
          metadata: {
            page: item.page,
            slug: item.slug,
            sku: item.sku || item.slug,
            variant_id: item.variantId || 'legacy',
            variant_label: item.variantLabel || 'Standard',
            size_label: item.sizeLabel || 'legacy',
            width_cm: item.widthCm ? String(item.widthCm) : 'legacy',
            height_cm: item.heightCm ? String(item.heightCm) : 'legacy',
            longest_side_cm: item.longestSideCm ? String(item.longestSideCm) : 'legacy',
            size_cm: item.longestSideCm ? String(item.longestSideCm) : 'legacy',
            quantity: String(item.quantity),
          },
        },
      },
      quantity: 1,
    };
  });

  if (quote.amountInCents.shipping > 0) {
    lineItems.push({
      price_data: {
        currency: quote.currency.toLowerCase(),
        unit_amount: quote.amountInCents.shipping,
        product_data: {
          name: `Shipping — ${quote.shipping.zone}`,
          metadata: {
            type: 'shipping',
            delivery_country: deliveryCountry,
            shipping_zone_code: quote.shipping.countryCode,
          },
        },
      },
      quantity: 1,
    });
  }

  const stripeTotal = lineItems.reduce(
    (sum, item) => sum + item.price_data.unit_amount * item.quantity,
    0,
  );
  if (stripeTotal !== quote.amountInCents.grandTotal) {
    fail('QUOTE_RECONCILIATION_FAILED', 'Stripe line items do not match the order total.', {
      stripeTotal,
      quoteTotal: quote.amountInCents.grandTotal,
    });
  }

  return lineItems;
}

function createReference({ quote, customer, successUrl, cancelUrl, deliveryCountry }) {
  const canonical = JSON.stringify({
    version: REFERENCE_VERSION,
    currency: quote.currency,
    items: quote.items.map((item) => ({
      page: item.page,
      slug: item.slug,
      sku: item.sku,
      name: item.name,
      variantId: item.variantId,
      variantLabel: item.variantLabel,
      sizeLabel: item.sizeLabel,
      widthCm: item.widthCm,
      heightCm: item.heightCm,
      longestSideCm: item.longestSideCm,
      unitPrice: item.unitPrice,
      quantity: item.quantity,
      lineTotal: item.lineTotal,
    })),
    discount: quote.discount,
    shipping: {
      deliveryCountry,
      zoneCode: quote.shipping.countryCode,
      zone: quote.shipping.zone,
      cost: quote.shipping.cost,
      freeFrom: quote.shipping.freeFrom,
    },
    totals: quote.amountInCents,
    customer,
    successUrl,
    cancelUrl,
  });
  return createHash('sha256').update(canonical).digest('hex');
}

export function buildStripeCheckoutSessionPayload({
  quote,
  customer,
  successUrl,
  cancelUrl,
  reference,
  deliveryCountry = customer.country,
}) {
  const normalizedSuccessUrl = normalizeUrl(successUrl, 'Checkout success URL');
  const normalizedCancelUrl = normalizeUrl(cancelUrl, 'Checkout cancel URL');
  const metadata = {
    order_reference: reference,
    delivery_country: deliveryCountry,
    shipping_zone_code: quote.shipping.countryCode,
    currency: quote.currency,
    item_count: String(quote.items.length),
    quantity_total: String(quote.items.reduce((sum, item) => sum + item.quantity, 0)),
    discount_code: quote.discount.code || 'NONE',
  };

  return Object.freeze({
    mode: 'payment',
    customer_email: customer.email,
    client_reference_id: reference,
    success_url: successUrlWithSessionId(normalizedSuccessUrl),
    cancel_url: normalizedCancelUrl,
    line_items: buildStripeLineItems(quote, deliveryCountry),
    metadata,
    payment_intent_data: {
      metadata,
      shipping: {
        name: `${customer.firstname} ${customer.lastname}`,
        address: {
          line1: customer.street,
          ...(customer.line2 ? { line2: customer.line2 } : {}),
          postal_code: customer.zip,
          city: customer.city,
          country: deliveryCountry,
        },
      },
    },
  });
}

function validateStripeSession(session, mode) {
  if (!session?.id || !session?.url) {
    fail('INVALID_STRIPE_SESSION', 'Stripe returned an incomplete Checkout Session.');
  }
  if (!['test', 'live'].includes(mode)) {
    fail('INVALID_STRIPE_CLIENT', 'Stripe client mode must be test or live.');
  }
  if (mode === 'test' && (!String(session.id).startsWith('cs_test_') || session.livemode)) {
    fail('INVALID_STRIPE_SESSION', 'Test mode requires a Stripe test Checkout Session.');
  }
  if (mode === 'live' && (!String(session.id).startsWith('cs_live_') || !session.livemode)) {
    fail('INVALID_STRIPE_SESSION', 'Live mode requires a Stripe live Checkout Session.');
  }

  let checkoutUrl;
  try {
    checkoutUrl = new URL(session.url);
  } catch {
    fail('INVALID_STRIPE_SESSION', 'Stripe returned an invalid Checkout URL.');
  }
  if (checkoutUrl.protocol !== 'https:' || checkoutUrl.hostname !== 'checkout.stripe.com') {
    fail('INVALID_STRIPE_SESSION', 'Stripe returned an unexpected Checkout URL.');
  }
}

export async function createHostedCheckoutSession({
  request,
  customer: customerInput,
  catalogProducts,
  stripeClient,
  successUrl,
  cancelUrl,
}) {
  if (!stripeClient?.createCheckoutSession || !stripeClient?.mode) {
    fail('INVALID_STRIPE_CLIENT', 'A configured Stripe client is required.');
  }

  const deliveryCountry = normalizeCountryCode(request?.countryCode || 'NL', 'Shipping country');
  const quote = createAuthoritativeOrderQuote(request, catalogProducts);
  const customer = normalizeCheckoutCustomer(customerInput);
  if (customer.country !== deliveryCountry) {
    fail('COUNTRY_MISMATCH', 'Customer country does not match the requested shipping country.');
  }

  const normalizedSuccessUrl = normalizeUrl(successUrl, 'Checkout success URL');
  const normalizedCancelUrl = normalizeUrl(cancelUrl, 'Checkout cancel URL');
  const reference = createReference({
    quote,
    customer,
    successUrl: normalizedSuccessUrl,
    cancelUrl: normalizedCancelUrl,
    deliveryCountry,
  });
  const payload = buildStripeCheckoutSessionPayload({
    quote,
    customer,
    successUrl: normalizedSuccessUrl,
    cancelUrl: normalizedCancelUrl,
    reference,
    deliveryCountry,
  });
  const session = await stripeClient.createCheckoutSession(payload, {
    idempotencyKey: `legend-checkout-${reference}`,
  });
  validateStripeSession(session, stripeClient.mode);

  return Object.freeze({
    sessionId: session.id,
    url: session.url,
    mode: stripeClient.mode,
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
