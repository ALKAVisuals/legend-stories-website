import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { buildProductInventory } from './product-inventory.mjs';

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

const inventory = await buildProductInventory(ROOT);
const catalog = JSON.parse(await readFile(CATALOG_PATH, 'utf8'));
const errors = [];

if (catalog.schemaVersion !== 1) errors.push('catalog schemaVersion must be 1.');
if (!Array.isArray(catalog.products)) errors.push('catalog products must be an array.');

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
}

const expectedByPage = new Map(expected.map((product) => [product.page, product]));
for (const product of actual) {
  const reference = expectedByPage.get(product.page);
  if (!reference) {
    errors.push(`${product.page}: not found in live product inventory.`);
    continue;
  }
  if (JSON.stringify(product) !== JSON.stringify(reference)) {
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
