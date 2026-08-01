import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import {
  CheckoutSessionError,
  allocateDiscountCents,
  createHostedCheckoutSession,
} from '../server/payments/checkout-session.mjs';
import { createAuthoritativeOrderQuote } from '../server/commerce/order-quote.mjs';

const catalog = JSON.parse(
  await readFile(new URL('../data/products/catalog.json', import.meta.url), 'utf8'),
).products;
const firstProduct = catalog[0];
const secondProduct = catalog[1];

const customer = Object.freeze({
  firstname: 'Test',
  lastname: 'Buyer',
  email: 'buyer@example.com',
  street: 'Teststraat 10',
  zip: '1234 AB',
  city: 'Amsterdam',
  country: 'NL',
});

function createFakeStripeClient(capture = {}) {
  return Object.freeze({
    mode: 'test',
    async createCheckoutSession(payload, options) {
      capture.payload = payload;
      capture.options = options;
      return {
        id: 'cs_test_legend',
        url: 'https://checkout.stripe.com/c/pay/cs_test_legend',
        livemode: false,
      };
    },
  });
}

test('discount allocation reconciles exactly to the authoritative quote', () => {
  const quote = createAuthoritativeOrderQuote({
    items: [
      { page: firstProduct.page, quantity: 1 },
      { page: secondProduct.page, quantity: 2 },
    ],
    countryCode: 'NL',
    discountCode: 'LEGEND10',
  }, catalog);

  const allocations = allocateDiscountCents(quote);
  assert.equal(
    allocations.reduce((sum, line) => sum + line.allocation, 0),
    quote.amountInCents.discount,
  );
  assert.equal(
    allocations.reduce((sum, line) => sum + line.lineCents, 0),
    quote.amountInCents.subtotal,
  );
});

test('hosted Checkout Session uses authoritative totals, shipping and customer data', async () => {
  const capture = {};
  const checkout = await createHostedCheckoutSession({
    request: {
      items: [
        { page: firstProduct.page, quantity: 1, price: 0.01 },
        { page: secondProduct.page, quantity: 2, price: 9999 },
      ],
      countryCode: 'NL',
      discountCode: 'LEGEND10',
    },
    customer,
    catalogProducts: catalog,
    stripeClient: createFakeStripeClient(capture),
    successUrl: 'https://example.com/order-success.html',
    cancelUrl: 'https://example.com/order-cancelled.html',
  });

  const stripeTotal = capture.payload.line_items.reduce(
    (sum, item) => sum + item.price_data.unit_amount * item.quantity,
    0,
  );
  assert.equal(stripeTotal, checkout.quote.grandTotal);
  assert.equal(capture.payload.customer_email, customer.email);
  assert.equal(capture.payload.payment_intent_data.shipping.address.country, 'NL');
  assert.match(capture.payload.success_url, /session_id=\{CHECKOUT_SESSION_ID\}$/);
  assert.equal(capture.payload.cancel_url, 'https://example.com/order-cancelled.html');
  assert.equal(capture.options.idempotencyKey, `legend-checkout-${checkout.reference}`);
  assert.equal(checkout.mode, 'test');
});

test('identical checkout requests produce stable idempotency references', async () => {
  const input = {
    request: {
      items: [{ page: firstProduct.page, quantity: 1 }],
      countryCode: 'NL',
    },
    customer,
    catalogProducts: catalog,
    successUrl: 'https://example.com/success',
    cancelUrl: 'https://example.com/cancel',
  };

  const first = await createHostedCheckoutSession({
    ...input,
    stripeClient: createFakeStripeClient(),
  });
  const second = await createHostedCheckoutSession({
    ...input,
    stripeClient: createFakeStripeClient(),
  });
  assert.equal(first.reference, second.reference);
});

test('customer country must match the authoritative shipping quote', async () => {
  await assert.rejects(
    () => createHostedCheckoutSession({
      request: {
        items: [{ page: firstProduct.page, quantity: 1 }],
        countryCode: 'DE',
      },
      customer,
      catalogProducts: catalog,
      stripeClient: createFakeStripeClient(),
      successUrl: 'https://example.com/success',
      cancelUrl: 'https://example.com/cancel',
    }),
    (error) => {
      assert.ok(error instanceof CheckoutSessionError);
      assert.equal(error.code, 'COUNTRY_MISMATCH');
      return true;
    },
  );
});

test('test mode rejects live or unexpected Checkout Session responses', async () => {
  const invalidClient = {
    mode: 'test',
    async createCheckoutSession() {
      return {
        id: 'cs_live_wrong',
        url: 'https://malicious.example/checkout',
        livemode: true,
      };
    },
  };

  await assert.rejects(
    () => createHostedCheckoutSession({
      request: {
        items: [{ page: firstProduct.page, quantity: 1 }],
        countryCode: 'NL',
      },
      customer,
      catalogProducts: catalog,
      stripeClient: invalidClient,
      successUrl: 'https://example.com/success',
      cancelUrl: 'https://example.com/cancel',
    }),
    (error) => {
      assert.ok(error instanceof CheckoutSessionError);
      assert.equal(error.code, 'INVALID_STRIPE_SESSION');
      return true;
    },
  );
});
