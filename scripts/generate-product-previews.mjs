import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { resolveCatalogProductVariant } from '../js/commerce/product-variants.mjs';

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

function structuredData(product) {
  const variants = Array.isArray(product.variants) && product.variants.length
    ? product.variants
    : [{
        id: 'legacy',
        label: 'Standard',
        sizeCm: null,
        price: product.price,
        skuSuffix: 'standard',
        isDefault: true,
      }];
  return JSON.stringify({
    '@context': 'https://schema.org/',
    '@type': 'Product',
    name: product.name,
    image: product.image,
    description: product.description,
    brand: { '@type': 'Brand', name: 'Legend Stories' },
    offers: variants.map((variant) => ({
      '@type': 'Offer',
      name: variant.sizeCm ? `${product.name} — ${variant.sizeCm} cm` : product.name,
      sku: `${product.slug}-${variant.skuSuffix || variant.sizeCm || 'standard'}`,
      price: Number(variant.price).toFixed(2),
      priceCurrency: product.currency,
      availability: product.availability,
      url: variant.sizeCm ? `${product.page}?size=${variant.sizeCm}` : product.page,
    })),
  }).replaceAll('<', '\\u003c');
}

function render(template, product) {
  const defaultVariant = resolveCatalogProductVariant(product, product.defaultVariantId);
  const fromPrice = Math.min(...product.variants.map((variant) => Number(variant.price)));
  const values = {
    ...product,
    price: defaultVariant.price,
    priceFormatted: defaultVariant.price.toFixed(0),
    fromPriceFormatted: fromPrice.toFixed(0),
    variantId: defaultVariant.id,
    variantLabel: defaultVariant.label,
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

console.log(`Generated ${products.length} variant-aware product previews for ${batch.id}.`);