import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import {
  CheckoutPersistenceError,
  persistPendingHostedCheckout,
} from '../server/orders/checkout-persistence.mjs';
import { createPayPalHostedCheckout } from '../server/payments/paypal-checkout.mjs';

const catalog = JSON.parse(
  await readFile(new URL('../data/products/catalog.json', import.meta.url), 'utf8'),
).products;
const product = catalog[0];
const defaultVariant = product.variants?.find((variant) => (
  variant.id === product.defaultVariantId || variant.isDefault
));
const expectedProductName = defaultVariant?.sizeLabel
  ? `${product.name} — ${defaultVariant.label} (${defaultVariant.sizeLabel})`
  : product.name;
const expectedUnitPrice = defaultVariant?.price ?? product.price;

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

function fakePayPalClient(capture = {}) {
  return {
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
      };
    },
  };
}

async function createCheckout(capture = {}) {
  return createPayPalHostedCheckout({
    request,
    customer,
    catalogProducts: catalog,
    paypalClient: fakePayPalClient(capture),
    successUrl: 'https://shop.example/order-success.html',
    cancelUrl: 'https://shop.example/order-cancelled.html',
  });
}

test('durable persistence stores an authoritative PayPal pending order', async () => {
  const paypalCapture = {};
  const checkout = await createCheckout(paypalCapture);
  const storeCapture = {};
  const persisted = await persistPendingHostedCheckout({
    checkout,
    request,
    customer,
    catalogProducts: catalog,
    checkoutStore: {
      async persistPendingCheckout(order) {
        storeCapture.order = order;
        return { created: true, order };
      },
    },
    createdAt: 1_800_000_000,
  });

  assert.equal(checkout.provider, 'paypal');
  assert.equal(checkout.sessionId, '5O190127TN364715T');
  assert.equal(persisted.reservationCreated, true);
  assert.equal(storeCapture.order.reference, checkout.reference);
  assert.equal(storeCapture.order.status, 'payment_pending');
  assert.equal(storeCapture.order.amountTotal, checkout.quote.grandTotal);
  assert.equal(storeCapture.order.paymentSessionId, checkout.sessionId);
  assert.equal(storeCapture.order.documentProfileVersion, 0);
  assert.equal(storeCapture.order.items[0].name, expectedProductName);
  assert.equal(storeCapture.order.items[0].unitPrice, expectedUnitPrice);
  assert.equal(storeCapture.order.customer.email, customer.email);
  assert.equal(storeCapture.order.discount.code, 'LEGEND10');
  assert.equal(storeCapture.order.version, 0);
  assert.match(paypalCapture.options.idempotencyKey, /^legend-paypal-create-[a-f0-9]{64}$/);
});

test('document profile comes from the trusted server option and ignores browser payload fields', async () => {
  const checkout = await createCheckout();
  const tamperedBrowserRequest = { ...request, documentProfileVersion: 1 };
  let profile0Order;
  await persistPendingHostedCheckout({
    checkout,
    request: tamperedBrowserRequest,
    customer,
    catalogProducts: catalog,
    checkoutStore: {
      async persistPendingCheckout(order) {
        profile0Order = order;
        return { created: true, order };
      },
    },
    createdAt: 1_800_000_000,
  });
  assert.equal(profile0Order.documentProfileVersion, 0);

  let profile1Order;
  await persistPendingHostedCheckout({
    checkout,
    request: { ...request, documentProfileVersion: 0 },
    customer,
    catalogProducts: catalog,
    documentProfileVersion: 1,
    checkoutStore: {
      async persistPendingCheckout(order) {
        profile1Order = order;
        return { created: true, order };
      },
    },
    createdAt: 1_800_000_000,
  });
  assert.equal(profile1Order.documentProfileVersion, 1);
});

test('missing durable storage rejects before persistence is attempted', async () => {
  const checkout = await createCheckout();
  await assert.rejects(
    () => persistPendingHostedCheckout({
      checkout,
      request,
      customer,
      catalogProducts: catalog,
      checkoutStore: null,
    }),
    (error) => error instanceof CheckoutPersistenceError
      && error.code === 'CHECKOUT_STORE_NOT_CONFIGURED',
  );
});

test('idempotent storage may return the same pending order as an existing record', async () => {
  const checkout = await createCheckout();
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
    checkout,
    request,
    customer,
    catalogProducts: catalog,
    checkoutStore: store,
    createdAt: 1_800_000_000,
  });
  const second = await persistPendingHostedCheckout({
    checkout,
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
  assert.equal(second.order.documentProfileVersion, 0);
});

test('storage conflicts reject the checkout response', async () => {
  const checkout = await createCheckout();
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
            order: { ...order, paymentSessionId: 'DIFFERENTPAYPALID' },
          };
        },
      },
    }),
    (error) => error instanceof CheckoutPersistenceError
      && error.code === 'CHECKOUT_STORE_CONFLICT',
  );
});

test('storage failures are sanitized as persistence failures', async () => {
  const checkout = await createCheckout();
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

test('persistence rejects checkout responses without explicit PayPal provider', async () => {
  const checkout = await createCheckout();
  const { provider, ...withoutProvider } = checkout;
  await assert.rejects(
    () => persistPendingHostedCheckout({
      checkout: withoutProvider,
      request,
      customer,
      catalogProducts: catalog,
      checkoutStore: { async persistPendingCheckout(order) { return { created: true, order }; } },
    }),
    (error) => error instanceof CheckoutPersistenceError
      && error.code === 'INVALID_CHECKOUT_RECORD',
  );
});
