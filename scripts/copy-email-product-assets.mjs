import { copyFile, mkdir, readFile, rm } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';

import { resolveV3EmailProductAsset } from '../server/notifications/v3-email-product-media.mjs';

const ROOT = process.cwd();
const DIST = resolve(ROOT, 'dist');
const OUTPUT_ROOT = resolve(DIST, 'email-products');
const CATALOG = resolve(ROOT, 'data/products/catalog.json');

const { products } = JSON.parse(await readFile(CATALOG, 'utf8'));
if (!Array.isArray(products) || products.length === 0) {
  throw new Error('Product catalog is empty or invalid.');
}

await rm(OUTPUT_ROOT, { recursive: true, force: true });

const copied = new Map();
for (const product of products) {
  const asset = resolveV3EmailProductAsset(product?.image);
  if (!asset) {
    throw new Error(`Unsupported email product image for ${product?.productId || 'unknown product'}.`);
  }

  const source = resolve(ROOT, asset.sourcePath);
  const destination = resolve(DIST, asset.publicPath.startsWith('/') ? asset.publicPath.slice(1) : asset.publicPath);
  if (!source.startsWith(`${ROOT}/`) || !destination.startsWith(`${OUTPUT_ROOT}/`)) {
    throw new Error(`Unsafe email product asset path for ${product.productId}.`);
  }

  const existing = copied.get(asset.publicPath);
  if (existing && existing !== asset.sourcePath) {
    throw new Error(`Email product asset collision at ${asset.publicPath}.`);
  }
  if (existing) continue;

  await mkdir(dirname(destination), { recursive: true });
  await copyFile(source, destination);
  copied.set(asset.publicPath, asset.sourcePath);
}

console.log(`Copied ${copied.size} stable email product assets into dist/email-products.`);
