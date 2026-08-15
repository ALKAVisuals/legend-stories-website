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
const request = {
  items: [{ page: product.page, quantity: 1 }],
  countryCode: 'NL',
  discountCode: 'LEGEND10',
};
const customer = {
  firstname: 'Integrity',
  lastname: 'Buyer',
  email: 'integrity@example.com',
  street: 'Teststraat 10',
  zip: '1234 AB',
  city: 'Amsterdam',
  country: 'NL',
};

function fakePayPalClient() {
  return {
    mode: 'test',
    async createOrder() {
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

async function checkout() {
  return createPayPalHostedCheckout({
    request,
    customer,
    catalogProducts: catalog,
    paypalClient: fakePayPalClient(),
    successUrl: 'https://shop.example/order-success.html',
    cancelUrl: 'https://shop.example/order-cancelled.html',
  });
}

test('store must preserve the complete immutable fulfillment payload', async () => {
  for (const field of ['customer', 'items', 'discount', 'shipping', 'totals']) {
    const hostedCheckout = await checkout();
    await assert.rejects(
      () => persistPendingHostedCheckout({
        checkout: hostedCheckout,
        request,
        customer,
        catalogProducts: catalog,
        checkoutStore: {
          async persistPendingCheckout(order) {
            const incomplete = { ...order };
            delete incomplete[field];
            return { created: true, order: incomplete };
          },
        },
      }),
      (error) => {
        assert.ok(error instanceof CheckoutPersistenceError);
        assert.equal(error.code, 'CHECKOUT_STORE_CONFLICT');
        assert.equal(error.details.field, field);
        return true;
      },
    );
  }
});

test('store cannot modify authoritative product or customer data', async () => {
  const hostedCheckout = await checkout();
  await assert.rejects(
    () => persistPendingHostedCheckout({
      checkout: hostedCheckout,
      request,
      customer,
      catalogProducts: catalog,
      checkoutStore: {
        async persistPendingCheckout(order) {
          return {
            created: true,
            order: {
              ...order,
              customer: { ...order.customer, email: 'changed@example.com' },
              items: [{ ...order.items[0], unitPrice: 1 }],
            },
          };
        },
      },
    }),
    (error) => error instanceof CheckoutPersistenceError
      && error.code === 'CHECKOUT_STORE_CONFLICT',
  );
});
