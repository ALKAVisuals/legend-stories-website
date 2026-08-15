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
const COMPATIBLE_SOURCE_DEFAULTS = new Set([DEFAULT_PRODUCT_VARIANT_ID, 'statement-45']);
const COMPATIBLE_SOURCE_MEASUREMENTS = new Set(['production_box', 'width_height', 'longest_side']);
const CANONICAL_SIZE_COPY = 'Available in 30 cm and 45 cm, measured along the longest side.';
const LEGACY_SIZE_PATTERN = /50 × 50 cm|50 × 30 cm|statement-50x50|compact-50x30/i;

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function launchDescription(value) {
  let description = String(value?.description ?? value ?? '');
  const approvedSizeCopies = [
    /Available in Compact \(up to 50 × 30 cm\) and Statement \(up to 50 × 50 cm\)\. Original proportions are preserved\.?/i,
    /Available in Compact \(30 cm longest side\) and Statement \(45 cm longest side\)\. Original proportions are preserved\.?/i,
    /Available in 30 cm and 45 cm, measured along the longest side\.?/i,
  ];
  for (const pattern of approvedSizeCopies) {
    description = description.replace(pattern, CANONICAL_SIZE_COPY);
  }
  return description;
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

if (schemaVersion !== 2) errors.push('Batch 3 compatibility catalog schemaVersion must be 2.');
if (catalog.variantPolicy?.defaultVariantId
  && !COMPATIBLE_SOURCE_DEFAULTS.has(catalog.variantPolicy.defaultVariantId)) {
  errors.push('Batch 3 catalog has an unrecognized source default variant policy.');
}
if (catalog.variantPolicy?.sizeMeasurement
  && !COMPATIBLE_SOURCE_MEASUREMENTS.has(catalog.variantPolicy.sizeMeasurement)) {
  errors.push('Batch 3 catalog has an unrecognized source size-measurement policy.');
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
  if (LEGACY_SIZE_PATTERN.test(String(live.description || ''))) {
    errors.push(`${live.page}: live description still exposes a legacy 50 cm production size.`);
  }
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
  if (product.currency !== 'EUR') errors.push(`${product.slug}: unsupported currency ${product.currency}.`);
  if (product.status !== 'active') errors.push(`${product.slug}: unsupported status ${product.status}.`);
  if (LEGACY_SIZE_PATTERN.test(String(product.description || ''))) {
    errors.push(`${product.slug}: compatibility catalog description still exposes a legacy 50 cm production size.`);
  }

  try {
    const defaultVariant = resolveCatalogProductVariant(product, product.defaultVariantId);
    if (defaultVariant.id !== DEFAULT_PRODUCT_VARIANT_ID || !defaultVariant.isDefault) {
      errors.push(`${product.slug}: legacy default variant does not resolve to the approved Statement production box.`);
    }
  } catch (error) {
    errors.push(`${product.slug}: invalid default variant (${error.message}).`);
  }

  if (!Array.isArray(product.variants) || product.variants.length !== PRODUCT_VARIANTS.length) {
    errors.push(`${product.slug}: expected two source variants that resolve to the approved launch variants.`);
  } else {
    for (const policyVariant of PRODUCT_VARIANTS) {
      try {
        const actual = resolveCatalogProductVariant(product, policyVariant.id);
        for (const field of [
          'id',
          'label',
          'sizeLabel',
          'widthCm',
          'heightCm',
          'longestSideCm',
          'sizeCm',
          'price',
          'skuSuffix',
          'isDefault',
        ]) {
          if (actual[field] !== policyVariant[field]) {
            errors.push(`${product.slug}: resolved ${policyVariant.id}.${field} differs from launch policy.`);
          }
        }
      } catch (error) {
        errors.push(`${product.slug}: ${policyVariant.id} cannot be resolved (${error.message}).`);
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
    compareValue(errors, product, live, 'image');
    compareValue(errors, product, live, 'currency');
    compareValue(errors, product, live, 'availability');
    compareValue(errors, product, live, 'batchId');
    compareValue(errors, product, live, 'collection');
    compareValue(errors, product, live, 'category');
    if (launchDescription(product) !== launchDescription(live)) {
      errors.push(`${product.slug}: normalized launch description differs from ${product.page}.`);
    }
    if (!sameNumber(product.price, live.price)) errors.push(`${product.slug}: central default price differs from ${product.page}.`);
  }

  try {
    const defaultVariant = resolveCatalogProductVariant(product, product.defaultVariantId);
    const generated = await readFile(join(GENERATED_DIR, product.page), 'utf8');
    const escapedName = escapeHtml(product.name);
    const escapedDescription = escapeHtml(launchDescription(product));
    const authoritativeOfferName = `${product.name} — ${defaultVariant.label} (${defaultVariant.sizeLabel})`;

    if (!generated.includes(`<title>${escapedName} — ${product.collection} | Legend Stories Preview</title>`)) {
      errors.push(`${product.slug}: generated preview title mismatch.`);
    }
    if (!generated.includes(`content="${escapedDescription}"`)) errors.push(`${product.slug}: generated launch description mismatch.`);
    if (!generated.includes(`data-product-slug="${product.slug}"`)) errors.push(`${product.slug}: generated slug metadata missing.`);
    if (!generated.includes(`data-batch-id="${product.batchId}"`)) errors.push(`${product.slug}: generated batch metadata missing.`);
    if (!generated.includes(`data-name="${escapedName}"`)) errors.push(`${product.slug}: generated cart name mismatch.`);
    if (!generated.includes(`data-price="${defaultVariant.price}"`)) errors.push(`${product.slug}: generated default price mismatch.`);
    if (!generated.includes(`data-variant-id="${defaultVariant.id}"`)) errors.push(`${product.slug}: generated default variant missing.`);
    if (!generated.includes(`data-size-label="${defaultVariant.sizeLabel}"`)) errors.push(`${product.slug}: generated size label missing.`);
    if (!generated.includes(`data-width-cm="${defaultVariant.widthCm}"`)) errors.push(`${product.slug}: generated width metadata missing.`);
    if (!generated.includes(`data-height-cm="${defaultVariant.heightCm}"`)) errors.push(`${product.slug}: generated height metadata missing.`);
    if (!generated.includes(`data-longest-side-cm="${defaultVariant.longestSideCm}"`)) errors.push(`${product.slug}: generated longest-side metadata missing.`);
    if (!generated.includes(`data-size-cm="${defaultVariant.sizeCm}"`)) errors.push(`${product.slug}: generated compatibility size metadata missing.`);
    if (!generated.includes('From €35')) errors.push(`${product.slug}: generated from-price missing.`);
    if (!generated.includes('"offers":[')) errors.push(`${product.slug}: generated multi-offer structured data missing.`);
    if (!generated.includes(authoritativeOfferName)) errors.push(`${product.slug}: generated authoritative offer name missing.`);
    if (!generated.includes(`?variant=${defaultVariant.id}`)) errors.push(`${product.slug}: generated variant URL missing.`);
    if (!generated.includes(product.image)) errors.push(`${product.slug}: generated image mismatch.`);
    if (LEGACY_SIZE_PATTERN.test(generated)) {
      errors.push(`${product.slug}: generated preview still exposes a legacy 50 cm production variant.`);
    }
    if (!generated.includes('Compact: 30 cm longest side. Statement: 45 cm longest side.')) {
      errors.push(`${product.slug}: generated preview is missing canonical 30/45 cm size copy.`);
    }
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
  `Launch-variant product catalog validation passed for ${safeProducts.length} products in ${batch.id}: ${JSON.stringify(categoryCounts)}. Legacy source aliases resolve to canonical 30/45 cm production variants.`,
);