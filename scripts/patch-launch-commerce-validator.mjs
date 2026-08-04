import { readFile, writeFile } from 'node:fs/promises';

async function patchCommerceRuntimeValidator() {
  const file = new URL('./validate-commerce-runtime.mjs', import.meta.url);
  let source = await readFile(file, 'utf8');

  const legacyCheck = `if (!/const product = \\{[\\s\\S]*?sizeCm: variant\\.sizeCm,/.test(source)) {
  errors.push('cart items must store the selected size for display and persistence.');
}`;

  const productionBoxCheck = `if (!/const product = \\{[\\s\\S]*?sizeCm: variant\\.longestSideCm,[\\s\\S]*?sizeLabel: variant\\.sizeLabel,[\\s\\S]*?widthCm: variant\\.widthCm,[\\s\\S]*?heightCm: variant\\.heightCm,/.test(source)) {
  errors.push('cart items must store the selected production box for display and persistence.');
}`;

  if (!source.includes(productionBoxCheck)) {
    if (!source.includes(legacyCheck)) {
      throw new Error('Commerce runtime size validation block was not found.');
    }
    source = source.replace(legacyCheck, productionBoxCheck);
    await writeFile(file, source, 'utf8');
  }
}

async function patchStripeCheckoutValidator() {
  const file = new URL('./validate-stripe-checkout.mjs', import.meta.url);
  let source = await readFile(file, 'utf8');

  const alternatingCountries = `  const deliveryCountry = index % 2 === 0 ? 'NL' : 'GR';
  const expectedShippingZoneCode = deliveryCountry === 'NL' ? 'NL' : 'OTHER';`;
  const validatedCountry = `  const deliveryCountry = 'NL';
  const expectedShippingZoneCode = 'NL';`;

  if (!source.includes(validatedCountry)) {
    if (!source.includes(alternatingCountries)) {
      throw new Error('Stripe validator delivery-country setup was not found.');
    }
    source = source.replace(alternatingCountries, validatedCountry);
  }

  const gatedMarketTest = `
try {
  const product = catalog[0];
  await createHostedCheckoutSession({
    request: {
      items: [{ page: product.page, variantId: 'statement-50x50', quantity: 1 }],
      countryCode: 'US',
      discountCode: '',
    },
    customer: validationCustomer('gated-market', 'US'),
    catalogProducts: catalog,
    stripeClient: {
      mode: 'test',
      async createCheckoutSession() {
        throw new Error('Stripe must not be called for a gated market.');
      },
    },
    successUrl: 'https://example.com/order-success.html',
    cancelUrl: 'https://example.com/order-cancelled.html',
  });
  errors.push('International market gate did not reject an unvalidated United States checkout.');
} catch (error) {
  if (error.code !== 'SHIPPING_COUNTRY_UNAVAILABLE') {
    errors.push(\`International market gate returned \${error.code || error.name}: \${error.message}\`);
  }
}
`;

  const insertionPoint = `
if (errors.length) {
  console.error('Stripe Checkout validation failed:');`;
  if (!source.includes('International market gate did not reject')) {
    if (!source.includes(insertionPoint)) {
      throw new Error('Stripe validator result block was not found.');
    }
    source = source.replace(insertionPoint, `${gatedMarketTest}${insertionPoint}`);
  }

  await writeFile(file, source, 'utf8');
}

await patchCommerceRuntimeValidator();
await patchStripeCheckoutValidator();
console.log('Launch commerce validators are aligned with production boxes and gated markets.');
