import { readFile } from 'node:fs/promises';

import { resolveCatalogProductVariant } from '../js/commerce/product-variants.mjs';
import { createHostedCheckoutSession } from '../server/payments/checkout-session.mjs';

const catalog = JSON.parse(
  await readFile(new URL('../data/products/catalog.json', import.meta.url), 'utf8'),
).products;
const errors = [];

function validationCustomer(index, country) {
  return {
    firstname: 'Validation',
    lastname: 'Buyer',
    email: `validation-${index}@example.com`,
    street: country === 'NL' ? 'Teststraat 10' : 'Ermou 10',
    zip: country === 'NL' ? '1234 AB' : '10563',
    city: country === 'NL' ? 'Amsterdam' : 'Athens',
    country,
  };
}

function expectedVariantName(product, variant) {
  return variant.id === 'legacy'
    ? product.name
    : `${product.name} — ${variant.label} (${variant.sizeLabel})`;
}

function productLineItems(payload) {
  return payload.line_items.filter(
    (item) => item.price_data.product_data.metadata?.type !== 'shipping',
  );
}

for (const [index, product] of catalog.entries()) {
  let capturedPayload = null;
  const deliveryCountry = index % 2 === 0 ? 'NL' : 'GR';
  const expectedShippingZoneCode = deliveryCountry === 'NL' ? 'NL' : 'OTHER';
  const requestedVariantId = index % 2 === 0 ? 'statement-50x50' : 'compact-50x30';
  const variant = resolveCatalogProductVariant(product, requestedVariantId);
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
          variantId: variant.id,
          quantity: 1,
          price: 0.01,
          name: 'Tampered browser product',
        }],
        countryCode: deliveryCountry,
        discountCode: 'LEGEND10',
      },
      customer: validationCustomer(index, deliveryCountry),
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

    const [productLine] = productLineItems(capturedPayload);
    const metadata = productLine?.price_data.product_data.metadata || {};
    if (productLine?.price_data.product_data.name !== expectedVariantName(product, variant)) {
      errors.push(`${product.page}: Stripe trusted a browser-supplied product or variant name.`);
    }
    const expectedDiscountedUnitAmount = Math.round(variant.price * 100 * 0.9);
    if (productLine?.price_data.unit_amount !== expectedDiscountedUnitAmount) {
      errors.push(`${product.page}: Stripe did not use the authoritative ${variant.sizeCm} cm price.`);
    }
    if (metadata.page !== product.page || metadata.slug !== product.slug) {
      errors.push(`${product.page}: Stripe lost the authoritative product identity.`);
    }
    if (metadata.variant_id !== variant.id
      || metadata.size_label !== variant.sizeLabel
      || metadata.width_cm !== String(variant.widthCm)
      || metadata.height_cm !== String(variant.heightCm)) {
      errors.push(`${product.page}: Stripe lost the authoritative selected production box.`);
    }
    if (metadata.sku !== `${product.slug}-${variant.skuSuffix}`) {
      errors.push(`${product.page}: Stripe used the wrong variant SKU.`);
    }
    if (capturedPayload.metadata.delivery_country !== deliveryCountry) {
      errors.push(`${product.page}: Stripe lost the ISO delivery country.`);
    }
    if (capturedPayload.metadata.shipping_zone_code !== expectedShippingZoneCode) {
      errors.push(`${product.page}: Stripe used the wrong shipping zone code.`);
    }
    if (capturedPayload.payment_intent_data.shipping.address.country !== deliveryCountry) {
      errors.push(`${product.page}: Stripe shipping address used the wrong country.`);
    }
    if (checkout.mode !== 'test' || !checkout.sessionId.startsWith('cs_test_')) {
      errors.push(`${product.page}: Checkout validation did not remain in test mode.`);
    }
  } catch (error) {
    errors.push(`${product.page}: ${error.code || error.name}: ${error.message}`);
  }
}

try {
  const product = catalog[0];
  const captured = [];
  const idempotencyKeys = [];
  const stripeClient = {
    mode: 'test',
    async createCheckoutSession(payload, { idempotencyKey }) {
      captured.push(payload);
      idempotencyKeys.push(idempotencyKey);
      return {
        id: `cs_test_dual_variant_${captured.length}`,
        url: `https://checkout.stripe.com/c/pay/cs_test_dual_variant_${captured.length}`,
        livemode: false,
      };
    },
  };
  const customer = validationCustomer('dual', 'NL');
  const base = {
    customer,
    catalogProducts: catalog,
    stripeClient,
    successUrl: 'https://example.com/order-success.html',
    cancelUrl: 'https://example.com/order-cancelled.html',
  };

  await createHostedCheckoutSession({
    ...base,
    request: {
      items: [
        { page: product.page, variantId: 'compact-50x30', quantity: 1 },
        { page: product.page, variantId: 'statement-50x50', quantity: 1 },
      ],
      countryCode: 'NL',
      discountCode: 'LEGEND10',
    },
  });
  await createHostedCheckoutSession({
    ...base,
    request: {
      items: [{ page: product.page, variantId: 'compact-50x30', quantity: 1 }],
      countryCode: 'NL',
      discountCode: 'LEGEND10',
    },
  });

  const dualLines = productLineItems(captured[0]);
  if (dualLines.length !== 2) {
    errors.push(`${product.page}: Stripe merged the Compact and Statement variants into one line.`);
  } else {
    const byVariant = new Map(
      dualLines.map((line) => [line.price_data.product_data.metadata.variant_id, line]),
    );
    if (byVariant.get('compact-50x30')?.price_data.unit_amount !== 3150) {
      errors.push(`${product.page}: dual-variant checkout priced the Compact line incorrectly.`);
    }
    if (byVariant.get('statement-50x50')?.price_data.unit_amount !== 4050) {
      errors.push(`${product.page}: dual-variant checkout priced the Statement line incorrectly.`);
    }
  }
  if (idempotencyKeys[0] === idempotencyKeys[1]) {
    errors.push(`${product.page}: checkout reference does not distinguish selected variants.`);
  }
} catch (error) {
  errors.push(`Dual-variant Stripe checkout: ${error.code || error.name}: ${error.message}`);
}

if (errors.length) {
  console.error('Stripe Checkout validation failed:');
  errors.forEach((error) => console.error(`- ${error}`));
  process.exit(1);
}

console.log(
  `Stripe Checkout validation passed for ${catalog.length} products and a dual-size cart with authoritative names, prices, SKUs, metadata, variant-aware references, test-only sessions and exact cent reconciliation.`,
);
