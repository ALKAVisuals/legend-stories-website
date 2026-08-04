import { readFile, writeFile } from 'node:fs/promises';

const changedFiles = [];

async function updateFile(path, transform) {
  const source = await readFile(path, 'utf8');
  const updated = transform(source);
  if (updated === source) return;
  await writeFile(path, updated, 'utf8');
  changedFiles.push(path);
}

function replaceRequired(source, from, to, label) {
  if (source.includes(to)) return source;
  if (!source.includes(from)) {
    throw new Error(`Unable to apply ${label}: expected source was not found.`);
  }
  return source.replace(from, to);
}

function replaceRequiredPattern(source, pattern, replacement, label) {
  if (!pattern.test(source)) {
    throw new Error(`Unable to apply ${label}: expected source pattern was not found.`);
  }
  return source.replace(pattern, replacement);
}

await updateFile('js/app.js', (source) => replaceRequiredPattern(
  source,
  /  const COUNTRY_OPTIONS = \[\n[\s\S]*?\n  \];/,
  `  const COUNTRY_OPTIONS = Object.freeze([\n    Object.freeze({ code: 'NL', flag: '🇳🇱', name: 'Netherlands' }),\n  ]);`,
  'NL-only country selector',
));

await updateFile('scripts/validate-commerce-runtime.mjs', (source) => {
  const oldContract = String.raw`if (!/const product = \{[\s\S]*?sizeCm: variant\.sizeCm,/.test(source)) {
  errors.push('cart items must store the selected size for display and persistence.');
}`;
  const newContract = String.raw`if (!/const product = \{[\s\S]*?sizeLabel: variant\.sizeLabel,/.test(source)
  || !/const product = \{[\s\S]*?widthCm: variant\.widthCm,/.test(source)
  || !/const product = \{[\s\S]*?heightCm: variant\.heightCm,/.test(source)) {
  errors.push('cart items must store the selected production box for display and persistence.');
}`;
  return replaceRequired(source, oldContract, newContract, 'cart production-box validator');
});

await updateFile('scripts/validate-stripe-checkout.mjs', (source) => {
  let updated = replaceRequired(
    source,
    "  const deliveryCountry = index % 2 === 0 ? 'NL' : 'GR';",
    "  const deliveryCountry = 'NL';",
    'NL-only Stripe validation country',
  );
  updated = replaceRequired(
    updated,
    "  const expectedShippingZoneCode = deliveryCountry === 'NL' ? 'NL' : 'OTHER';",
    "  const expectedShippingZoneCode = 'NL';",
    'NL-only Stripe validation zone',
  );
  return updated;
});

for (const path of [
  'tests/checkout-persistence.test.mjs',
  'tests/checkout-session-handler.test.mjs',
]) {
  await updateFile(path, (source) => replaceRequired(
    source,
    `const expectedProductName = defaultVariant?.sizeCm\n  ? \`\${product.name} — \${defaultVariant.sizeCm} cm\`\n  : product.name;`,
    `const expectedProductName = defaultVariant?.sizeLabel\n  ? \`\${product.name} — \${defaultVariant.label} (\${defaultVariant.sizeLabel})\`\n  : product.name;`,
    `${path} authoritative variant name`,
  ));
}

await updateFile('tests/order-quote.test.mjs', (source) => {
  let updated = replaceRequired(
    source,
    `const expectedFirstProductName = firstDefaultVariant?.sizeCm\n  ? \`\${firstProduct.name} — \${firstDefaultVariant.sizeCm} cm\`\n  : firstProduct.name;`,
    `const expectedFirstProductName = firstDefaultVariant?.sizeLabel\n  ? \`\${firstProduct.name} — \${firstDefaultVariant.label} (\${firstDefaultVariant.sizeLabel})\`\n  : firstProduct.name;`,
    'authoritative order product name',
  );
  const replacements = [
    ['assert.equal(quote.items[0].sizeCm, 45);', 'assert.equal(quote.items[0].sizeCm, 50);', 'statement longest side'],
    ['assert.equal(quote.totals.shipping, 3.95);', 'assert.equal(quote.totals.shipping, 4.95);', 'NL shipping price'],
    ['assert.equal(quote.totals.grandTotal, 48.95);', 'assert.equal(quote.totals.grandTotal, 49.95);', 'NL order total'],
    ['assert.equal(quote.amountInCents.grandTotal, 4895);', 'assert.equal(quote.amountInCents.grandTotal, 4995);', 'NL order cents'],
    ['assert.equal(quote.totals.grandTotal, 44.45);', 'assert.equal(quote.totals.grandTotal, 45.45);', 'discounted NL order total'],
    ['assert.equal(quote.amountInCents.grandTotal, 4445);', 'assert.equal(quote.amountInCents.grandTotal, 4545);', 'discounted NL order cents'],
    ["    countryCode: 'DE',", "    countryCode: 'NL',", 'duplicate-line NL market'],
  ];
  for (const [from, to, label] of replacements) {
    updated = replaceRequired(updated, from, to, label);
  }
  return updated;
});

await updateFile('tests/product-variants-contract.test.mjs', (source) => {
  let updated = replaceRequired(
    source,
    "test('product page defaults to the 45 cm statement variant', () => {",
    "test('product page defaults to the Statement 50 × 50 cm variant', () => {",
    'variant contract title',
  );
  updated = replaceRequired(
    updated,
    '  assert.match(templateSource, /measured along the longest side/i);',
    "  assert.match(templateSource, /Up to 50 × 50 cm/i);\n  assert.match(templateSource, /original proportions are preserved/i);",
    'production-box copy contract',
  );
  updated = replaceRequired(
    updated,
    "  assert.match(appSource, /CART_SCHEMA_VERSION = '3'/);",
    "  assert.match(appSource, /CART_SCHEMA_VERSION = '4'/);",
    'cart schema contract',
  );
  return updated;
});

await updateFile('tests/stripe-checkout-session.test.mjs', (source) => {
  const internationalPattern = /test\('rest-of-world countries retain their ISO delivery country in Stripe',[\s\S]*?\n\}\);\n\ntest\('identical checkout requests produce stable idempotency references'/;
  const internationalReplacement = `test('international checkout remains unavailable until a market is enabled', async () => {\n  const greekCustomer = {\n    ...customer,\n    street: 'Ermou 10',\n    zip: '10563',\n    city: 'Athens',\n    country: 'GR',\n  };\n\n  await assert.rejects(\n    () => createHostedCheckoutSession({\n      request: {\n        items: [{ page: firstProduct.page, quantity: 1 }],\n        countryCode: 'GR',\n      },\n      customer: greekCustomer,\n      catalogProducts: catalog,\n      stripeClient: createFakeStripeClient(),\n      successUrl: 'https://example.com/success',\n      cancelUrl: 'https://example.com/cancel',\n    }),\n    (error) => {\n      assert.equal(error.code, 'SHIPPING_COUNTRY_UNAVAILABLE');\n      return true;\n    },\n  );\n});\n\ntest('identical checkout requests produce stable idempotency references'`;
  let updated = replaceRequiredPattern(
    source,
    internationalPattern,
    internationalReplacement,
    'international checkout gate test',
  );

  const mismatchPattern = /test\('customer country must match the requested shipping country',[\s\S]*?\n\}\);\n\ntest\('test mode rejects live or unexpected Checkout Session responses'/;
  const mismatchReplacement = `test('customer country must match the requested shipping country', async () => {\n  await assert.rejects(\n    () => createHostedCheckoutSession({\n      request: {\n        items: [{ page: firstProduct.page, quantity: 1 }],\n        countryCode: 'NL',\n      },\n      customer: { ...customer, country: 'DE' },\n      catalogProducts: catalog,\n      stripeClient: createFakeStripeClient(),\n      successUrl: 'https://example.com/success',\n      cancelUrl: 'https://example.com/cancel',\n    }),\n    (error) => {\n      assert.ok(error instanceof CheckoutSessionError);\n      assert.equal(error.code, 'COUNTRY_MISMATCH');\n      return true;\n    },\n  );\n});\n\ntest('test mode rejects live or unexpected Checkout Session responses'`;
  updated = replaceRequiredPattern(
    updated,
    mismatchPattern,
    mismatchReplacement,
    'country mismatch test',
  );
  return updated;
});

console.log(`Applied launch commerce v2 fixes to ${changedFiles.length} file(s).`);
for (const path of changedFiles) console.log(`- ${path}`);
