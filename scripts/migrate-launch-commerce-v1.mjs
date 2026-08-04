import { createHash } from 'node:crypto';
import { readFile, readdir, writeFile } from 'node:fs/promises';
import { extname, join } from 'node:path';

const ROOT = process.cwd();
const changes = [];

const CANONICAL_VARIANTS = Object.freeze([
  Object.freeze({
    id: 'statement-50x50',
    label: 'Statement',
    sizeLabel: '50 × 50 cm',
    widthCm: 50,
    heightCm: 50,
    longestSideCm: 50,
    sizeCm: 50,
    price: 45,
    skuSuffix: '50x50',
    isDefault: true,
  }),
  Object.freeze({
    id: 'compact-50x30',
    label: 'Compact',
    sizeLabel: '50 × 30 cm',
    widthCm: 50,
    heightCm: 30,
    longestSideCm: 50,
    sizeCm: 50,
    price: 35,
    skuSuffix: '50x30',
    isDefault: false,
  }),
]);

function lines(values) {
  return `${values.join('\n')}\n`;
}

async function readText(relativePath) {
  return readFile(join(ROOT, relativePath), 'utf8');
}

async function writeIfChanged(relativePath, content) {
  const path = join(ROOT, relativePath);
  const previous = await readFile(path, 'utf8').catch(() => null);
  if (previous === content) return false;
  await writeFile(path, content, 'utf8');
  changes.push(relativePath);
  return true;
}

function replaceOrAlready(source, oldValue, newValue, label) {
  if (source.includes(newValue)) return source;
  if (!source.includes(oldValue)) {
    throw new Error(`${label}: neither the legacy nor migrated text was found.`);
  }
  return source.replace(oldValue, newValue);
}

function replaceRegexOrAlready(source, pattern, replacement, alreadyPattern, label) {
  if (alreadyPattern?.test(source)) return source;
  pattern.lastIndex = 0;
  if (!pattern.test(source)) throw new Error(`${label}: legacy pattern was not found.`);
  pattern.lastIndex = 0;
  return source.replace(pattern, replacement);
}

function migrateIds(source) {
  return String(source)
    .replaceAll('statement-45', 'statement-50x50')
    .replaceAll('compact-30', 'compact-50x30');
}

function migrateDescription(value = '') {
  return String(value)
    .replace(
      /Available in 30 cm and 45 cm, measured along the longest side\./gi,
      'Available in Compact (up to 50 × 30 cm) and Statement (up to 50 × 50 cm). Original proportions are preserved.',
    )
    .replace(
      /Available in 30 cm and 45 cm\./gi,
      'Available in Compact (up to 50 × 30 cm) and Statement (up to 50 × 50 cm).',
    );
}

function migrateProductMarkup(source) {
  let html = migrateIds(migrateDescription(source));
  html = html
    .replaceAll('30 cm · subtle wall accent', 'Up to 50 × 30 cm · subtle wall accent')
    .replaceAll('45 cm · maximum visual impact', 'Up to 50 × 50 cm · maximum visual impact')
    .replaceAll(
      'Size is measured along the longest side. The original proportions of the design are preserved.',
      'Each design is scaled to fit within the selected production area. Original proportions are always preserved.',
    )
    .replaceAll('Statement · 45 cm', 'Statement · 50 × 50 cm')
    .replaceAll('Compact · 30 cm', 'Compact · 50 × 30 cm')
    .replaceAll('30 cm or 45 cm · longest side', 'Up to 50 × 30 cm or 50 × 50 cm')
    .replaceAll(
      'data-size-cm="45"',
      'data-size-label="50 × 50 cm" data-width-cm="50" data-height-cm="50" data-longest-side-cm="50"',
    )
    .replaceAll(
      'data-size-cm="30"',
      'data-size-label="50 × 30 cm" data-width-cm="50" data-height-cm="30" data-longest-side-cm="50"',
    );
  return html;
}

async function walkFiles(relativeDirectory, predicate) {
  const output = [];
  const directory = join(ROOT, relativeDirectory);
  const entries = await readdir(directory, { withFileTypes: true }).catch(() => []);
  for (const entry of entries) {
    const relativePath = join(relativeDirectory, entry.name);
    if (entry.isDirectory()) {
      if (['node_modules', '.git', 'dist'].includes(entry.name)) continue;
      output.push(...await walkFiles(relativePath, predicate));
    } else if (predicate(relativePath)) {
      output.push(relativePath);
    }
  }
  return output;
}

async function migrateCatalog() {
  const relativePath = join('data', 'products', 'catalog.json');
  const catalog = JSON.parse(await readText(relativePath));
  catalog.schemaVersion = 3;
  catalog.variantPolicy = {
    defaultVariantId: 'statement-50x50',
    sizingModel: 'fit_within_production_box',
    sizeMeasurement: 'production_box',
    aspectRatio: 'preserved',
    variants: CANONICAL_VARIANTS,
  };
  catalog.products = (catalog.products || []).map((product) => ({
    ...product,
    description: migrateDescription(product.description),
    price: 45,
    fromPrice: 35,
    defaultVariantId: 'statement-50x50',
    variants: CANONICAL_VARIANTS,
  }));
  catalog.productCount = catalog.products.length;
  await writeIfChanged(relativePath, `${JSON.stringify(catalog, null, 2)}\n`);
}

async function migrateTemplateAndStaticPages() {
  const templatePath = join('templates', 'product-page.html');
  const template = migrateProductMarkup(await readText(templatePath));
  await writeIfChanged(templatePath, template);

  const rootFiles = (await readdir(ROOT, { withFileTypes: true }))
    .filter((entry) => entry.isFile() && entry.name.endsWith('.html'))
    .map((entry) => entry.name);
  for (const file of rootFiles) {
    const source = await readText(file);
    await writeIfChanged(file, migrateProductMarkup(source));
  }

  const hash = createHash('sha256').update(template).digest('hex');
  const presentationFiles = (await readdir(join(ROOT, 'data', 'products')))
    .filter((file) => /^2026-batch-\d+-presentation\.json$/.test(file));
  for (const file of presentationFiles) {
    const relativePath = join('data', 'products', file);
    const data = JSON.parse(await readText(relativePath));
    data.template = { ...(data.template || {}), sha256: hash };
    await writeIfChanged(relativePath, `${JSON.stringify(data, null, 2)}\n`);
  }
}

async function migrateRepositoryIds() {
  const directories = ['js', 'server', 'scripts', 'tests'];
  const extensions = new Set(['.js', '.mjs', '.json', '.md']);
  for (const directory of directories) {
    const files = await walkFiles(directory, (path) => extensions.has(extname(path)));
    for (const file of files) {
      const source = await readText(file);
      await writeIfChanged(file, migrateIds(source));
    }
  }
}

async function writeCommerceModules() {
  await writeIfChanged('js/commerce/product-variants.mjs', lines([
    "export const DEFAULT_PRODUCT_VARIANT_ID = 'statement-50x50';",
    '',
    'export const PRODUCT_VARIANTS = Object.freeze([',
    '  Object.freeze({',
    "    id: 'statement-50x50',",
    "    label: 'Statement',",
    "    sizeLabel: '50 × 50 cm',",
    '    widthCm: 50,',
    '    heightCm: 50,',
    '    longestSideCm: 50,',
    '    sizeCm: 50,',
    '    price: 45,',
    "    skuSuffix: '50x50',",
    '    isDefault: true,',
    '  }),',
    '  Object.freeze({',
    "    id: 'compact-50x30',",
    "    label: 'Compact',",
    "    sizeLabel: '50 × 30 cm',",
    '    widthCm: 50,',
    '    heightCm: 30,',
    '    longestSideCm: 50,',
    '    sizeCm: 50,',
    '    price: 35,',
    "    skuSuffix: '50x30',",
    '    isDefault: false,',
    '  }),',
    ']);',
    '',
    'const LEGACY_VARIANT_ALIASES = Object.freeze({',
    "  'statement-45': 'statement-50x50',",
    "  'compact-30': 'compact-50x30',",
    '});',
    '',
    "function normalizeVariantId(value = '') {",
    '  const normalized = String(value).trim().toLowerCase();',
    '  return LEGACY_VARIANT_ALIASES[normalized] || normalized;',
    '}',
    '',
    'function normalizeMoney(value) {',
    '  const amount = Number(value);',
    '  return Number.isFinite(amount) ? Math.round((amount + Number.EPSILON) * 100) / 100 : NaN;',
    '}',
    '',
    'function normalizeVariant(entry = {}) {',
    '  const id = normalizeVariantId(entry.id);',
    '  const canonical = PRODUCT_VARIANTS.find((variant) => variant.id === id);',
    '  const source = canonical || entry;',
    '  const price = normalizeMoney(source.price);',
    '  const widthCm = Number(source.widthCm);',
    '  const heightCm = Number(source.heightCm);',
    '  const longestSideCm = Number(source.longestSideCm || Math.max(widthCm, heightCm));',
    '  const sizeLabel = String(source.sizeLabel || `${widthCm} × ${heightCm} cm`);',
    '  if (!id || !source.label || !Number.isFinite(price) || price < 0',
    '    || !Number.isFinite(widthCm) || widthCm <= 0',
    '    || !Number.isFinite(heightCm) || heightCm <= 0',
    '    || !Number.isFinite(longestSideCm) || longestSideCm <= 0) {',
    "    throw new Error(`Invalid product variant configuration: ${id || '(missing id)'}.`);",
    '  }',
    '  return Object.freeze({',
    '    id,',
    '    label: String(source.label),',
    '    sizeLabel,',
    '    widthCm,',
    '    heightCm,',
    '    longestSideCm,',
    '    sizeCm: longestSideCm,',
    '    price,',
    '    skuSuffix: String(source.skuSuffix || `${widthCm}x${heightCm}`),',
    '    isDefault: Boolean(source.isDefault),',
    '  });',
    '}',
    '',
    'export function resolveProductVariant(variantId = DEFAULT_PRODUCT_VARIANT_ID, variants = PRODUCT_VARIANTS) {',
    '  if (!Array.isArray(variants) || variants.length === 0) {',
    "    throw new Error('Product variants are unavailable.');",
    '  }',
    '  const requested = normalizeVariantId(variantId || DEFAULT_PRODUCT_VARIANT_ID);',
    '  const configured = variants.find((entry) => normalizeVariantId(entry?.id) === requested);',
    '  const canonical = PRODUCT_VARIANTS.find((entry) => entry.id === requested);',
    '  if (!configured && !canonical) {',
    "    throw new Error(`Unknown product variant: ${variantId || '(empty)'}.`);",
    '  }',
    '  return normalizeVariant(canonical || configured);',
    '}',
    '',
    'export function resolveCatalogProductVariant(product = {}, variantId = "") {',
    '  if (!Array.isArray(product.variants) || product.variants.length === 0) {',
    '    if (Number.isFinite(Number(product.price))) {',
    '      return Object.freeze({',
    "        id: 'legacy', label: 'Standard', sizeLabel: '', widthCm: 1, heightCm: 1,",
    '        longestSideCm: 1, sizeCm: 1, price: Number(product.price),',
    "        skuSuffix: 'standard', isDefault: true,",
    '      });',
    '    }',
    "    throw new Error('Product variants are unavailable.');",
    '  }',
    '  const fallbackId = product.defaultVariantId',
    '    || product.variants.find((entry) => entry?.isDefault)?.id',
    '    || DEFAULT_PRODUCT_VARIANT_ID;',
    '  return resolveProductVariant(variantId || fallbackId, product.variants);',
    '}',
    '',
    'export function createCartLineId(page, variantId) {',
    '  const normalizedPage = String(page || "").trim();',
    '  const normalizedVariant = normalizeVariantId(variantId);',
    '  if (!normalizedPage || !normalizedVariant) {',
    "    throw new Error('Cart line identity requires a product page and variant.');",
    '  }',
    '  return `${normalizedPage}::${normalizedVariant}`;',
    '}',
    '',
    'export function createProductSku(product = {}, variant = {}) {',
    '  const slug = String(product.slug || "").trim();',
    '  const suffix = String(variant.skuSuffix || "").trim();',
    "  if (!slug || !suffix) throw new Error('Product SKU requires a slug and variant suffix.');",
    '  return `${slug}-${suffix}`;',
    '}',
  ]));

  await writeIfChanged('js/commerce/shipping.mjs', lines([
    'export const SHIPPING_ZONES = Object.freeze({',
    "  NL: Object.freeze({ name: 'Netherlands', cost: 4.95, freeFrom: 69, enabled: true }),",
    "  OTHER: Object.freeze({ name: 'Unavailable market', cost: 0, freeFrom: Number.POSITIVE_INFINITY, enabled: false }),",
    '});',
    '',
    'export function getShippingZone(countryCode) {',
    '  return SHIPPING_ZONES[countryCode] || SHIPPING_ZONES.OTHER;',
    '}',
    '',
    'export function isShippingCountryEnabled(countryCode) {',
    '  return Boolean(getShippingZone(countryCode).enabled);',
    '}',
    '',
    "export function calculateShipping({ countryCode = 'NL', subtotal = 0, hasItems = true } = {}) {",
    '  if (!hasItems) return 0;',
    '  const zone = getShippingZone(countryCode);',
    '  if (!zone.enabled) {',
    "    throw new Error(`Shipping is not enabled for ${countryCode || 'this market'}.`);",
    '  }',
    '  const safeSubtotal = Math.max(0, Number(subtotal) || 0);',
    '  return safeSubtotal >= zone.freeFrom ? 0 : zone.cost;',
    '}',
  ]));

  await writeIfChanged('js/commerce/discounts.mjs', lines([
    'export const DISCOUNT_CODES = Object.freeze({',
    '  LEGEND10: 10,',
    '});',
    '',
    "export function normalizeDiscountCode(code = '') {",
    '  return String(code).trim().toUpperCase();',
    '}',
    '',
    "export function resolveDiscount(code = '') {",
    '  const normalizedCode = normalizeDiscountCode(code);',
    '  const percent = DISCOUNT_CODES[normalizedCode] || 0;',
    '  return Object.freeze({',
    "    code: percent > 0 ? normalizedCode : '',",
    '    percent,',
    '    valid: percent > 0,',
    '  });',
    '}',
  ]));
}

async function migrateApp() {
  let app = await readText('js/app.js');
  app = migrateIds(app);
  app = replaceOrAlready(app, "const CART_SCHEMA_VERSION = '3';", "const CART_SCHEMA_VERSION = '4';", 'cart schema');
  app = replaceRegexOrAlready(
    app,
    /  const COUNTRY_OPTIONS = \[[\s\S]*?\n  \];/,
    "  const COUNTRY_OPTIONS = [\n    { code: 'NL', flag: '🇳🇱', name: 'Netherlands' },\n  ];",
    /const COUNTRY_OPTIONS = \[\n\s*\{ code: 'NL'[\s\S]*?\n\s*\];/,
    'country options',
  );
  app = replaceOrAlready(
    app,
    "    if (savedCountry) {\n      state.shippingCountry = savedCountry;\n    }",
    "    if (savedCountry === 'NL') {\n      state.shippingCountry = 'NL';\n    } else {\n      state.shippingCountry = 'NL';\n      localStorage.removeItem('legendShippingCountry');\n    }",
    'saved shipping country',
  );
  app = replaceOrAlready(
    app,
    "      variantLabel: variant.label,\n      sizeCm: variant.sizeCm,",
    "      variantLabel: variant.label,\n      sizeCm: variant.longestSideCm,\n      sizeLabel: variant.sizeLabel,\n      widthCm: variant.widthCm,\n      heightCm: variant.heightCm,",
    'cart variant dimensions',
  );
  app = replaceOrAlready(
    app,
    "        variantLabel: item.variantLabel,\n        sizeCm: item.sizeCm,",
    "        variantLabel: item.variantLabel,\n        sizeCm: item.sizeCm,\n        sizeLabel: item.sizeLabel,\n        widthCm: item.widthCm,\n        heightCm: item.heightCm,",
    'order display dimensions',
  );
  app = replaceOrAlready(
    app,
    "        addButton.dataset.sizeCm = String(variant.sizeCm);\n        addButton.dataset.variantLabel = variant.label;",
    "        addButton.dataset.sizeCm = String(variant.longestSideCm);\n        addButton.dataset.sizeLabel = variant.sizeLabel;\n        addButton.dataset.widthCm = String(variant.widthCm);\n        addButton.dataset.heightCm = String(variant.heightCm);\n        addButton.dataset.variantLabel = variant.label;",
    'variant button dimensions',
  );
  app = replaceOrAlready(
    app,
    "        if (sizeOutput) sizeOutput.textContent = variant.label + ' · ' + variant.sizeCm + ' cm';",
    "        if (sizeOutput) sizeOutput.textContent = variant.label + ' · ' + variant.sizeLabel;",
    'selected size output',
  );
  app = app.replaceAll(
    'Free shipping available from €50+ (NL) / €75+ (EU) / €150+ (World)',
    'Netherlands shipping is €4,95 and free from €69. International checkout opens per validated market.',
  );
  await writeIfChanged('js/app.js', app);
}

async function migrateCartControls() {
  let source = await readText('js/cart-controls.mjs');
  source = replaceOrAlready(
    source,
    "  const variantText = item.sizeCm\n    ? `${item.sizeCm} cm${item.variantLabel ? ` · ${item.variantLabel}` : ''}`\n    : '';",
    "  const variantText = item.sizeLabel\n    ? `${item.variantLabel || 'Size'} · ${item.sizeLabel}`\n    : (item.sizeCm ? `${item.sizeCm} cm${item.variantLabel ? ` · ${item.variantLabel}` : ''}` : '');",
    'cart variant label',
  );
  await writeIfChanged('js/cart-controls.mjs', source);
}

async function migrateOrderQuote() {
  let source = migrateIds(await readText('server/commerce/order-quote.mjs'));
  source = replaceOrAlready(
    source,
    "import { calculateCommerceTotals } from '../../js/commerce/totals.mjs';",
    "import { calculateCommerceTotals } from '../../js/commerce/totals.mjs';\nimport { getShippingZone } from '../../js/commerce/shipping.mjs';",
    'order quote shipping import',
  );
  source = replaceOrAlready(
    source,
    "      const displayName = variant.id === 'legacy'\n        ? product.name\n        : `${product.name} — ${variant.sizeCm} cm`;",
    "      const displayName = variant.id === 'legacy'\n        ? product.name\n        : `${product.name} — ${variant.label} (${variant.sizeLabel})`;",
    'order display name',
  );
  source = replaceOrAlready(
    source,
    "        variantLabel: variant.label,\n        sizeCm: variant.sizeCm,",
    "        variantLabel: variant.label,\n        sizeLabel: variant.sizeLabel,\n        widthCm: variant.widthCm,\n        heightCm: variant.heightCm,\n        longestSideCm: variant.longestSideCm,\n        sizeCm: variant.longestSideCm,",
    'order quote dimensions',
  );
  source = replaceOrAlready(
    source,
    "  const totals = calculateCommerceTotals({\n    items: authoritativeItems.map((item) => ({ price: item.unitPrice, quantity: item.quantity })),\n    countryCode: String(payload?.countryCode || 'NL').trim().toUpperCase(),",
    "  const requestedCountryCode = String(payload?.countryCode || 'NL').trim().toUpperCase();\n  const requestedZone = getShippingZone(requestedCountryCode);\n  if (!requestedZone.enabled) {\n    fail('SHIPPING_COUNTRY_UNAVAILABLE', 'Checkout is not enabled for this delivery country yet.', {\n      countryCode: requestedCountryCode,\n    });\n  }\n\n  const totals = calculateCommerceTotals({\n    items: authoritativeItems.map((item) => ({ price: item.unitPrice, quantity: item.quantity })),\n    countryCode: requestedCountryCode,",
    'order quote shipping gate',
  );
  await writeIfChanged('server/commerce/order-quote.mjs', source);
}

async function migrateCheckoutSession() {
  let source = await readText('server/payments/checkout-session.mjs');
  source = replaceOrAlready(
    source,
    "function productDescription(item) {\n  const parts = [];\n  if (item.sizeCm) parts.push(`Size: ${item.sizeCm} cm`);\n  parts.push(`Quantity: ${item.quantity}`);\n  return parts.join(' · ');\n}",
    "function productDescription(item) {\n  const parts = [];\n  if (item.sizeLabel) parts.push(`Size: ${item.sizeLabel}`);\n  parts.push(`Quantity: ${item.quantity}`);\n  return parts.join(' · ');\n}",
    'Stripe product description',
  );
  source = replaceOrAlready(
    source,
    "            variant_label: item.variantLabel || 'Standard',\n            size_cm: item.sizeCm ? String(item.sizeCm) : 'legacy',",
    "            variant_label: item.variantLabel || 'Standard',\n            size_label: item.sizeLabel || 'legacy',\n            width_cm: item.widthCm ? String(item.widthCm) : 'legacy',\n            height_cm: item.heightCm ? String(item.heightCm) : 'legacy',\n            longest_side_cm: item.longestSideCm ? String(item.longestSideCm) : 'legacy',\n            size_cm: item.longestSideCm ? String(item.longestSideCm) : 'legacy',",
    'Stripe size metadata',
  );
  source = replaceOrAlready(
    source,
    "      variantLabel: item.variantLabel,\n      sizeCm: item.sizeCm,",
    "      variantLabel: item.variantLabel,\n      sizeLabel: item.sizeLabel,\n      widthCm: item.widthCm,\n      heightCm: item.heightCm,\n      longestSideCm: item.longestSideCm,",
    'checkout reference dimensions',
  );
  await writeIfChanged('server/payments/checkout-session.mjs', source);
}

async function migrateProductPageGeneration() {
  let source = migrateIds(await readText('scripts/product-page-generation.mjs'));
  source = replaceRegexOrAlready(
    source,
    /function structuredData\(product\) \{[\s\S]*?\n\}\n\nexport function extractProductPresentation/,
    `function structuredData(product) {\n  const variants = Array.isArray(product.variants) && product.variants.length\n    ? product.variants\n    : [{ id: 'legacy', label: 'Standard', sizeLabel: '', widthCm: 1, heightCm: 1, longestSideCm: 1, price: product.price, skuSuffix: 'standard', isDefault: true }];\n  const orderedVariants = [...variants].sort((left, right) => Number(Boolean(right.isDefault)) - Number(Boolean(left.isDefault)));\n  return JSON.stringify({\n    '@context': 'https://schema.org/',\n    '@type': 'Product',\n    name: product.name,\n    image: absoluteImageUrl(product),\n    description: product.description,\n    brand: { '@type': 'Brand', name: 'Legend Stories' },\n    offers: orderedVariants.map((variant) => ({\n      '@type': 'Offer',\n      name: variant.id === 'legacy' ? product.name : \`${'${product.name}'} — ${'${variant.label}'} (${'${variant.sizeLabel}'})\`,\n      sku: \`${'${product.slug}'}-${'${variant.skuSuffix || variant.id || \'standard\'}'}\`,\n      price: Number(variant.price).toFixed(2),\n      priceCurrency: product.currency || 'EUR',\n      availability: product.availability,\n      url: variant.id === 'legacy' ? product.canonical : \`${'${product.canonical}'}?variant=${'${encodeURIComponent(variant.id)}'}\`,\n    })),\n  }, null, 2).replaceAll('<', '\\\\u003c');\n}\n\nexport function extractProductPresentation`,
    /variant\.sizeLabel[\s\S]*?encodeURIComponent\(variant\.id\)/,
    'structured product variants',
  );
  source = source
    .replaceAll('data-size-cm="45"', 'data-size-label="50 × 50 cm" data-width-cm="50" data-height-cm="50" data-longest-side-cm="50"')
    .replaceAll('data-size-cm=\\"45\\"', 'data-size-label=\\"50 × 50 cm\\" data-width-cm=\\"50\\" data-height-cm=\\"50\\" data-longest-side-cm=\\"50\\"');
  await writeIfChanged('scripts/product-page-generation.mjs', source);
}

async function writeCatalogGenerator() {
  await writeIfChanged('scripts/generate-full-product-catalog.mjs', lines([
    "import { mkdir, writeFile } from 'node:fs/promises';",
    "import { dirname, join } from 'node:path';",
    "import { buildProductInventory } from './product-inventory.mjs';",
    "import { DEFAULT_PRODUCT_VARIANT_ID, PRODUCT_VARIANTS } from '../js/commerce/product-variants.mjs';",
    '',
    'const ROOT = process.cwd();',
    "const OUTPUT = join(ROOT, 'data', 'products', 'catalog.json');",
    '',
    'function toCatalogProduct(product) {',
    '  return {',
    '    slug: product.slug, page: product.page, name: product.name,',
    '    description: product.description, image: product.image, price: 45,',
    "    currency: product.currency || 'EUR', availability: product.availability, canonical: product.canonical,",
    '    batch: { id: product.batchId, year: product.batchYear, number: product.batchNumber },',
    '    collection: product.collection, category: product.category, fromPrice: 35,',
    '    defaultVariantId: DEFAULT_PRODUCT_VARIANT_ID, variants: PRODUCT_VARIANTS,',
    '  };',
    '}',
    '',
    'const inventory = await buildProductInventory(ROOT);',
    'if (inventory.summary.errors > 0 || inventory.summary.productPages === 0) {',
    '  throw new Error(`Cannot generate catalog from invalid inventory (${inventory.summary.errors} errors).`);',
    '}',
    'const products = inventory.products.map(toCatalogProduct).sort((a, b) => a.page.localeCompare(b.page));',
    'const catalog = {',
    '  schemaVersion: 3,',
    '  productCount: products.length,',
    '  variantPolicy: {',
    '    defaultVariantId: DEFAULT_PRODUCT_VARIANT_ID,',
    "    sizingModel: 'fit_within_production_box',",
    "    sizeMeasurement: 'production_box',",
    "    aspectRatio: 'preserved',",
    '    variants: PRODUCT_VARIANTS,',
    '  },',
    '  products,',
    '};',
    'await mkdir(dirname(OUTPUT), { recursive: true });',
    'await writeFile(OUTPUT, `${JSON.stringify(catalog, null, 2)}\\n`, "utf8");',
    'console.log(`Generated central product catalog with ${products.length} products.`);',
  ]));
}

async function writeValidationFiles() {
  await writeIfChanged('tests/product-variants.test.mjs', lines([
    "import assert from 'node:assert/strict';",
    "import test from 'node:test';",
    "import { createCartLineId, createProductSku, DEFAULT_PRODUCT_VARIANT_ID, PRODUCT_VARIANTS, resolveCatalogProductVariant, resolveProductVariant } from '../js/commerce/product-variants.mjs';",
    '',
    "test('product variant policy exposes the approved production boxes and prices', () => {",
    "  assert.equal(DEFAULT_PRODUCT_VARIANT_ID, 'statement-50x50');",
    '  assert.deepEqual(',
    '    PRODUCT_VARIANTS.map(({ id, sizeLabel, widthCm, heightCm, price, isDefault }) => ({ id, sizeLabel, widthCm, heightCm, price, isDefault })),',
    '    [',
    "      { id: 'statement-50x50', sizeLabel: '50 × 50 cm', widthCm: 50, heightCm: 50, price: 45, isDefault: true },",
    "      { id: 'compact-50x30', sizeLabel: '50 × 30 cm', widthCm: 50, heightCm: 30, price: 35, isDefault: false },",
    '    ],',
    '  );',
    '});',
    '',
    "test('variant resolution supports current ids and safely migrates old ids', () => {",
    "  assert.equal(resolveProductVariant('compact-50x30').price, 35);",
    "  assert.equal(resolveProductVariant('statement-50x50').price, 45);",
    "  assert.equal(resolveProductVariant('compact-30').id, 'compact-50x30');",
    "  assert.equal(resolveProductVariant('statement-45').id, 'statement-50x50');",
    "  assert.throws(() => resolveProductVariant('giant-90'), /Unknown product variant/);",
    '});',
    '',
    "test('catalog variants control authoritative pricing and sku creation', () => {",
    "  const product = { slug: 'legend-example', price: 999, defaultVariantId: 'statement-50x50', variants: PRODUCT_VARIANTS };",
    "  const compact = resolveCatalogProductVariant(product, 'compact-50x30');",
    '  assert.equal(compact.price, 35);',
    "  assert.equal(createProductSku(product, compact), 'legend-example-50x30');",
    "  assert.equal(createCartLineId('legend-example.html', compact.id), 'legend-example.html::compact-50x30');",
    '});',
    '',
    "test('legacy catalog fixtures remain quote-compatible', () => {",
    '  const legacy = resolveCatalogProductVariant({ price: 49.95 });',
    "  assert.equal(legacy.id, 'legacy');",
    '  assert.equal(legacy.price, 49.95);',
    '});',
  ]));

  await writeIfChanged('tests/commerce.test.mjs', lines([
    "import test from 'node:test';",
    "import assert from 'node:assert/strict';",
    "import { calculateDiscount, calculateGrandTotal, calculateSubtotal, roundMoney } from '../js/commerce/pricing.mjs';",
    "import { calculateShipping, getShippingZone, SHIPPING_ZONES } from '../js/commerce/shipping.mjs';",
    "import { calculateCommerceTotals } from '../js/commerce/totals.mjs';",
    '',
    "test('pricing calculations are deterministic at euro-cent precision', () => {",
    '  const items = [{ price: 49.95, quantity: 2 }, { price: 20, quantity: 1 }];',
    '  assert.equal(calculateSubtotal(items), 119.9);',
    '  assert.equal(calculateDiscount(100, 10), 10);',
    '  assert.equal(calculateDiscount(49.95, 10), 5);',
    '  assert.equal(calculateGrandTotal({ items, shipping: 4.95, discountPercent: 10 }), 112.86);',
    '  assert.equal(roundMoney(0.1 + 0.2), 0.3);',
    '});',
    '',
    "test('invalid pricing input cannot create negative totals', () => {",
    '  assert.equal(calculateSubtotal([{ price: -5, quantity: -2 }]), 0);',
    '  assert.equal(calculateDiscount(100, 150), 100);',
    '  assert.equal(calculateGrandTotal({ items: [], shipping: -10 }), 0);',
    '});',
    '',
    "test('only the validated Netherlands shipping market is enabled', () => {",
    '  assert.equal(SHIPPING_ZONES.NL.cost, 4.95);',
    '  assert.equal(SHIPPING_ZONES.NL.freeFrom, 69);',
    '  assert.equal(SHIPPING_ZONES.NL.enabled, true);',
    '  assert.equal(getShippingZone("US").enabled, false);',
    '});',
    '',
    "test('Netherlands shipping uses the approved threshold', () => {",
    "  assert.equal(calculateShipping({ countryCode: 'NL', subtotal: 68.99 }), 4.95);",
    "  assert.equal(calculateShipping({ countryCode: 'NL', subtotal: 69 }), 0);",
    "  assert.throws(() => calculateShipping({ countryCode: 'US', subtotal: 200 }), /not enabled/);",
    '  assert.equal(calculateShipping({ hasItems: false }), 0);',
    '});',
    '',
    "test('canonical totals apply discount before the free-shipping threshold', () => {",
    "  const totals = calculateCommerceTotals({ items: [{ price: 50, quantity: 1 }], countryCode: 'NL', discountPercent: 10 });",
    '  assert.equal(totals.subtotal, 50);',
    '  assert.equal(totals.discount, 5);',
    '  assert.equal(totals.discountedSubtotal, 45);',
    '  assert.equal(totals.shipping, 4.95);',
    '  assert.equal(totals.grandTotal, 49.95);',
    '  assert.equal(totals.freeShippingRemaining, 24);',
    '  assert.equal(totals.qualifiesForFreeShipping, false);',
    '});',
    '',
    "test('orders at the €69 threshold receive free shipping', () => {",
    "  const totals = calculateCommerceTotals({ items: [{ price: 69, quantity: 1 }], countryCode: 'NL' });",
    '  assert.equal(totals.shipping, 0);',
    '  assert.equal(totals.grandTotal, 69);',
    '  assert.equal(totals.qualifiesForFreeShipping, true);',
    '});',
    '',
    "test('unknown countries are blocked until their landed cost is validated', () => {",
    "  assert.throws(() => calculateCommerceTotals({ items: [{ price: 45, quantity: 1 }], countryCode: 'US' }), /not enabled/);",
    "  const empty = calculateCommerceTotals({ countryCode: 'NL' });",
    '  assert.equal(empty.subtotal, 0);',
    '  assert.equal(empty.shipping, 0);',
    '  assert.equal(empty.grandTotal, 0);',
    '});',
  ]));

  await writeIfChanged('scripts/validate-product-variants.mjs', lines([
    "import { readFile, readdir } from 'node:fs/promises';",
    "import { join } from 'node:path';",
    "import { DEFAULT_PRODUCT_VARIANT_ID, PRODUCT_VARIANTS, resolveCatalogProductVariant } from '../js/commerce/product-variants.mjs';",
    'const ROOT = process.cwd();',
    "const catalog = JSON.parse(await readFile(join(ROOT, 'data/products/catalog.json'), 'utf8'));",
    "const template = await readFile(join(ROOT, 'templates/product-page.html'), 'utf8');",
    "const app = await readFile(join(ROOT, 'js/app.js'), 'utf8');",
    'const errors = [];',
    'const keys = ["id", "label", "sizeLabel", "widthCm", "heightCm", "longestSideCm", "price", "skuSuffix", "isDefault"];',
    'const expectedVariants = PRODUCT_VARIANTS.map((variant) => Object.fromEntries(keys.map((key) => [key, variant[key]])));',
    "if (catalog.schemaVersion !== 3) errors.push('catalog schemaVersion must be 3.');",
    "if (catalog.variantPolicy?.defaultVariantId !== DEFAULT_PRODUCT_VARIANT_ID) errors.push('catalog default variant is invalid.');",
    "if (catalog.variantPolicy?.sizeMeasurement !== 'production_box') errors.push('catalog sizing must use production boxes.');",
    "if (catalog.variantPolicy?.aspectRatio !== 'preserved') errors.push('catalog must preserve artwork proportions.');",
    'for (const product of catalog.products || []) {',
    "  if (product.price !== 45 || product.fromPrice !== 35) errors.push(`${product.page}: expected prices 35/45.`);",
    "  if (product.defaultVariantId !== DEFAULT_PRODUCT_VARIANT_ID) errors.push(`${product.page}: incorrect default variant.`);",
    '  const normalized = (product.variants || []).map((variant) => Object.fromEntries(keys.map((key) => [key, variant[key]])));',
    "  if (JSON.stringify(normalized) !== JSON.stringify(expectedVariants)) errors.push(`${product.page}: variant policy differs.`);",
    "  try { resolveCatalogProductVariant(product, 'compact-50x30'); resolveCatalogProductVariant(product, 'statement-50x50'); }",
    "  catch (error) { errors.push(`${product.page}: ${error.message}`); }",
    '}',
    "if (!/value=\"statement-50x50\" checked/.test(template)) errors.push('Statement 50×50 must be selected by default.');",
    "if (!/value=\"compact-50x30\"/.test(template)) errors.push('Compact 50×30 option is missing.');",
    "if (!/production area/i.test(template)) errors.push('production-area sizing note is missing.');",
    "if (!/CART_SCHEMA_VERSION = '4'/.test(app)) errors.push('cart schema must be version 4.');",
    "if (!/International checkout opens per validated market/.test(app)) errors.push('market-gating notice is missing.');",
    "const rootHtmlFiles = (await readdir(ROOT)).filter((file) => file.endsWith('.html'));",
    'const productPages = new Set((catalog.products || []).map((product) => product.page));',
    'let checked = 0;',
    'for (const file of rootHtmlFiles) {',
    "  const html = await readFile(join(ROOT, file), 'utf8');",
    '  if (!productPages.has(file)) continue;',
    '  checked += 1;',
    "  if (!/data-variant-id=\"statement-50x50\"/.test(html)) errors.push(`${file}: default variant missing.`);",
    "  if (!/50 × 30 cm/.test(html) || !/50 × 50 cm/.test(html)) errors.push(`${file}: production box copy missing.`);",
    '}',
    "if (checked !== (catalog.products || []).length) errors.push(`checked ${checked} pages; expected ${(catalog.products || []).length}.`);",
    "if (errors.length) { console.error('Product variant validation failed:'); errors.forEach((error) => console.error(`- ${error}`)); process.exitCode = 1; }",
    "else console.log(`Product variant validation passed for ${checked} product pages.`);",
  ]));
}

async function migrateFullCatalogValidator() {
  let source = migrateIds(await readText('scripts/validate-full-product-catalog.mjs'));
  source = source
    .replaceAll('catalog.schemaVersion !== 2', 'catalog.schemaVersion !== 3')
    .replaceAll('catalog schemaVersion must be 2.', 'catalog schemaVersion must be 3.')
    .replaceAll("catalog.variantPolicy?.sizeMeasurement !== 'longest_side'", "catalog.variantPolicy?.sizeMeasurement !== 'production_box'")
    .replaceAll('catalog variant policy must measure the longest side.', 'catalog variant policy must use production boxes.')
    .replaceAll("['label', 'sizeCm', 'price', 'skuSuffix', 'isDefault']", "['label', 'sizeLabel', 'widthCm', 'heightCm', 'longestSideCm', 'price', 'skuSuffix', 'isDefault']");
  await writeIfChanged('scripts/validate-full-product-catalog.mjs', source);
}

async function migrateStripeValidator() {
  let source = migrateIds(await readText('scripts/validate-stripe-checkout.mjs'));
  source = replaceOrAlready(
    source,
    "    : `${product.name} — ${variant.sizeCm} cm`;",
    "    : `${product.name} — ${variant.label} (${variant.sizeLabel})`;",
    'Stripe expected variant name',
  );
  source = replaceOrAlready(
    source,
    "    if (metadata.variant_id !== variant.id || metadata.size_cm !== String(variant.sizeCm)) {\n      errors.push(`${product.page}: Stripe lost the authoritative selected size.`);\n    }",
    "    if (metadata.variant_id !== variant.id\n      || metadata.size_label !== variant.sizeLabel\n      || metadata.width_cm !== String(variant.widthCm)\n      || metadata.height_cm !== String(variant.heightCm)) {\n      errors.push(`${product.page}: Stripe lost the authoritative selected production box.`);\n    }",
    'Stripe metadata validation',
  );
  source = source
    .replaceAll('30 cm and 45 cm variants', 'Compact and Statement variants')
    .replaceAll('30 cm line', 'Compact line')
    .replaceAll('45 cm line', 'Statement line');
  await writeIfChanged('scripts/validate-stripe-checkout.mjs', source);
}

async function main() {
  await migrateCatalog();
  await migrateTemplateAndStaticPages();
  await migrateRepositoryIds();
  await writeCommerceModules();
  await migrateApp();
  await migrateCartControls();
  await migrateOrderQuote();
  await migrateCheckoutSession();
  await migrateProductPageGeneration();
  await writeCatalogGenerator();
  await writeValidationFiles();
  await migrateFullCatalogValidator();
  await migrateStripeValidator();
  console.log(`Launch commerce migration completed with ${changes.length} changed file(s).`);
  for (const file of changes) console.log(`- ${file}`);
}

main().catch((error) => {
  console.error('Launch commerce migration failed:', error);
  process.exit(1);
});
