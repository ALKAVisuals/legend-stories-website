import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { DEFAULT_PRODUCT_VARIANT_ID, PRODUCT_VARIANTS, resolveCatalogProductVariant } from '../js/commerce/product-variants.mjs';
const ROOT = process.cwd();
const catalog = JSON.parse(await readFile(join(ROOT, 'data/products/catalog.json'), 'utf8'));
const template = await readFile(join(ROOT, 'templates/product-page.html'), 'utf8');
const app = await readFile(join(ROOT, 'js/app.js'), 'utf8');
const errors = [];
const keys = ["id", "label", "sizeLabel", "widthCm", "heightCm", "longestSideCm", "price", "skuSuffix", "isDefault"];
const expectedVariants = PRODUCT_VARIANTS.map((variant) => Object.fromEntries(keys.map((key) => [key, variant[key]])));
if (catalog.schemaVersion !== 3) errors.push('catalog schemaVersion must be 3.');
if (catalog.variantPolicy?.defaultVariantId !== DEFAULT_PRODUCT_VARIANT_ID) errors.push('catalog default variant is invalid.');
if (catalog.variantPolicy?.sizeMeasurement !== 'production_box') errors.push('catalog sizing must use production boxes.');
if (catalog.variantPolicy?.aspectRatio !== 'preserved') errors.push('catalog must preserve artwork proportions.');
for (const product of catalog.products || []) {
  if (product.price !== 45 || product.fromPrice !== 35) errors.push(`${product.page}: expected prices 35/45.`);
  if (product.defaultVariantId !== DEFAULT_PRODUCT_VARIANT_ID) errors.push(`${product.page}: incorrect default variant.`);
  const normalized = (product.variants || []).map((variant) => Object.fromEntries(keys.map((key) => [key, variant[key]])));
  if (JSON.stringify(normalized) !== JSON.stringify(expectedVariants)) errors.push(`${product.page}: variant policy differs.`);
  try { resolveCatalogProductVariant(product, 'compact-50x30'); resolveCatalogProductVariant(product, 'statement-50x50'); }
  catch (error) { errors.push(`${product.page}: ${error.message}`); }
}
if (!/value="statement-50x50" checked/.test(template)) errors.push('Statement 50×50 must be selected by default.');
if (!/value="compact-50x30"/.test(template)) errors.push('Compact 50×30 option is missing.');
if (!/production area/i.test(template)) errors.push('production-area sizing note is missing.');
if (!/CART_SCHEMA_VERSION = '4'/.test(app)) errors.push('cart schema must be version 4.');
if (!/International checkout opens per validated market/.test(app)) errors.push('market-gating notice is missing.');
const rootHtmlFiles = (await readdir(ROOT)).filter((file) => file.endsWith('.html'));
const productPages = new Set((catalog.products || []).map((product) => product.page));
let checked = 0;
for (const file of rootHtmlFiles) {
  const html = await readFile(join(ROOT, file), 'utf8');
  if (!productPages.has(file)) continue;
  checked += 1;
  if (!/data-variant-id="statement-50x50"/.test(html)) errors.push(`${file}: default variant missing.`);
  if (!/50 × 30 cm/.test(html) || !/50 × 50 cm/.test(html)) errors.push(`${file}: production box copy missing.`);
}
if (checked !== (catalog.products || []).length) errors.push(`checked ${checked} pages; expected ${(catalog.products || []).length}.`);
if (errors.length) { console.error('Product variant validation failed:'); errors.forEach((error) => console.error(`- ${error}`)); process.exitCode = 1; }
else console.log(`Product variant validation passed for ${checked} product pages.`);
