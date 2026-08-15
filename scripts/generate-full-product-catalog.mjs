import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { buildProductInventory } from './product-inventory.mjs';
import { DEFAULT_PRODUCT_VARIANT_ID, PRODUCT_VARIANTS } from '../js/commerce/product-variants.mjs';
import {
  PRODUCTION_IDENTITY_FILE,
  loadProductionIdentityBridge,
  resolveProductionIdentity,
} from './production-identity.mjs';

const ROOT = process.cwd();
const OUTPUT = join(ROOT, 'data', 'products', 'catalog.json');
const PRODUCTION_RELEASE_ID = 'full-portfolio-30-45cm-v2';

function normalizeDescription(value = '') {
  return String(value)
    .replace(
      /Available in Compact \(up to 50 × 30 cm\) and Statement \(up to 50 × 50 cm\)\. Original proportions are preserved\./g,
      'Available in Compact (30 cm longest side) and Statement (45 cm longest side). Original proportions are preserved.',
    )
    .replace(
      /Available in Compact \(50 × 30 cm\) and Statement \(50 × 50 cm\)\. Original proportions are preserved\./g,
      'Available in Compact (30 cm longest side) and Statement (45 cm longest side). Original proportions are preserved.',
    );
}

async function toCatalogProduct(product, identityBridge) {
  const identity = await resolveProductionIdentity(product, identityBridge, ROOT);
  return {
    productId: identity.productId,
    slug: product.slug,
    page: product.page,
    name: product.name,
    description: normalizeDescription(product.description),
    image: product.image,
    productionSourceSha256: identity.sourceSha256,
    price: 45,
    currency: product.currency || 'EUR',
    availability: product.availability,
    canonical: product.canonical,
    batch: { id: product.batchId, year: product.batchYear, number: product.batchNumber },
    collection: product.collection,
    category: product.category,
    fromPrice: 35,
    defaultVariantId: DEFAULT_PRODUCT_VARIANT_ID,
    variants: PRODUCT_VARIANTS,
  };
}

const inventory = await buildProductInventory(ROOT);
if (inventory.summary.errors > 0 || inventory.summary.productPages === 0) {
  throw new Error(`Cannot generate catalog from invalid inventory (${inventory.summary.errors} errors).`);
}

const identityBridge = await loadProductionIdentityBridge(ROOT);
if (inventory.products.length !== identityBridge.records.length) {
  throw new Error(
    `Storefront inventory / production identity count mismatch: ${inventory.products.length} vs ${identityBridge.records.length}.`,
  );
}

const products = (await Promise.all(
  inventory.products.map((product) => toCatalogProduct(product, identityBridge)),
)).sort((a, b) => a.page.localeCompare(b.page));

const productIds = new Set(products.map((product) => product.productId));
if (productIds.size !== products.length || productIds.size !== identityBridge.productIds.size) {
  throw new Error('Catalog production product IDs are not a one-to-one mapping.');
}
for (const productId of identityBridge.productIds) {
  if (!productIds.has(productId)) throw new Error(`Catalog is missing production product ID ${productId}.`);
}

const catalog = {
  schemaVersion: 3,
  productCount: products.length,
  productionPolicy: {
    releaseId: PRODUCTION_RELEASE_ID,
    identityFile: PRODUCTION_IDENTITY_FILE.replace(/\\/g, '/'),
    identityKey: 'storefront_source_path + source_sha256',
    productionLookupKey: 'product_id + size_cm',
  },
  variantPolicy: {
    defaultVariantId: DEFAULT_PRODUCT_VARIANT_ID,
    sizingModel: 'exact_longest_side',
    sizeMeasurement: 'longest_side',
    aspectRatio: 'preserved',
    variants: PRODUCT_VARIANTS,
  },
  products,
};
await mkdir(dirname(OUTPUT), { recursive: true });
await writeFile(OUTPUT, `${JSON.stringify(catalog, null, 2)}\n`, 'utf8');
console.log(
  `Generated central product catalog with ${products.length} products; `
  + `production IDs verified against ${PRODUCTION_RELEASE_ID}.`,
);
