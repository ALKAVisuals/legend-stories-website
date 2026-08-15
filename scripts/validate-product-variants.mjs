import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import {
  DEFAULT_PRODUCT_VARIANT_ID,
  PRODUCT_VARIANTS,
  resolveCatalogProductVariant,
} from '../js/commerce/product-variants.mjs';

const ROOT = process.cwd();
const catalog = JSON.parse(await readFile(join(ROOT, 'data/products/catalog.json'), 'utf8'));
const template = await readFile(join(ROOT, 'templates/product-page.html'), 'utf8');
const app = await readFile(join(ROOT, 'js/app.js'), 'utf8');
const errors = [];
const keys = [
  'id', 'label', 'sizeLabel', 'widthCm', 'heightCm', 'longestSideCm',
  'sizeCm', 'price', 'skuSuffix', 'isDefault',
];
const expectedVariants = PRODUCT_VARIANTS.map((variant) => (
  Object.fromEntries(keys.map((key) => [key, variant[key]]))
));

if (catalog.schemaVersion !== 3) errors.push('catalog schemaVersion must be 3.');
if (catalog.variantPolicy?.defaultVariantId !== DEFAULT_PRODUCT_VARIANT_ID) {
  errors.push('catalog default variant is invalid.');
}
if (catalog.variantPolicy?.sizingModel !== 'exact_longest_side') {
  errors.push('catalog sizingModel must be exact_longest_side.');
}
if (catalog.variantPolicy?.sizeMeasurement !== 'longest_side') {
  errors.push('catalog sizeMeasurement must be longest_side.');
}
if (catalog.variantPolicy?.aspectRatio !== 'preserved') {
  errors.push('catalog must preserve artwork proportions.');
}

for (const product of catalog.products || []) {
  if (product.price !== 45 || product.fromPrice !== 35) {
    errors.push(`${product.page}: expected prices 35/45.`);
  }
  if (product.defaultVariantId !== DEFAULT_PRODUCT_VARIANT_ID) {
    errors.push(`${product.page}: incorrect default variant.`);
  }
  const normalized = (product.variants || []).map((variant) => (
    Object.fromEntries(keys.map((key) => [key, variant[key]]))
  ));
  if (JSON.stringify(normalized) !== JSON.stringify(expectedVariants)) {
    errors.push(`${product.page}: variant policy differs.`);
  }
  try {
    const compact = resolveCatalogProductVariant(product, 'compact-30');
    const statement = resolveCatalogProductVariant(product, 'statement-45');
    const legacyCompact = resolveCatalogProductVariant(product, 'compact-50x30');
    const legacyStatement = resolveCatalogProductVariant(product, 'statement-50x50');
    if (compact.id !== 'compact-30' || compact.sizeCm !== 30) {
      errors.push(`${product.page}: compact production size is not 30 cm.`);
    }
    if (statement.id !== 'statement-45' || statement.sizeCm !== 45) {
      errors.push(`${product.page}: statement production size is not 45 cm.`);
    }
    if (legacyCompact.id !== 'compact-30' || legacyStatement.id !== 'statement-45') {
      errors.push(`${product.page}: legacy 50 cm variant aliases do not canonicalize.`);
    }
  } catch (error) {
    errors.push(`${product.page}: ${error.message}`);
  }
}

if (!/value="statement-45" checked/.test(template)) {
  errors.push('Statement 45 cm must be selected by default.');
}
if (!/value="compact-30"/.test(template)) errors.push('Compact 30 cm option is missing.');
if (!/45 cm longest side/i.test(template) || !/30 cm longest side/i.test(template)) {
  errors.push('longest-side production size copy is missing from the product template.');
}
if (!/original artwork proportions/i.test(template)) {
  errors.push('aspect-ratio preservation note is missing.');
}
if (/50 × 50 cm|50 × 30 cm|statement-50x50|compact-50x30/.test(template)) {
  errors.push('legacy 50 cm production variant copy remains in the product template.');
}
if (!/CART_SCHEMA_VERSION = '4'/.test(app)) errors.push('cart schema must be version 4.');
if (!/International checkout opens per validated market/.test(app)) {
  errors.push('market-gating notice is missing.');
}

const rootHtmlFiles = (await readdir(ROOT)).filter((file) => file.endsWith('.html'));
const productPages = new Set((catalog.products || []).map((product) => product.page));
let checked = 0;
for (const file of rootHtmlFiles) {
  const html = await readFile(join(ROOT, file), 'utf8');
  if (!productPages.has(file)) continue;
  checked += 1;
  if (!/data-variant-id="statement-45"/.test(html)) {
    errors.push(`${file}: default 45 cm variant missing.`);
  }
  if (!/30 cm longest side/.test(html) || !/45 cm longest side/.test(html)) {
    errors.push(`${file}: 30/45 cm longest-side copy missing.`);
  }
  if (/50 × 50 cm|50 × 30 cm|statement-50x50|compact-50x30/.test(html)) {
    errors.push(`${file}: legacy 50 cm production variant remains.`);
  }
}
if (checked !== (catalog.products || []).length) {
  errors.push(`checked ${checked} pages; expected ${(catalog.products || []).length}.`);
}

if (errors.length) {
  console.error('Product variant validation failed:');
  errors.forEach((error) => console.error(`- ${error}`));
  process.exitCode = 1;
} else {
  console.log(`Product variant validation passed for ${checked} product pages at exact 30/45 cm longest-side sizes.`);
}
