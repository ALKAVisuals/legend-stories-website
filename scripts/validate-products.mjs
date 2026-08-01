import { access, readFile } from 'node:fs/promises';
import { join } from 'node:path';

const ROOT = process.cwd();
const DATA_FILE = join(ROOT, 'data/products/2026-batch-3-poc.json');
const GENERATED_DIR = join(ROOT, 'generated/product-poc');
const REQUIRED = ['slug','name','category','collection','batchId','price','currency','status','page','image','description'];

function fail(message) { throw new Error(message); }

const { batch, products } = JSON.parse(await readFile(DATA_FILE, 'utf8'));
if (!batch?.id || !Number.isInteger(batch.year) || !Number.isInteger(batch.number)) fail('Invalid batch metadata.');
if (!Array.isArray(products) || products.length < 2) fail('At least two POC products are required.');

const slugs = new Set();
for (const product of products) {
  for (const field of REQUIRED) if (product[field] === undefined || product[field] === null || product[field] === '') fail(`${product.slug || 'Unknown'} missing ${field}.`);
  if (slugs.has(product.slug)) fail(`Duplicate slug: ${product.slug}`);
  slugs.add(product.slug);
  if (product.batchId !== batch.id) fail(`${product.slug} batch mismatch.`);
  if (!Number.isFinite(product.price) || product.price <= 0) fail(`${product.slug} invalid price.`);
  if (!['music','combat','sport','wisdom'].includes(product.category)) fail(`${product.slug} invalid category.`);
  await access(join(ROOT, product.page));
  await access(join(ROOT, product.image));
  const generated = await readFile(join(GENERATED_DIR, product.page), 'utf8');
  if (!generated.includes(`<title>${product.name} — ${product.collection} | Legend Stories</title>`)) fail(`${product.slug} title mismatch.`);
  if (!generated.includes(`data-batch-id="${product.batchId}"`)) fail(`${product.slug} batch metadata missing.`);
  if (!generated.includes(`data-product-slug="${product.slug}"`)) fail(`${product.slug} slug metadata missing.`);
  if (!generated.includes(product.image)) fail(`${product.slug} image mismatch.`);
}
console.log(`Product validation passed for ${products.length} products in ${batch.id}.`);
