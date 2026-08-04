import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

import { buildProductInventory } from './product-inventory.mjs';
import {
  DEFAULT_PRODUCT_VARIANT_ID,
  PRODUCT_VARIANTS,
  resolveCatalogProductVariant,
} from '../js/commerce/product-variants.mjs';

const ROOT = process.cwd();
const CATALOG_PATH = join(ROOT, 'data', 'products', 'catalog.json');

function comparableInventoryProduct(product) {
  return {
    slug: product.slug,
    page: product.page,
    name: product.name,
    description: product.description,
    image: product.image,
    price: product.price,
    currency: product.currency || 'EUR',
    availability: product.availability,
    canonical: product.canonical,
    batch: {
      id: product.batchId,
      year: product.batchYear,
      number: product.batchNumber,
    },
    collection: product.collection,
    category: product.category,
  };
}

function comparableCatalogProduct(product) {
  return {
    slug: product.slug,
    page: product.page,
    name: product.name,
    description: product.description,
    image: product.image,
    price: product.price,
    currency: product.currency || 'EUR',
    availability: product.availability,
    canonical: product.canonical,
    batch: product.batch,
    collection: product.collection,
    category: product.category,
  };
}

const inventory = await buildProductInventory(ROOT);
const catalog = JSON.parse(await readFile(CATALOG_PATH, 'utf8'));
const errors = [];

if (catalog.schemaVersion !== 3) errors.push('catalog schemaVersion must be 3.');
if (!Array.isArray(catalog.products)) errors.push('catalog products must be an array.');
if (catalog.variantPolicy?.defaultVariantId !== DEFAULT_PRODUCT_VARIANT_ID) {
  errors.push('catalog variant policy has an invalid default.');
}
if (catalog.variantPolicy?.sizeMeasurement !== 'production_box') {
  errors.push('catalog variant policy must use production boxes.');
}

const expected = inventory.products
  .map(comparableInventoryProduct)
  .sort((a, b) => a.page.localeCompare(b.page));
const actual = Array.isArray(catalog.products) ? [...catalog.products].sort((a, b) => a.page.localeCompare(b.page)) : [];

if (catalog.productCount !== actual.length) errors.push('productCount does not match the catalog array length.');
if (actual.length !== expected.length) errors.push(`catalog contains ${actual.length} products; expected ${expected.length}.`);

const seenPages = new Set();
const seenSlugs = new Set();
for (const product of actual) {
  if (!product.page || seenPages.has(product.page)) errors.push(`duplicate or missing page: ${product.page || '(empty)'}.`);
  if (!product.slug || seenSlugs.has(product.slug)) errors.push(`duplicate or missing slug: ${product.slug || '(empty)'}.`);
  seenPages.add(product.page);
  seenSlugs.add(product.slug);

  if (product.fromPrice !== 35 || product.price !== 45) {
    errors.push(`${product.page}: expected fromPrice 35 and default price 45.`);
  }
  if (product.defaultVariantId !== DEFAULT_PRODUCT_VARIANT_ID) {
    errors.push(`${product.page}: default variant must be ${DEFAULT_PRODUCT_VARIANT_ID}.`);
  }
  if (!Array.isArray(product.variants) || product.variants.length !== PRODUCT_VARIANTS.length) {
    errors.push(`${product.page}: expected ${PRODUCT_VARIANTS.length} variants.`);
  } else {
    for (const expectedVariant of PRODUCT_VARIANTS) {
      const actualVariant = product.variants.find((entry) => entry.id === expectedVariant.id);
      if (!actualVariant) {
        errors.push(`${product.page}: missing ${expectedVariant.id}.`);
        continue;
      }
      for (const key of ['label', 'sizeLabel', 'widthCm', 'heightCm', 'longestSideCm', 'price', 'skuSuffix', 'isDefault']) {
        if (actualVariant[key] !== expectedVariant[key]) {
          errors.push(`${product.page}: ${expectedVariant.id}.${key} differs from policy.`);
        }
      }
    }
  }
  try {
    resolveCatalogProductVariant(product, 'compact-50x30');
    resolveCatalogProductVariant(product, 'statement-50x50');
  } catch (error) {
    errors.push(`${product.page}: ${error.message}`);
  }
}

const expectedByPage = new Map(expected.map((product) => [product.page, product]));
for (const product of actual) {
  const reference = expectedByPage.get(product.page);
  if (!reference) {
    errors.push(`${product.page}: not found in live product inventory.`);
    continue;
  }
  if (JSON.stringify(comparableCatalogProduct(product)) !== JSON.stringify(reference)) {
    errors.push(`${product.page}: central catalog differs from live product data.`);
  }
}

if (errors.length) {
  console.error('Full product catalog validation failed:');
  for (const error of errors) console.error(`- ${error}`);
  process.exitCode = 1;
} else {
  console.log(`Full product catalog validation passed for ${actual.length} products across ${new Set(actual.map((p) => p.batch.id)).size} batches.`);
}
