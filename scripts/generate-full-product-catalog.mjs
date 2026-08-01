import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { buildProductInventory } from './product-inventory.mjs';

const ROOT = process.cwd();
const OUTPUT = join(ROOT, 'data', 'products', 'catalog.json');

function toCatalogProduct(product) {
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
if (inventory.summary.errors > 0 || inventory.summary.productPages === 0) {
  throw new Error(`Cannot generate catalog from invalid inventory (${inventory.summary.errors} errors).`);
}

const products = inventory.products
  .map(toCatalogProduct)
  .sort((a, b) => a.page.localeCompare(b.page));

const catalog = {
  schemaVersion: 1,
  productCount: products.length,
  products,
};

await mkdir(dirname(OUTPUT), { recursive: true });
await writeFile(OUTPUT, `${JSON.stringify(catalog, null, 2)}\n`, 'utf8');
console.log(`Generated central product catalog with ${products.length} products.`);
