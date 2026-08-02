import { mkdir, rm, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { buildProductInventory } from './product-inventory.mjs';

const ROOT = process.cwd();
const OUTPUT_DIR = join(ROOT, 'generated/public/data');
const OUTPUT_FILE = join(OUTPUT_DIR, 'product-registry.json');

export function toRuntimeProduct(product) {
  return {
    slug: product.slug,
    page: product.page,
    name: product.name,
    image: product.browserImage || product.image,
    category: product.category,
    collection: product.collection,
    batchId: product.batchId,
  };
}

export async function generateRuntimeProductRegistry(root = ROOT) {
  const inventory = await buildProductInventory(root);
  if (inventory.summary.errors > 0) {
    throw new Error(`Cannot generate runtime registry with ${inventory.summary.errors} product inventory error(s).`);
  }

  const products = inventory.products
    .map(toRuntimeProduct)
    .sort((left, right) => left.page.localeCompare(right.page));

  const registry = {
    schemaVersion: 1,
    productCount: products.length,
    products,
  };

  await rm(join(root, 'generated/public/data'), { recursive: true, force: true });
  await mkdir(join(root, 'generated/public/data'), { recursive: true });
  await writeFile(
    join(root, 'generated/public/data/product-registry.json'),
    `${JSON.stringify(registry, null, 2)}\n`,
    'utf8',
  );

  return registry;
}

async function main() {
  const registry = await generateRuntimeProductRegistry(ROOT);
  console.log(`Generated runtime product registry with ${registry.productCount} products.`);
}

const isDirectRun = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isDirectRun) main().catch((error) => {
  console.error('Runtime product registry generation failed:', error);
  process.exit(1);
});
