import { readFile } from 'node:fs/promises';

import { createDurableHostedCheckoutSession } from '../server/orders/checkout-persistence.mjs';

const catalog = JSON.parse(
  await readFile(new URL('../data/products/catalog.json', import.meta.url), 'utf8'),
).products;
const errors = [];

for (const [index, product] of catalog.entries()) {
  let storedOrder = null;
  const deliveryCountry = index % 2 === 0 ? 'NL' : 'GR';
  const sessionId = `cs_test_persistence_validation_${index}`;

  try {
    const checkout = await createDurableHostedCheckoutSession({
      request: {
        items: [{
          page: product.page,
          quantity: 1,
          price: 0.01,
          name: 'Tampered browser product',
        }],
        countryCode: deliveryCountry,
        discountCode: 'LEGEND10',
      },
      customer: {
        firstname: 'Persistence',
        lastname: 'Validation',
        email: `persistence-${index}@example.com`,
        street: deliveryCountry === 'NL' ? 'Teststraat 10' : 'Ermou 10',
        zip: deliveryCountry === 'NL' ? '1234 AB' : '10563',
        city: deliveryCountry === 'NL' ? 'Amsterdam' : 'Athens',
        country: deliveryCountry,
      },
      catalogProducts: catalog,
      stripeClient: {
        mode: 'test',
        async createCheckoutSession() {
          return {
            id: sessionId,
            url: `https://checkout.stripe.com/c/pay/${sessionId}`,
            livemode: false,
          };
        },
      },
      checkoutStore: {
        async persistPendingCheckout(order) {
          storedOrder = order;
          return { created: true, order };
        },
      },
      successUrl: 'https://example.com/order-success.html',
      cancelUrl: 'https://example.com/order-cancelled.html',
      createdAt: 1_800_000_000 + index,
    });

    if (!storedOrder) {
      errors.push(`${product.page}: no pending order was stored.`);
      continue;
    }
    if (storedOrder.reference !== checkout.reference) {
      errors.push(`${product.page}: stored reference differs from Checkout reference.`);
    }
    if (storedOrder.paymentSessionId !== sessionId) {
      errors.push(`${product.page}: stored Checkout Session ID is incorrect.`);
    }
    if (storedOrder.status !== 'payment_pending') {
      errors.push(`${product.page}: stored order is not payment_pending.`);
    }
    if (storedOrder.amountTotal !== checkout.quote.grandTotal) {
      errors.push(`${product.page}: stored amount differs from Checkout amount.`);
    }
    if (storedOrder.items[0].name !== product.name
      || storedOrder.items[0].unitPrice !== product.price) {
      errors.push(`${product.page}: stored order trusted browser product data.`);
    }
    if (storedOrder.shipping.deliveryCountry !== deliveryCountry) {
      errors.push(`${product.page}: stored delivery country is incorrect.`);
    }
    if (checkout.reservationCreated !== true) {
      errors.push(`${product.page}: new Checkout was not marked as a new reservation.`);
    }
  } catch (error) {
    errors.push(`${product.page}: ${error.code || error.name}: ${error.message}`);
  }
}

let stripeCalledWithoutStore = false;
try {
  await createDurableHostedCheckoutSession({
    request: {
      items: [{ page: catalog[0].page, quantity: 1 }],
      countryCode: 'NL',
    },
    customer: {
      firstname: 'No',
      lastname: 'Store',
      email: 'no-store@example.com',
      street: 'Teststraat 10',
      zip: '1234 AB',
      city: 'Amsterdam',
      country: 'NL',
    },
    catalogProducts: catalog,
    stripeClient: {
      mode: 'test',
      async createCheckoutSession() {
        stripeCalledWithoutStore = true;
      },
    },
    successUrl: 'https://example.com/order-success.html',
    cancelUrl: 'https://example.com/order-cancelled.html',
  });
  errors.push('Checkout succeeded without a durable store.');
} catch (error) {
  if (error.code !== 'CHECKOUT_STORE_NOT_CONFIGURED') {
    errors.push(`Missing-store check failed with ${error.code || error.name}.`);
  }
}
if (stripeCalledWithoutStore) {
  errors.push('Stripe was contacted before durable storage was configured.');
}

if (errors.length) {
  console.error('Checkout persistence validation failed:');
  errors.forEach((error) => console.error(`- ${error}`));
  process.exit(1);
}

console.log(
  `Checkout persistence validation passed for ${catalog.length} products with authoritative pending-order records and fail-closed storage.`,
);
