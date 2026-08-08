import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import {
  CheckoutSessionError,
} from '../server/payments/checkout-session.mjs';
import {
  createPayPalHostedCheckout,
} from '../server/payments/paypal-checkout.mjs';

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

function fakePayPalClient(capture = {}, overrides = {}) {
  return Object.freeze({
    mode: 'test',
    async createOrder(payload, options) {
      capture.payload = payload;
      capture.options = options;
      return {
        id: '5O190127TN364715T',
        status: 'CREATED',
        links: [{
          rel: 'payer-action',
          href: 'https://www.sandbox.paypal.com/checkoutnow?token=5O190127TN364715T',
        }],
        ...overrides,
      };
    },
  });
}

test('PayPal hosted checkout uses authoritative totals, discount, shipping and customer address', async () => {
  const capture = {};
  const checkout = await createPayPalHostedCheckout({
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
    paypalClient: fakePayPalClient(capture),
    successUrl: 'https://example.com/order-success.html',
    cancelUrl: 'https://example.com/order-cancelled.html',
  });

  const unit = capture.payload.purchase_units[0];
  const itemTotal = unit.items.reduce(
    (sum, item) => sum + Math.round(Number(item.unit_amount.value) * 100),
    0,
  );
  assert.equal(checkout.provider, 'paypal');
  assert.equal(checkout.mode, 'test');
  assert.equal(checkout.sessionId, '5O190127TN364715T');
  assert.equal(itemTotal, checkout.quote.subtotal - checkout.quote.discount);
  assert.equal(Math.round(Number(unit.amount.breakdown.shipping.value) * 100), checkout.quote.shipping);
  assert.equal(Math.round(Number(unit.amount.value) * 100), checkout.quote.grandTotal);
  assert.equal(unit.shipping.address.country_code, 'NL');
  assert.equal(unit.custom_id, checkout.reference);
  assert.equal(unit.reference_id, checkout.reference);
  assert.equal(capture.payload.payment_source.paypal.experience_context.shipping_preference, 'SET_PROVIDED_ADDRESS');
  assert.equal(capture.payload.payment_source.paypal.experience_context.user_action, 'PAY_NOW');
  assert.equal(capture.options.idempotencyKey, `legend-paypal-create-${checkout.reference}`);
  assert.match(checkout.url, /^https:\/\/www\.sandbox\.paypal\.com\//);
});

test('PayPal checkout reference is stable for identical requests', async () => {
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
  const first = await createPayPalHostedCheckout({
    ...input,
    paypalClient: fakePayPalClient(),
  });
  const second = await createPayPalHostedCheckout({
    ...input,
    paypalClient: fakePayPalClient(),
  });
  assert.equal(first.reference, second.reference);
});

test('PayPal checkout rejects mismatched delivery countries', async () => {
  await assert.rejects(
    () => createPayPalHostedCheckout({
      request: {
        items: [{ page: firstProduct.page, quantity: 1 }],
        countryCode: 'NL',
      },
      customer: { ...customer, country: 'DE' },
      catalogProducts: catalog,
      paypalClient: fakePayPalClient(),
      successUrl: 'https://example.com/success',
      cancelUrl: 'https://example.com/cancel',
    }),
    (error) => error instanceof CheckoutSessionError && error.code === 'COUNTRY_MISMATCH',
  );
});

test('PayPal Sandbox checkout rejects unexpected approval hosts', async () => {
  await assert.rejects(
    () => createPayPalHostedCheckout({
      request: {
        items: [{ page: firstProduct.page, quantity: 1 }],
        countryCode: 'NL',
      },
      customer,
      catalogProducts: catalog,
      paypalClient: fakePayPalClient({}, {
        links: [{ rel: 'payer-action', href: 'https://attacker.example/checkout' }],
      }),
      successUrl: 'https://example.com/success',
      cancelUrl: 'https://example.com/cancel',
    }),
    (error) => error instanceof CheckoutSessionError && error.code === 'INVALID_PAYPAL_ORDER',
  );
});
