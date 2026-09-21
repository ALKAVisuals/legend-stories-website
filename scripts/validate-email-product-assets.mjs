import { readFile, stat } from 'node:fs/promises';
import { resolve } from 'node:path';

import { resolveV3EmailProductAsset } from '../server/notifications/v3-email-product-media.mjs';

const ROOT = process.cwd();
const DIST = resolve(ROOT, 'dist');
const CATALOG = resolve(ROOT, 'data/products/catalog.json');

const { products } = JSON.parse(await readFile(CATALOG, 'utf8'));
if (!Array.isArray(products) || products.length === 0) {
  throw new Error('Product catalog is empty or invalid.');
}

const seen = new Set();
for (const product of products) {
  const asset = resolveV3EmailProductAsset(product?.image);
  if (!asset) throw new Error(`Invalid email product image for ${product?.productId || 'unknown product'}.`);
  if (seen.has(asset.publicPath)) throw new Error(`Duplicate email product asset path: ${asset.publicPath}`);
  seen.add(asset.publicPath);

  const source = await stat(resolve(ROOT, asset.sourcePath));
  const output = await stat(resolve(DIST, asset.publicPath.replace(/^\\/+/, '')));
  if (!source.isFile() || !output.isFile() || source.size !== output.size || output.size < 1) {
    throw new Error(`Email product asset validation failed for ${product.productId}.`);
  }
}

if (seen.size !== products.length) {
  throw new Error(`Expected ${products.length} email product assets, validated ${seen.size}.`);
}

console.log(`Validated ${seen.size} stable email product assets in dist/email-products.`);
