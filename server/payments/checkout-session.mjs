import { createHash } from 'node:crypto';

import { createAuthoritativeOrderQuote } from '../commerce/order-quote.mjs';

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

function requiredText(value, field, maxLength) {
  const normalized = String(value || '').trim();
  if (!normalized) fail('INVALID_CUSTOMER', `${field} is required.`, { field });
  if (normalized.length > maxLength) {
    fail('INVALID_CUSTOMER', `${field} is too long.`, { field, maxLength });
  }
  return normalized;
}

function optionalText(value, maxLength) {
  const normalized = String(value || '').trim();
  return normalized.slice(0, maxLength);
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
  return url.toString();
}

function successUrlWithSessionId(value) {
  const normalized = normalizeUrl(value, 'Checkout success URL');
  const separator = normalized.includes('?') ? '&' : '?';
  return `${normalized}${separator}session_id={CHECKOUT_SESSION_ID}`;
}

export function normalizeCheckoutCustomer(customer = {}) {
  const firstname = requiredText(customer.firstname, 'First name', 80);
  const lastname = requiredText(customer.lastname, 'Last name', 80);
  const email = requiredText(customer.email, 'Email', 254).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    fail('INVALID_CUSTOMER', 'Email address is invalid.', { field: 'email' });
  }

  const country = requiredText(customer.country, 'Country', 2).toUpperCase();
  if (!/^[A-Z]{2}$/.test(country)) {
    fail('INVALID_CUSTOMER', 'Country must be a two-letter country code.', { field: 'country' });
  }

  return Object.freeze({
    firstname,
    lastname,
    email,
    street: requiredText(customer.street, 'Street', 160),
    line2: optionalText(customer.line2, 160),
    zip: requiredText(customer.zip, 'Postal code', 32),
    city: requiredText(customer.city, 'City', 100),
    country,
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

  let remaining = discount - allocated;
  const ranked = [...lines].sort((left, right) => {
    if (right.remainder !== left.remainder) return right.remainder - left.remainder;
    return left.page.localeCompare(right.page);
  });
  for (let index = 0; index < remaining; index += 1) {
    ranked[index % ranked.length].allocation += 1;
  }

  return Object.freeze(lines.map((line) => Object.freeze(line)));
}

function buildStripeLineItems(quote) {
  const allocations = new Map(
    allocateDiscountCents(quote).map((line) => [line.page, line.allocation]),
  );

  const lineItems = quote.items.map((item) => {
    const lineCents = Math.round(item.lineTotal * 100);
    const discountedLineCents = lineCents - (allocations.get(item.page) || 0);
    if (discountedLineCents < 0) {
      fail('QUOTE_RECONCILIATION_FAILED', 'A discounted product line became negative.', {
        page: item.page,
      });
    }

    return {
      price_data: {
        currency: quote.currency.toLowerCase(),
        unit_amount: discountedLineCents,
        product_data: {
          name: item.name,
          description: `Quantity: ${item.quantity}`,
          metadata: {
            page: item.page,
            slug: item.slug,
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
            country: quote.shipping.countryCode,
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

function createReference(quote, customer) {
  const canonical = JSON.stringify({
    items: quote.items.map((item) => ({ page: item.page, quantity: item.quantity })),
    country: quote.shipping.countryCode,
    discount: quote.discount.code,
    customer: {
      email: customer.email,
      street: customer.street,
      line2: customer.line2,
      zip: customer.zip,
      city: customer.city,
      country: customer.country,
    },
  });
  return createHash('sha256').update(canonical).digest('hex');
}

export function buildStripeCheckoutSessionPayload({
  quote,
  customer,
  successUrl,
  cancelUrl,
  reference,
}) {
  const metadata = {
    order_reference: reference,
    country_code: quote.shipping.countryCode,
    currency: quote.currency,
    item_count: String(quote.items.length),
    quantity_total: String(quote.items.reduce((sum, item) => sum + item.quantity, 0)),
    discount_code: quote.discount.code || 'NONE',
  };

  return Object.freeze({
    mode: 'payment',
    customer_email: customer.email,
    client_reference_id: reference,
    success_url: successUrlWithSessionId(successUrl),
    cancel_url: normalizeUrl(cancelUrl, 'Checkout cancel URL'),
    line_items: buildStripeLineItems(quote),
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
          country: customer.country,
        },
      },
    },
  });
}

function validateStripeSession(session, mode) {
  if (!session?.id || !session?.url) {
    fail('INVALID_STRIPE_SESSION', 'Stripe returned an incomplete Checkout Session.');
  }
  if (mode === 'test' && !String(session.id).startsWith('cs_test_')) {
    fail('INVALID_STRIPE_SESSION', 'Test mode requires a Stripe test Checkout Session.');
  }
  if (mode === 'test' && session.livemode) {
    fail('INVALID_STRIPE_SESSION', 'Stripe returned a live session while test mode is active.');
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

  const quote = createAuthoritativeOrderQuote(request, catalogProducts);
  const customer = normalizeCheckoutCustomer(customerInput);
  if (customer.country !== quote.shipping.countryCode) {
    fail('COUNTRY_MISMATCH', 'Customer country does not match the quoted shipping country.');
  }

  const reference = createReference(quote, customer);
  const payload = buildStripeCheckoutSessionPayload({
    quote,
    customer,
    successUrl,
    cancelUrl,
    reference,
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
