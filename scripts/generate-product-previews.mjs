import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import {
  PRODUCT_VARIANTS,
  resolveCatalogProductVariant,
} from '../js/commerce/product-variants.mjs';

const ROOT = process.cwd();
const DATA_FILE = join(ROOT, 'data/products/2026-batch-3.json');
const TEMPLATE_FILE = join(ROOT, 'templates/product-preview.html');
const OUTPUT_DIR = join(ROOT, 'generated/product-previews');

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function canonicalVariants(product) {
  return PRODUCT_VARIANTS.map((policyVariant) => (
    resolveCatalogProductVariant(product, policyVariant.id)
  ));
}

function launchDescription(product) {
  return String(product.description || '').replace(
    /Available in 30 cm and 45 cm, measured along the longest side\.?/i,
    'Available in Compact (up to 50 × 30 cm) and Statement (up to 50 × 50 cm). Original proportions are preserved.',
  );
}

function structuredData(product) {
  const variants = canonicalVariants(product);
  return JSON.stringify({
    '@context': 'https://schema.org/',
    '@type': 'Product',
    name: product.name,
    image: product.image,
    description: launchDescription(product),
    brand: { '@type': 'Brand', name: 'Legend Stories' },
    offers: variants.map((variant) => ({
      '@type': 'Offer',
      name: `${product.name} — ${variant.label} (${variant.sizeLabel})`,
      sku: `${product.slug}-${variant.skuSuffix}`,
      price: Number(variant.price).toFixed(2),
      priceCurrency: product.currency,
      availability: product.availability,
      url: `${product.page}?variant=${variant.id}`,
    })),
  }).replaceAll('<', '\\u003c');
}

function render(template, product) {
  const variants = canonicalVariants(product);
  const defaultVariant = resolveCatalogProductVariant(product, product.defaultVariantId);
  const fromPrice = Math.min(...variants.map((variant) => Number(variant.price)));
  const values = {
    ...product,
    description: launchDescription(product),
    price: defaultVariant.price,
    priceFormatted: defaultVariant.price.toFixed(0),
    fromPriceFormatted: fromPrice.toFixed(0),
    variantId: defaultVariant.id,
    variantLabel: defaultVariant.label,
    sizeLabel: defaultVariant.sizeLabel,
    widthCm: defaultVariant.widthCm,
    heightCm: defaultVariant.heightCm,
    longestSideCm: defaultVariant.longestSideCm,
    sizeCm: defaultVariant.sizeCm,
    structuredData: structuredData(product),
  };

  return template.replace(/{{([a-zA-Z]+)}}/g, (_, key) => {
    if (!(key in values)) throw new Error(`Missing template value: ${key}`);
    return key === 'structuredData' ? values[key] : escapeHtml(values[key]);
  });
}

const { batch, products } = JSON.parse(await readFile(DATA_FILE, 'utf8'));
const template = await readFile(TEMPLATE_FILE, 'utf8');

await rm(OUTPUT_DIR, { recursive: true, force: true });
await mkdir(OUTPUT_DIR, { recursive: true });

for (const product of [...products].sort((a, b) => a.page.localeCompare(b.page))) {
  await writeFile(join(OUTPUT_DIR, product.page), render(template, product), 'utf8');
}

console.log(
  `Generated ${products.length} launch-variant product previews for ${batch.id} with legacy aliases normalized.`,
);
