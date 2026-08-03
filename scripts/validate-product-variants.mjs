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

const expectedVariants = PRODUCT_VARIANTS.map(({ id, label, sizeCm, price, skuSuffix, isDefault }) => ({
  id,
  label,
  sizeCm,
  price,
  skuSuffix,
  isDefault,
}));

if (catalog.schemaVersion !== 2) errors.push('catalog schemaVersion must be 2.');
if (catalog.variantPolicy?.defaultVariantId !== DEFAULT_PRODUCT_VARIANT_ID) {
  errors.push('catalog variant policy must default to statement-45.');
}
if (catalog.variantPolicy?.sizeMeasurement !== 'longest_side') {
  errors.push('catalog size measurement must be longest_side.');
}

for (const product of catalog.products || []) {
  if (product.price !== 45 || product.fromPrice !== 35) {
    errors.push(`${product.page}: expected default price 45 and fromPrice 35.`);
  }
  if (product.defaultVariantId !== DEFAULT_PRODUCT_VARIANT_ID) {
    errors.push(`${product.page}: incorrect default variant.`);
  }
  const normalized = (product.variants || []).map(
    ({ id, label, sizeCm, price, skuSuffix, isDefault }) => ({
      id,
      label,
      sizeCm,
      price,
      skuSuffix,
      isDefault: Boolean(isDefault),
    }),
  );
  if (JSON.stringify(normalized) !== JSON.stringify(expectedVariants)) {
    errors.push(`${product.page}: variant policy differs from the approved catalog policy.`);
  }
  try {
    resolveCatalogProductVariant(product, 'compact-30');
    resolveCatalogProductVariant(product, 'statement-45');
  } catch (error) {
    errors.push(`${product.page}: ${error.message}`);
  }
  if (/60\s*[×x]\s*90\s*cm/i.test(product.description || '')) {
    errors.push(`${product.page}: legacy 60x90 description remains.`);
  }
}

if (!/data-product-variant-selector/.test(template)) errors.push('product template lacks a size selector.');
if (!/value="statement-45" checked/.test(template)) errors.push('45 cm must be selected by default.');
if (!/value="compact-30"/.test(template)) errors.push('30 cm option is missing.');
if (!/Most chosen/.test(template)) errors.push('45 cm option lacks the Most chosen badge.');
if (!/measured along the longest side/i.test(template)) errors.push('longest-side measurement note is missing.');
if (/line-through|Save 17%|60\s*[×x]\s*90/.test(template)) errors.push('legacy comparison price or size remains in the template.');

if (!/CART_SCHEMA_VERSION = '3'/.test(app)) errors.push('cart schema was not upgraded for variants.');
if (!/createCartLineId\(page, variant\.id\)/.test(app)) errors.push('cart line identity is not variant-aware.');
if (!/Local import duties and taxes may apply/.test(app)) errors.push('international import-cost notice is missing.');

const rootHtmlFiles = (await readdir(ROOT)).filter((file) => file.endsWith('.html'));
const productPages = new Set((catalog.products || []).map((product) => product.page));
let checkedProductPages = 0;
for (const file of rootHtmlFiles) {
  const html = await readFile(join(ROOT, file), 'utf8');
  if (productPages.has(file)) {
    checkedProductPages += 1;
    if (!/data-product-variant-selector/.test(html)) errors.push(`${file}: generated selector missing.`);
    if (!/data-variant-id="statement-45"/.test(html)) errors.push(`${file}: default add-to-cart variant missing.`);
    if (/line-through|Save 17%|60\s*[×x]\s*90/.test(html)) errors.push(`${file}: legacy price or size remains.`);
  } else if (/(?:product-card|data-product-href)/.test(html)) {
    if (/<span class="font-display text-xl font-bold">€49[,.]95<\/span>/.test(html)) {
      errors.push(`${file}: storefront still shows the old product price.`);
    }
    const productButtons = html.match(/<button\b[^>]*\badd-to-cart-btn\b[^>]*>/g) || [];
    for (const button of productButtons) {
      if (!/data-variant-id="statement-45"/.test(button)) {
        errors.push(`${file}: a direct product button lacks the default 45 cm variant.`);
        break;
      }
    }
  }
}

if (checkedProductPages !== (catalog.products || []).length) {
  errors.push(`checked ${checkedProductPages} product pages; expected ${(catalog.products || []).length}.`);
}

if (errors.length) {
  console.error('Product variant validation failed:');
  for (const error of errors) console.error(`- ${error}`);
  process.exitCode = 1;
} else {
  console.log(`Product variant validation passed for ${checkedProductPages} product pages.`);
}
