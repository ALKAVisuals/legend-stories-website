import { readFile } from 'node:fs/promises';

import { createHostedCheckoutSession } from '../server/payments/checkout-session.mjs';

const catalog = JSON.parse(
  await readFile(new URL('../data/products/catalog.json', import.meta.url), 'utf8'),
).products;
const errors = [];

for (const [index, product] of catalog.entries()) {
  let capturedPayload = null;
  const stripeClient = {
    mode: 'test',
    async createCheckoutSession(payload, { idempotencyKey }) {
      capturedPayload = payload;
      if (!/^legend-checkout-[a-f0-9]{64}$/.test(idempotencyKey)) {
        throw new Error(`${product.page}: invalid idempotency key.`);
      }
      return {
        id: `cs_test_validation_${index}`,
        url: `https://checkout.stripe.com/c/pay/cs_test_validation_${index}`,
        livemode: false,
      };
    },
  };

  try {
    const checkout = await createHostedCheckoutSession({
      request: {
        items: [{
          page: product.page,
          quantity: 1,
          price: 0.01,
          name: 'Tampered browser product',
        }],
        countryCode: 'NL',
        discountCode: 'LEGEND10',
      },
      customer: {
        firstname: 'Validation',
        lastname: 'Buyer',
        email: `validation-${index}@example.com`,
        street: 'Teststraat 10',
        zip: '1234 AB',
        city: 'Amsterdam',
        country: 'NL',
      },
      catalogProducts: catalog,
      stripeClient,
      successUrl: 'https://example.com/order-success.html',
      cancelUrl: 'https://example.com/order-cancelled.html',
    });

    const stripeTotal = capturedPayload.line_items.reduce(
      (sum, item) => sum + item.price_data.unit_amount * item.quantity,
      0,
    );
    if (stripeTotal !== checkout.quote.grandTotal) {
      errors.push(`${product.page}: Stripe line items do not reconcile to the quote.`);
    }
    if (capturedPayload.line_items[0].price_data.product_data.name !== product.name) {
      errors.push(`${product.page}: Stripe trusted a browser-supplied product name.`);
    }
    if (checkout.mode !== 'test' || !checkout.sessionId.startsWith('cs_test_')) {
      errors.push(`${product.page}: Checkout validation did not remain in test mode.`);
    }
  } catch (error) {
    errors.push(`${product.page}: ${error.code || error.name}: ${error.message}`);
  }
}

if (errors.length) {
  console.error('Stripe Checkout validation failed:');
  errors.forEach((error) => console.error(`- ${error}`));
  process.exit(1);
}

console.log(
  `Stripe Checkout validation passed for ${catalog.length} products with test-only sessions and exact cent reconciliation.`,
);
