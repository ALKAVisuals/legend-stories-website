import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

import { buildProductInventory } from './product-inventory.mjs';

const ROOT = process.cwd();
const REGISTRY_FILE = join(ROOT, 'generated/public/data/product-registry.json');
const REQUIRED_FIELDS = ['slug', 'page', 'name', 'image', 'category', 'collection', 'batchId'];

function compare(errors, page, field, expected, actual) {
  if (expected !== actual) {
    errors.push(`${page}: runtime registry ${field} differs from product inventory.`);
  }
}

const registry = JSON.parse(await readFile(REGISTRY_FILE, 'utf8'));
const inventory = await buildProductInventory(ROOT);
const errors = [];

if (registry.schemaVersion !== 1) errors.push('Runtime registry schemaVersion must be 1.');
if (!Array.isArray(registry.products)) errors.push('Runtime registry products must be an array.');

const products = Array.isArray(registry.products) ? registry.products : [];
if (registry.productCount !== products.length) {
  errors.push(`Runtime registry productCount is ${registry.productCount}; actual array contains ${products.length}.`);
}
if (inventory.summary.errors > 0) {
  errors.push(`Product inventory contains ${inventory.summary.errors} error(s).`);
}
if (products.length !== inventory.products.length) {
  errors.push(`Runtime registry contains ${products.length} products; inventory contains ${inventory.products.length}.`);
}

const inventoryByPage = new Map(inventory.products.map((product) => [product.page, product]));
const seen = {
  slug: new Set(),
  page: new Set(),
  image: new Set(),
};

for (const product of products) {
  for (const field of REQUIRED_FIELDS) {
    if (product[field] === undefined || product[field] === null || product[field] === '') {
      errors.push(`${product.page || product.slug || 'Unknown product'}: missing ${field}.`);
    }
  }

  for (const field of ['slug', 'page', 'image']) {
    if (seen[field].has(product[field])) errors.push(`${product.page}: duplicate ${field} ${product[field]}.`);
    seen[field].add(product[field]);
  }

  if (product.page !== `${product.slug}.html`) errors.push(`${product.page}: page must equal slug.html.`);

  const inventoryProduct = inventoryByPage.get(product.page);
  if (!inventoryProduct) {
    errors.push(`${product.page}: no matching inventory product.`);
    continue;
  }

  for (const field of REQUIRED_FIELDS) {
    const expected = field === 'image'
      ? inventoryProduct.browserImage || inventoryProduct.image
      : inventoryProduct[field];
    compare(errors, product.page, field, expected, product[field]);
  }
}

for (const inventoryProduct of inventory.products) {
  if (!seen.page.has(inventoryProduct.page)) {
    errors.push(`${inventoryProduct.page}: missing from runtime registry.`);
  }
}

const sortedPages = products.map((product) => product.page);
const expectedOrder = [...sortedPages].sort((left, right) => left.localeCompare(right));
if (JSON.stringify(sortedPages) !== JSON.stringify(expectedOrder)) {
  errors.push('Runtime registry products must be sorted by page for deterministic output.');
}

if (errors.length > 0) {
  console.error('\nRuntime product registry validation failed:\n');
  errors.forEach((error) => console.error(`- ${error}`));
  process.exit(1);
}

const batchCounts = products.reduce((counts, product) => {
  counts[product.batchId] = (counts[product.batchId] || 0) + 1;
  return counts;
}, {});

console.log(
  `Runtime product registry validation passed for ${products.length} products across ${Object.keys(batchCounts).length} batches.`,
);
