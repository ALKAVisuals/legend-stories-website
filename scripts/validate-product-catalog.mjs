import { access, readFile } from 'node:fs/promises';
import { join } from 'node:path';

import { buildProductInventory } from './product-inventory.mjs';

const ROOT = process.cwd();
const DATA_FILE = join(ROOT, 'data/products/2026-batch-3.json');
const GENERATED_DIR = join(ROOT, 'generated/product-previews');
const REQUIRED_FIELDS = [
  'slug',
  'page',
  'name',
  'description',
  'category',
  'collection',
  'batchId',
  'price',
  'currency',
  'availability',
  'status',
  'image',
];
const ALLOWED_CATEGORIES = new Set(['music', 'combat', 'sport', 'wisdom']);

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function sameNumber(left, right) {
  return Number.isFinite(Number(left)) && Number.isFinite(Number(right))
    && Math.abs(Number(left) - Number(right)) < 0.001;
}

function compareValue(errors, product, live, field) {
  if (product[field] !== live[field]) {
    errors.push(`${product.slug}: central ${field} differs from ${product.page}.`);
  }
}

const catalog = JSON.parse(await readFile(DATA_FILE, 'utf8'));
const { schemaVersion, batch, products } = catalog;
const errors = [];

if (schemaVersion !== 1) errors.push('Unsupported or missing product catalog schemaVersion.');
if (!batch?.id || !Number.isInteger(batch.year) || !Number.isInteger(batch.number)) {
  errors.push('Invalid batch metadata.');
}
if (!Number.isInteger(batch?.expectedProductCount) || batch.expectedProductCount <= 0) {
  errors.push('Batch expectedProductCount must be a positive integer.');
}
if (!Array.isArray(products)) errors.push('Catalog products must be an array.');

const safeProducts = Array.isArray(products) ? products : [];
if (batch?.expectedProductCount !== safeProducts.length) {
  errors.push(`Catalog expected ${batch?.expectedProductCount} products but contains ${safeProducts.length}.`);
}

const inventory = await buildProductInventory(ROOT);
const liveBatchProducts = inventory.products.filter((product) => product.batchId === batch?.id);
const liveByPage = new Map(liveBatchProducts.map((product) => [product.page, product]));
const catalogPages = new Set(safeProducts.map((product) => product.page));
const seen = {
  slug: new Set(),
  page: new Set(),
  image: new Set(),
};

if (inventory.summary.errors > 0) {
  errors.push(`Repository product inventory contains ${inventory.summary.errors} error(s).`);
}
if (liveBatchProducts.length !== batch?.expectedProductCount) {
  errors.push(`Live inventory contains ${liveBatchProducts.length} ${batch?.id} products; expected ${batch?.expectedProductCount}.`);
}

for (const live of liveBatchProducts) {
  if (!catalogPages.has(live.page)) errors.push(`${live.page}: live Batch 3 product is missing from central catalog.`);
}

for (const product of safeProducts) {
  for (const field of REQUIRED_FIELDS) {
    if (product[field] === undefined || product[field] === null || product[field] === '') {
      errors.push(`${product.slug || product.page || 'Unknown product'}: missing ${field}.`);
    }
  }

  for (const field of ['slug', 'page', 'image']) {
    if (seen[field].has(product[field])) errors.push(`${product.slug}: duplicate ${field} ${product[field]}.`);
    seen[field].add(product[field]);
  }

  if (product.page !== `${product.slug}.html`) errors.push(`${product.slug}: page must match slug.html.`);
  if (product.batchId !== batch?.id) errors.push(`${product.slug}: batchId differs from catalog batch.`);
  if (!ALLOWED_CATEGORIES.has(product.category)) errors.push(`${product.slug}: invalid category ${product.category}.`);
  if (!sameNumber(product.price, Number(product.price)) || product.price <= 0) errors.push(`${product.slug}: invalid price.`);
  if (product.currency !== 'EUR') errors.push(`${product.slug}: unsupported currency ${product.currency}.`);
  if (product.status !== 'active') errors.push(`${product.slug}: unsupported status ${product.status}.`);

  try {
    await access(join(ROOT, product.page));
  } catch {
    errors.push(`${product.slug}: source page not found (${product.page}).`);
  }

  try {
    await access(join(ROOT, product.image));
  } catch {
    errors.push(`${product.slug}: source image not found (${product.image}).`);
  }

  const live = liveByPage.get(product.page);
  if (!live) {
    errors.push(`${product.slug}: no live inventory record found for ${product.page}.`);
  } else {
    compareValue(errors, product, live, 'name');
    compareValue(errors, product, live, 'description');
    compareValue(errors, product, live, 'image');
    compareValue(errors, product, live, 'currency');
    compareValue(errors, product, live, 'availability');
    compareValue(errors, product, live, 'batchId');
    compareValue(errors, product, live, 'collection');
    compareValue(errors, product, live, 'category');
    if (!sameNumber(product.price, live.price)) errors.push(`${product.slug}: central price differs from ${product.page}.`);
  }

  try {
    const generated = await readFile(join(GENERATED_DIR, product.page), 'utf8');
    const escapedName = escapeHtml(product.name);
    if (!generated.includes(`<title>${escapedName} — ${product.collection} | Legend Stories Preview</title>`)) {
      errors.push(`${product.slug}: generated preview title mismatch.`);
    }
    if (!generated.includes(`data-product-slug="${product.slug}"`)) errors.push(`${product.slug}: generated slug metadata missing.`);
    if (!generated.includes(`data-batch-id="${product.batchId}"`)) errors.push(`${product.slug}: generated batch metadata missing.`);
    if (!generated.includes(`data-name="${escapedName}"`)) errors.push(`${product.slug}: generated cart name mismatch.`);
    if (!generated.includes(`data-price="${product.price}"`)) errors.push(`${product.slug}: generated cart price mismatch.`);
    if (!generated.includes(product.image)) errors.push(`${product.slug}: generated image mismatch.`);
  } catch {
    errors.push(`${product.slug}: generated preview not found.`);
  }
}

if (errors.length > 0) {
  console.error('\nProduct catalog validation failed:\n');
  errors.forEach((error) => console.error(`- ${error}`));
  process.exit(1);
}

const categoryCounts = safeProducts.reduce((counts, product) => {
  counts[product.category] = (counts[product.category] || 0) + 1;
  return counts;
}, {});

console.log(
  `Product catalog validation passed for ${safeProducts.length} products in ${batch.id}: ${JSON.stringify(categoryCounts)}.`,
);
