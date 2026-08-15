import { readFile } from 'node:fs/promises';

import { resolveCatalogProductVariant } from '../js/commerce/product-variants.mjs';
import { createDurableHostedCheckoutSession } from '../server/orders/checkout-persistence.mjs';

const catalog = JSON.parse(
  await readFile(new URL('../data/products/catalog.json', import.meta.url), 'utf8'),
).products;
const errors = [];

function expectedVariantName(product, variant) {
  return variant.id === 'legacy'
    ? product.name
    : `${product.name} — ${variant.label} (${variant.sizeLabel})`;
}

function preservesVariantIdentity(item, variant) {
  return item.variantId === variant.id
    && item.variantLabel === variant.label
    && item.sizeLabel === variant.sizeLabel
    && item.widthCm === variant.widthCm
    && item.heightCm === variant.heightCm
    && item.longestSideCm === variant.longestSideCm
    && item.sizeCm === variant.longestSideCm;
}

for (const [index, product] of catalog.entries()) {
  let storedOrder = null;
  const deliveryCountry = 'NL';
  const sessionId = `cs_test_persistence_validation_${index}`;
  const variantId = index % 2 === 0 ? 'statement-50x50' : 'compact-50x30';
  const variant = resolveCatalogProductVariant(product, variantId);

  try {
    const checkout = await createDurableHostedCheckoutSession({
      request: {
        items: [{
          page: product.page,
          variantId: variant.id,
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
        street: 'Teststraat 10',
        zip: '1234 AB',
        city: 'Amsterdam',
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

    const storedItem = storedOrder.items[0];
    if (storedItem.name !== expectedVariantName(product, variant)
      || storedItem.unitPrice !== variant.price) {
      errors.push(`${product.page}: stored order trusted browser product data.`);
    }
    if (!preservesVariantIdentity(storedItem, variant)) {
      errors.push(`${product.page}: stored order lost the selected production-box identity.`);
    }
    if (storedItem.sku !== `${product.slug}-${variant.skuSuffix}`) {
      errors.push(`${product.page}: stored order used the wrong variant SKU.`);
    }
    if (storedOrder.shipping.deliveryCountry !== deliveryCountry
      || storedOrder.shipping.zoneCode !== 'NL') {
      errors.push(`${product.page}: stored NL delivery information is incorrect.`);
    }
    if (checkout.reservationCreated !== true) {
      errors.push(`${product.page}: new Checkout was not marked as a new reservation.`);
    }
  } catch (error) {
    errors.push(`${product.page}: ${error.code || error.name}: ${error.message}`);
  }
}

try {
  const product = catalog[0];
  let storedOrder = null;
  // Keep legacy aliases as browser input so backwards compatibility is covered,
  // while persisted order identity must be canonical 30/45 cm.
  await createDurableHostedCheckoutSession({
    request: {
      items: [
        { page: product.page, variantId: 'compact-50x30', quantity: 1 },
        { page: product.page, variantId: 'statement-50x50', quantity: 1 },
      ],
      countryCode: 'NL',
      discountCode: 'LEGEND10',
    },
    customer: {
      firstname: 'Dual',
      lastname: 'Size',
      email: 'dual-size@example.com',
      street: 'Teststraat 10',
      zip: '1234 AB',
      city: 'Amsterdam',
      country: 'NL',
    },
    catalogProducts: catalog,
    stripeClient: {
      mode: 'test',
      async createCheckoutSession() {
        return {
          id: 'cs_test_persistence_dual_size',
          url: 'https://checkout.stripe.com/c/pay/cs_test_persistence_dual_size',
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
  });

  const variantIds = storedOrder?.items.map((item) => item.variantId).sort();
  if (JSON.stringify(variantIds) !== JSON.stringify(['compact-30', 'statement-45'])) {
    errors.push(`${product.page}: pending order did not preserve both canonical 30/45 cm sizes.`);
  }
  const sizeCms = storedOrder?.items.map((item) => item.sizeCm).sort((a, b) => a - b);
  if (JSON.stringify(sizeCms) !== JSON.stringify([30, 45])) {
    errors.push(`${product.page}: pending order did not persist exact 30/45 cm production sizes.`);
  }
  for (const item of storedOrder?.items || []) {
    const variant = resolveCatalogProductVariant(product, item.variantId);
    if (!preservesVariantIdentity(item, variant)) {
      errors.push(`${product.page}: dual-size pending order lost production-box metadata.`);
    }
  }
} catch (error) {
  errors.push(`Dual-size pending order: ${error.code || error.name}: ${error.message}`);
}

let stripeCalledWithoutStore = false;
try {
  await createDurableHostedCheckoutSession({
    request: {
      items: [{ page: catalog[0].page, variantId: 'statement-50x50', quantity: 1 }],
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
  `Checkout persistence validation passed for ${catalog.length} products and a dual-size order with canonical 30/45 cm production records, NL delivery data and fail-closed storage.`,
);
