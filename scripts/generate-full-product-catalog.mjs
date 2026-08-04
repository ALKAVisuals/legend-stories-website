import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { buildProductInventory } from './product-inventory.mjs';
import { DEFAULT_PRODUCT_VARIANT_ID, PRODUCT_VARIANTS } from '../js/commerce/product-variants.mjs';

const ROOT = process.cwd();
const OUTPUT = join(ROOT, 'data', 'products', 'catalog.json');

function toCatalogProduct(product) {
  return {
    slug: product.slug, page: product.page, name: product.name,
    description: product.description, image: product.image, price: 45,
    currency: product.currency || 'EUR', availability: product.availability, canonical: product.canonical,
    batch: { id: product.batchId, year: product.batchYear, number: product.batchNumber },
    collection: product.collection, category: product.category, fromPrice: 35,
    defaultVariantId: DEFAULT_PRODUCT_VARIANT_ID, variants: PRODUCT_VARIANTS,
  };
}

const inventory = await buildProductInventory(ROOT);
if (inventory.summary.errors > 0 || inventory.summary.productPages === 0) {
  throw new Error(`Cannot generate catalog from invalid inventory (${inventory.summary.errors} errors).`);
}
const products = inventory.products.map(toCatalogProduct).sort((a, b) => a.page.localeCompare(b.page));
const catalog = {
  schemaVersion: 3,
  productCount: products.length,
  variantPolicy: {
    defaultVariantId: DEFAULT_PRODUCT_VARIANT_ID,
    sizingModel: 'fit_within_production_box',
    sizeMeasurement: 'production_box',
    aspectRatio: 'preserved',
    variants: PRODUCT_VARIANTS,
  },
  products,
};
await mkdir(dirname(OUTPUT), { recursive: true });
await writeFile(OUTPUT, `${JSON.stringify(catalog, null, 2)}\n`, "utf8");
console.log(`Generated central product catalog with ${products.length} products.`);
