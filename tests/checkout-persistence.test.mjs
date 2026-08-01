import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import {
  CheckoutPersistenceError,
  createDurableHostedCheckoutSession,
  persistPendingHostedCheckout,
} from '../server/orders/checkout-persistence.mjs';
import { createHostedCheckoutSession } from '../server/payments/checkout-session.mjs';

const catalog = JSON.parse(
  await readFile(new URL('../data/products/catalog.json', import.meta.url), 'utf8'),
).products;
const product = catalog[0];

const request = Object.freeze({
  items: [{
    page: product.page,
    quantity: 1,
    price: 0.01,
    name: 'Tampered browser name',
  }],
  countryCode: 'NL',
  discountCode: 'LEGEND10',
});
const customer = Object.freeze({
  firstname: 'Test',
  lastname: 'Buyer',
  email: 'buyer@example.com',
  street: 'Teststraat 10',
  zip: '1234 AB',
  city: 'Amsterdam',
  country: 'NL',
});

function fakeStripeClient(capture = {}, order = []) {
  return {
    mode: 'test',
    async createCheckoutSession(payload, options) {
      order.push('stripe');
      capture.payload = payload;
      capture.options = options;
      return {
        id: 'cs_test_durable_checkout',
        url: 'https://checkout.stripe.com/c/pay/cs_test_durable_checkout',
        livemode: false,
      };
    },
  };
}

function checkoutInput(overrides = {}) {
  return {
    request,
    customer,
    catalogProducts: catalog,
    stripeClient: fakeStripeClient(),
    successUrl: 'https://shop.example/order-success.html',
    cancelUrl: 'https://shop.example/order-cancelled.html',
    ...overrides,
  };
}

test('durable checkout persists an authoritative pending order before returning', async () => {
  const sequence = [];
  const stripeCapture = {};
  const storeCapture = {};
  const checkout = await createDurableHostedCheckoutSession({
    ...checkoutInput({ stripeClient: fakeStripeClient(stripeCapture, sequence) }),
    checkoutStore: {
      async persistPendingCheckout(order) {
        sequence.push('store');
        storeCapture.order = order;
        return { created: true, order };
      },
    },
    createdAt: 1_800_000_000,
  });

  assert.deepEqual(sequence, ['stripe', 'store']);
  assert.equal(checkout.sessionId, 'cs_test_durable_checkout');
  assert.equal(checkout.reservationCreated, true);
  assert.equal(storeCapture.order.reference, checkout.reference);
  assert.equal(storeCapture.order.status, 'payment_pending');
  assert.equal(storeCapture.order.amountTotal, checkout.quote.grandTotal);
  assert.equal(storeCapture.order.paymentSessionId, checkout.sessionId);
  assert.equal(storeCapture.order.items[0].name, product.name);
  assert.equal(storeCapture.order.items[0].unitPrice, product.price);
  assert.equal(storeCapture.order.customer.email, customer.email);
  assert.equal(storeCapture.order.discount.code, 'LEGEND10');
  assert.equal(storeCapture.order.version, 0);
  assert.match(stripeCapture.options.idempotencyKey, /^legend-checkout-[a-f0-9]{64}$/);
});

test('missing durable storage blocks Stripe before a session is created', async () => {
  let stripeCalled = false;
  await assert.rejects(
    () => createDurableHostedCheckoutSession({
      ...checkoutInput({
        stripeClient: {
          mode: 'test',
          async createCheckoutSession() {
            stripeCalled = true;
          },
        },
      }),
    }),
    (error) => error instanceof CheckoutPersistenceError
      && error.code === 'CHECKOUT_STORE_NOT_CONFIGURED',
  );
  assert.equal(stripeCalled, false);
});

test('idempotent storage may return the same pending order as an existing record', async () => {
  const firstCheckout = await createHostedCheckoutSession(checkoutInput());
  let persistedOrder = null;
  const store = {
    async persistPendingCheckout(order) {
      if (!persistedOrder) {
        persistedOrder = order;
        return { created: true, order };
      }
      return { created: false, order: persistedOrder };
    },
  };

  const first = await persistPendingHostedCheckout({
    checkout: firstCheckout,
    request,
    customer,
    catalogProducts: catalog,
    checkoutStore: store,
    createdAt: 1_800_000_000,
  });
  const second = await persistPendingHostedCheckout({
    checkout: firstCheckout,
    request,
    customer,
    catalogProducts: catalog,
    checkoutStore: store,
    createdAt: 1_800_000_001,
  });

  assert.equal(first.reservationCreated, true);
  assert.equal(second.reservationCreated, false);
  assert.equal(second.order.reference, first.order.reference);
  assert.equal(second.order.paymentSessionId, first.order.paymentSessionId);
});

test('storage conflicts reject the Checkout response', async () => {
  const checkout = await createHostedCheckoutSession(checkoutInput());
  await assert.rejects(
    () => persistPendingHostedCheckout({
      checkout,
      request,
      customer,
      catalogProducts: catalog,
      checkoutStore: {
        async persistPendingCheckout(order) {
          return {
            created: false,
            order: { ...order, paymentSessionId: 'cs_test_conflict' },
          };
        },
      },
    }),
    (error) => error instanceof CheckoutPersistenceError
      && error.code === 'CHECKOUT_STORE_CONFLICT',
  );
});

test('storage failures are sanitized as persistence failures', async () => {
  const checkout = await createHostedCheckoutSession(checkoutInput());
  await assert.rejects(
    () => persistPendingHostedCheckout({
      checkout,
      request,
      customer,
      catalogProducts: catalog,
      checkoutStore: {
        async persistPendingCheckout() {
          const error = new Error('postgres connection details');
          error.code = 'ECONNREFUSED';
          throw error;
        },
      },
    }),
    (error) => {
      assert.ok(error instanceof CheckoutPersistenceError);
      assert.equal(error.code, 'CHECKOUT_PERSISTENCE_FAILED');
      assert.equal(error.message.includes('postgres'), false);
      assert.equal(error.details.causeCode, 'ECONNREFUSED');
      return true;
    },
  );
});
