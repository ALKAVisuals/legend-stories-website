import { readFile, readdir, writeFile } from 'node:fs/promises';
import { extname, join } from 'node:path';

const ROOT = process.cwd();

async function walkFiles(directory) {
  const output = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (['node_modules', '.git', 'dist'].includes(entry.name)) continue;
    const path = join(directory, entry.name);
    if (entry.isDirectory()) output.push(...await walkFiles(path));
    else if (extname(entry.name) === '.mjs') output.push(path);
  }
  return output;
}

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

async function patchSuccessfulOrderMutationTest() {
  const title = 'successful checkout forwards Stripe shipping details into the canonical order';
  const files = await walkFiles(ROOT);
  const matchingFiles = [];

  for (const file of files) {
    const source = await readFile(file, 'utf8');
    if (source.includes(title)) matchingFiles.push({ file, source });
  }

  if (matchingFiles.length !== 1) {
    throw new Error(`Expected exactly one successful order mutation test, found ${matchingFiles.length}.`);
  }

  const { file } = matchingFiles[0];
  let { source } = matchingFiles[0];
  const titleIndex = source.indexOf(title);
  const testStartCandidates = [
    source.lastIndexOf('test(', titleIndex),
    source.lastIndexOf('it(', titleIndex),
  ].filter((index) => index >= 0);
  const blockStart = testStartCandidates.length ? Math.max(...testStartCandidates) : -1;
  const remainder = source.slice(titleIndex + title.length);
  const nextTestMatch = remainder.match(/\n\s*(?:test|it)\s*\(/);
  const blockEnd = nextTestMatch
    ? titleIndex + title.length + nextTestMatch.index
    : source.length;

  if (blockStart < 0 || blockEnd <= blockStart) {
    throw new Error('Could not isolate the successful order mutation test block.');
  }

  const originalBlock = source.slice(blockStart, blockEnd);
  const patchedBlock = originalBlock
    .replace(/(countryCode\s*:\s*['"])[A-Z]{2}(['"])/g, '$1NL$2')
    .replace(/(country\s*:\s*['"])[A-Z]{2}(['"])/g, '$1NL$2')
    .replace(/(country_code\s*:\s*['"])[A-Z]{2}(['"])/g, '$1NL$2')
    .replace(/(['"])GR\1/g, '$1NL$1')
    .replace(/(['"])Greece\1/g, '$1Netherlands$1');

  if (patchedBlock === originalBlock) {
    if (!/(countryCode|country|country_code)\s*:\s*['"]NL['"]/.test(originalBlock)
      || /(['"])(?:GR|Greece)\1/.test(originalBlock)) {
      throw new Error('The successful order mutation test contains no patchable delivery country.');
    }
    return;
  }

  source = `${source.slice(0, blockStart)}${patchedBlock}${source.slice(blockEnd)}`;
  await writeFile(file, source, 'utf8');
}

await patchCommerceRuntimeValidator();
await patchStripeCheckoutValidator();
await patchSuccessfulOrderMutationTest();
console.log('Launch commerce validators and order mutation fixtures are aligned with production boxes and gated markets.');
