import { access, readFile } from 'node:fs/promises';
import { join } from 'node:path';

import {
  DEFAULT_PRODUCT_VARIANT_ID,
  PRODUCT_VARIANTS,
  resolveCatalogProductVariant,
} from '../js/commerce/product-variants.mjs';
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
  'fromPrice',
  'defaultVariantId',
  'variants',
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

if (schemaVersion !== 2) errors.push('Batch 3 catalog schemaVersion must be 2.');
if (catalog.variantPolicy?.defaultVariantId !== DEFAULT_PRODUCT_VARIANT_ID) {
  errors.push('Batch 3 catalog has an invalid default variant policy.');
}
if (catalog.variantPolicy?.sizeMeasurement !== 'longest_side') {
  errors.push('Batch 3 catalog must measure sizes along the longest side.');
}
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
  if (product.price !== 45 || product.fromPrice !== 35) errors.push(`${product.slug}: expected €45 default and €35 from price.`);
  if (product.defaultVariantId !== DEFAULT_PRODUCT_VARIANT_ID) errors.push(`${product.slug}: invalid default variant.`);
  if (product.currency !== 'EUR') errors.push(`${product.slug}: unsupported currency ${product.currency}.`);
  if (product.status !== 'active') errors.push(`${product.slug}: unsupported status ${product.status}.`);

  if (!Array.isArray(product.variants) || product.variants.length !== PRODUCT_VARIANTS.length) {
    errors.push(`${product.slug}: expected two approved variants.`);
  } else {
    for (const policyVariant of PRODUCT_VARIANTS) {
      const actual = product.variants.find((variant) => variant.id === policyVariant.id);
      if (!actual) {
        errors.push(`${product.slug}: missing ${policyVariant.id}.`);
        continue;
      }
      for (const field of ['label', 'sizeCm', 'price', 'skuSuffix', 'isDefault']) {
        if (actual[field] !== policyVariant[field]) {
          errors.push(`${product.slug}: ${policyVariant.id}.${field} differs from policy.`);
        }
      }
    }
  }

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
    if (!sameNumber(product.price, live.price)) errors.push(`${product.slug}: central default price differs from ${product.page}.`);
  }

  try {
    const defaultVariant = resolveCatalogProductVariant(product, product.defaultVariantId);
    const generated = await readFile(join(GENERATED_DIR, product.page), 'utf8');
    const escapedName = escapeHtml(product.name);
    if (!generated.includes(`<title>${escapedName} — ${product.collection} | Legend Stories Preview</title>`)) {
      errors.push(`${product.slug}: generated preview title mismatch.`);
    }
    if (!generated.includes(`data-product-slug="${product.slug}"`)) errors.push(`${product.slug}: generated slug metadata missing.`);
    if (!generated.includes(`data-batch-id="${product.batchId}"`)) errors.push(`${product.slug}: generated batch metadata missing.`);
    if (!generated.includes(`data-name="${escapedName}"`)) errors.push(`${product.slug}: generated cart name mismatch.`);
    if (!generated.includes(`data-price="${defaultVariant.price}"`)) errors.push(`${product.slug}: generated default price mismatch.`);
    if (!generated.includes(`data-variant-id="${defaultVariant.id}"`)) errors.push(`${product.slug}: generated default variant missing.`);
    if (!generated.includes(`data-size-cm="${defaultVariant.sizeCm}"`)) errors.push(`${product.slug}: generated size metadata missing.`);
    if (!generated.includes('From €35')) errors.push(`${product.slug}: generated from-price missing.`);
    if (!generated.includes('"offers":[')) errors.push(`${product.slug}: generated multi-offer structured data missing.`);
    if (!generated.includes(product.image)) errors.push(`${product.slug}: generated image mismatch.`);
  } catch (error) {
    errors.push(`${product.slug}: generated preview invalid (${error.message}).`);
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
  `Variant-aware product catalog validation passed for ${safeProducts.length} products in ${batch.id}: ${JSON.stringify(categoryCounts)}.`,
);