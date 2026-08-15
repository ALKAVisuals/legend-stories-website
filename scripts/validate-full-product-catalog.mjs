import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

import { buildProductInventory } from './product-inventory.mjs';
import {
  DEFAULT_PRODUCT_VARIANT_ID,
  PRODUCT_VARIANTS,
  resolveCatalogProductVariant,
} from '../js/commerce/product-variants.mjs';
import {
  PRODUCTION_IDENTITY_FILE,
  loadProductionIdentityBridge,
  resolveProductionIdentity,
} from './production-identity.mjs';

const ROOT = process.cwd();
const CATALOG_PATH = join(ROOT, 'data', 'products', 'catalog.json');
const EXPECTED_PRODUCT_COUNT = 111;
const PRODUCTION_RELEASE_ID = 'full-portfolio-30-45cm-v2';
const PRODUCT_ID_PATTERN = /^LM-\d{4}-\d{5}$/;
const SHA256_PATTERN = /^[a-f0-9]{64}$/;

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
const identityBridge = await loadProductionIdentityBridge(ROOT);
const catalog = JSON.parse(await readFile(CATALOG_PATH, 'utf8'));
const errors = [];

if (catalog.schemaVersion !== 3) errors.push('catalog schemaVersion must be 3.');
if (!Array.isArray(catalog.products)) errors.push('catalog products must be an array.');
if (catalog.productCount !== EXPECTED_PRODUCT_COUNT) {
  errors.push(`catalog productCount must be ${EXPECTED_PRODUCT_COUNT}.`);
}
if (catalog.productionPolicy?.releaseId !== PRODUCTION_RELEASE_ID) {
  errors.push(`catalog productionPolicy.releaseId must be ${PRODUCTION_RELEASE_ID}.`);
}
if (catalog.productionPolicy?.identityFile !== PRODUCTION_IDENTITY_FILE.replace(/\\/g, '/')) {
  errors.push('catalog productionPolicy.identityFile is invalid.');
}
if (catalog.productionPolicy?.identityKey !== 'storefront_source_path + source_sha256') {
  errors.push('catalog production identity key is invalid.');
}
if (catalog.productionPolicy?.productionLookupKey !== 'product_id + size_cm') {
  errors.push('catalog production lookup key is invalid.');
}
if (catalog.variantPolicy?.defaultVariantId !== DEFAULT_PRODUCT_VARIANT_ID) {
  errors.push('catalog variant policy has an invalid default.');
}
if (catalog.variantPolicy?.sizingModel !== 'exact_longest_side') {
  errors.push('catalog variant policy must use exact_longest_side sizing.');
}
if (catalog.variantPolicy?.sizeMeasurement !== 'longest_side') {
  errors.push('catalog variant policy must measure the longest side.');
}
if (catalog.variantPolicy?.aspectRatio !== 'preserved') {
  errors.push('catalog variant policy must preserve aspect ratio.');
}

const expected = inventory.products
  .map(comparableInventoryProduct)
  .sort((a, b) => a.page.localeCompare(b.page));
const actual = Array.isArray(catalog.products)
  ? [...catalog.products].sort((a, b) => a.page.localeCompare(b.page))
  : [];

if (catalog.productCount !== actual.length) errors.push('productCount does not match the catalog array length.');
if (actual.length !== expected.length) {
  errors.push(`catalog contains ${actual.length} products; expected ${expected.length}.`);
}
if (identityBridge.records.length !== EXPECTED_PRODUCT_COUNT) {
  errors.push(`production identity bridge must contain ${EXPECTED_PRODUCT_COUNT} products.`);
}

const inventoryByPage = new Map(inventory.products.map((product) => [product.page, product]));
const seenPages = new Set();
const seenSlugs = new Set();
const seenProductIds = new Set();

for (const product of actual) {
  if (!product.page || seenPages.has(product.page)) {
    errors.push(`duplicate or missing page: ${product.page || '(empty)'}.`);
  }
  if (!product.slug || seenSlugs.has(product.slug)) {
    errors.push(`duplicate or missing slug: ${product.slug || '(empty)'}.`);
  }
  if (!PRODUCT_ID_PATTERN.test(String(product.productId || '')) || seenProductIds.has(product.productId)) {
    errors.push(`${product.page}: duplicate or invalid canonical production productId.`);
  }
  if (!SHA256_PATTERN.test(String(product.productionSourceSha256 || ''))) {
    errors.push(`${product.page}: invalid productionSourceSha256.`);
  }
  seenPages.add(product.page);
  seenSlugs.add(product.slug);
  seenProductIds.add(product.productId);

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
      for (const key of [
        'label', 'sizeLabel', 'widthCm', 'heightCm', 'longestSideCm',
        'sizeCm', 'price', 'skuSuffix', 'isDefault',
      ]) {
        if (actualVariant[key] !== expectedVariant[key]) {
          errors.push(`${product.page}: ${expectedVariant.id}.${key} differs from policy.`);
        }
      }
    }
  }
  try {
    const compact = resolveCatalogProductVariant(product, 'compact-30');
    const statement = resolveCatalogProductVariant(product, 'statement-45');
    const legacyCompact = resolveCatalogProductVariant(product, 'compact-50x30');
    const legacyStatement = resolveCatalogProductVariant(product, 'statement-50x50');
    if (compact.id !== 'compact-30' || compact.sizeCm !== 30) {
      errors.push(`${product.page}: compact variant is not the exact 30 cm production size.`);
    }
    if (statement.id !== 'statement-45' || statement.sizeCm !== 45) {
      errors.push(`${product.page}: statement variant is not the exact 45 cm production size.`);
    }
    if (legacyCompact.id !== compact.id || legacyStatement.id !== statement.id) {
      errors.push(`${product.page}: legacy variant IDs do not canonicalize to 30/45 cm.`);
    }
  } catch (error) {
    errors.push(`${product.page}: ${error.message}`);
  }

  const inventoryProduct = inventoryByPage.get(product.page);
  if (!inventoryProduct) {
    errors.push(`${product.page}: not found in live product inventory.`);
  } else {
    try {
      const identity = await resolveProductionIdentity(inventoryProduct, identityBridge, ROOT);
      if (product.productId !== identity.productId) {
        errors.push(`${product.page}: productId differs from verified production identity.`);
      }
      if (product.productionSourceSha256 !== identity.sourceSha256) {
        errors.push(`${product.page}: productionSourceSha256 differs from verified storefront artwork.`);
      }
    } catch (error) {
      errors.push(`${product.page}: ${error.message}`);
    }
  }
}

if (seenProductIds.size !== EXPECTED_PRODUCT_COUNT) {
  errors.push(`catalog must contain ${EXPECTED_PRODUCT_COUNT} unique production product IDs.`);
}
for (const productId of identityBridge.productIds) {
  if (!seenProductIds.has(productId)) errors.push(`catalog is missing production product ID ${productId}.`);
}

const expectedByPage = new Map(expected.map((product) => [product.page, product]));
for (const product of actual) {
  const reference = expectedByPage.get(product.page);
  if (!reference) continue;
  if (JSON.stringify(comparableCatalogProduct(product)) !== JSON.stringify(reference)) {
    errors.push(`${product.page}: central catalog differs from live product data.`);
  }
}

if (errors.length) {
  console.error('Full product catalog validation failed:');
  for (const error of errors) console.error(`- ${error}`);
  process.exitCode = 1;
} else {
  console.log(
    `Full product catalog validation passed for ${actual.length} products across `
    + `${new Set(actual.map((p) => p.batch.id)).size} batches with exact production identity and 30/45 cm variants.`,
  );
}
