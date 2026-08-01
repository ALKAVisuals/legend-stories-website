import { access, readFile } from 'node:fs/promises';
import { join } from 'node:path';

const ROOT = process.cwd();
const DATA_FILE = join(ROOT, 'data/products/2026-batch-3-poc.json');
const REQUIRED_PRODUCT_FIELDS = [
  'slug', 'name', 'category', 'collection', 'batchId', 'price',
  'currency', 'status', 'page', 'image', 'description'
];

function fail(message) {
  throw new Error(message);
}

async function main() {
  const payload = JSON.parse(await readFile(DATA_FILE, 'utf8'));
  const { batch, products } = payload;

  if (!batch?.id || !Number.isInteger(batch.year) || !Number.isInteger(batch.number)) {
    fail('Batch metadata must include id, integer year and integer number.');
  }
  if (!Array.isArray(products) || products.length < 2) {
    fail('The product proof of concept must contain at least two products.');
  }

  const slugs = new Set();
  for (const product of products) {
    for (const field of REQUIRED_PRODUCT_FIELDS) {
      if (product[field] === undefined || product[field] === null || product[field] === '') {
        fail(`${product.slug || 'Unknown product'} is missing ${field}.`);
      }
    }

    if (slugs.has(product.slug)) fail(`Duplicate product slug: ${product.slug}`);
    slugs.add(product.slug);

    if (product.batchId !== batch.id) fail(`${product.slug} has a mismatched batchId.`);
    if (!Number.isFinite(product.price) || product.price <= 0) fail(`${product.slug} has an invalid price.`);
    if (!['music', 'combat', 'sport', 'wisdom'].includes(product.category)) {
      fail(`${product.slug} has an unsupported category.`);
    }

    await access(join(ROOT, product.page));
    await access(join(ROOT, product.image));
  }

  console.log(`Product data validation passed for ${products.length} products in ${batch.id}.`);
}

main().catch((error) => {
  console.error(`Product data validation failed: ${error.message}`);
  process.exit(1);
});
