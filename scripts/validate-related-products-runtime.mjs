import { access, readFile } from 'node:fs/promises';
import { join } from 'node:path';

const ROOT = process.cwd();
const APP_FILE = join(ROOT, 'js/app.js');
const MODULE_FILE = join(ROOT, 'js/catalog/related-products.mjs');
const REGISTRY_FILE = join(ROOT, 'generated/public/data/product-registry.json');
const errors = [];

const appSource = await readFile(APP_FILE, 'utf8');
const moduleSource = await readFile(MODULE_FILE, 'utf8');

if (/\b(?:var|let|const)\s+PRODUCTS\s*=\s*\[/.test(appSource)) {
  errors.push('js/app.js contains a hard-coded PRODUCTS array.');
}
if (/PRODUCT DATABASE\s*-\s*Used for related products carousel/i.test(appSource)) {
  errors.push('js/app.js contains the removed related-products database marker.');
}
if (!/import\(\s*["']\.\/catalog\/related-products\.mjs["']\s*\)/.test(appSource)) {
  errors.push('js/app.js does not dynamically import the related-products catalog module.');
}
if (!/catalog\.loadProductRegistry\(document\.baseURI\)/.test(appSource)) {
  errors.push('js/app.js does not load the generated runtime product registry.');
}
if (!/catalog\.findCurrentProduct\(/.test(appSource)) {
  errors.push('js/app.js does not resolve the current product through the catalog module.');
}
if (!/catalog\.selectRelatedProducts\(/.test(appSource)) {
  errors.push('js/app.js does not select related products through the catalog module.');
}
if (!/export\s+(?:async\s+)?function\s+loadProductRegistry\b/.test(moduleSource)) {
  errors.push('related-products.mjs is missing loadProductRegistry export.');
}
if (!/export\s+(?:async\s+)?function\s+findCurrentProduct\b/.test(moduleSource)) {
  errors.push('related-products.mjs is missing findCurrentProduct export.');
}
if (!/export\s+(?:async\s+)?function\s+selectRelatedProducts\b/.test(moduleSource)) {
  errors.push('related-products.mjs is missing selectRelatedProducts export.');
}
if (!/COLLECTION_PAGE_FILES\s*=\s*Object\.freeze\(/.test(moduleSource)) {
  errors.push('related-products.mjs is missing the source-deployment collection page fallback list.');
}
if (!/export\s+function\s+parseCollectionProducts\b/.test(moduleSource)) {
  errors.push('related-products.mjs is missing collection-page product parsing.');
}
if (!/loadCollectionPageRegistry\(baseUri, fetchImpl\)/.test(moduleSource)) {
  errors.push('related-products.mjs does not fall back to collection pages when the generated registry is unavailable.');
}

try {
  await access(REGISTRY_FILE);
  const registry = JSON.parse(await readFile(REGISTRY_FILE, 'utf8'));
  if (registry.schemaVersion !== 1) errors.push('Generated runtime product registry schemaVersion must be 1.');
  if (!Array.isArray(registry.products) || registry.products.length < 100) {
    errors.push('Generated runtime product registry must contain at least 100 products.');
  }
} catch (error) {
  errors.push(`Generated runtime product registry is missing or invalid: ${error.message}`);
}

if (errors.length > 0) {
  console.error('\nRelated-products runtime validation failed:\n');
  errors.forEach((error) => console.error(`- ${error}`));
  process.exit(1);
}

console.log('Related-products runtime validation passed: build registry and source-deployment fallback are available.');
