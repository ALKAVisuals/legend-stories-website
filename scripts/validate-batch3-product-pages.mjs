import { access, readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { loadBatch3ProductData } from './batch3-product-data.mjs';
import { extractProductFromHtml } from './product-inventory.mjs';
import {
  extractProductPresentation,
  normalizeTemplateStructure,
  templatizeProductPage,
  templateHash,
} from './product-page-template.mjs';

const ROOT = process.cwd();
const PRESENTATION_FILE = join(ROOT, 'data', 'products', '2026-batch-3-presentation.json');
const TEMPLATE_FILE = join(ROOT, 'templates', 'product-page.html');
const OUTPUT_DIR = join(ROOT, 'generated', 'product-pages', 'batch-3');
const REQUIRE_LIVE_MATCH = process.argv.includes('--live');

const { batch, products } = await loadBatch3ProductData(ROOT);
const presentationData = JSON.parse(await readFile(PRESENTATION_FILE, 'utf8'));
const template = await readFile(TEMPLATE_FILE, 'utf8');
const normalizedTemplate = normalizeTemplateStructure(template);
const presentationByPage = new Map(presentationData.products.map((entry) => [entry.page, entry]));
const errors = [];

if (templateHash(template) !== presentationData.template.sha256) {
  errors.push('The product template hash differs from the approved presentation manifest.');
}
if (products.length !== batch.expectedProductCount) {
  errors.push(`Batch contains ${products.length} products; expected ${batch.expectedProductCount}.`);
}
if (presentationData.products.length !== products.length) {
  errors.push(`Presentation manifest contains ${presentationData.products.length} products; expected ${products.length}.`);
}

const expectedFiles = new Set(products.map((product) => product.page));
const actualFiles = new Set((await readdir(OUTPUT_DIR)).filter((file) => file.endsWith('.html')));
for (const file of expectedFiles) if (!actualFiles.has(file)) errors.push(`${file}: generated page is missing.`);
for (const file of actualFiles) if (!expectedFiles.has(file)) errors.push(`${file}: stale generated page is present.`);

for (const product of products) {
  const presentation = presentationByPage.get(product.page);
  if (!presentation) {
    errors.push(`${product.page}: presentation data is missing.`);
    continue;
  }

  const generatedPath = join(OUTPUT_DIR, product.page);
  try {
    await access(generatedPath);
  } catch {
    continue;
  }

  const generated = await readFile(generatedPath, 'utf8');
  const live = await readFile(join(ROOT, product.page), 'utf8');

  try {
    if (normalizeTemplateStructure(templatizeProductPage(generated)) !== normalizedTemplate) {
      errors.push(`${product.page}: generated static structure differs from the shared template.`);
    }
    if (normalizeTemplateStructure(templatizeProductPage(live)) !== normalizedTemplate) {
      errors.push(`${product.page}: existing live static structure differs from the shared template.`);
    }
  } catch (error) {
    errors.push(`${product.page}: ${error.message}`);
  }

  const extracted = extractProductFromHtml(product.page, generated).product;
  if (!extracted) {
    errors.push(`${product.page}: generated Product JSON-LD could not be read.`);
  } else {
    const comparisons = [
      ['name', extracted.name, product.name],
      ['description', extracted.description, product.description],
      ['image', extracted.image, product.image],
      ['price', extracted.price, product.price],
      ['currency', extracted.currency, product.currency],
      ['availability', extracted.availability, product.availability],
      ['canonical', extracted.canonical, product.canonical],
      ['collection', extracted.collection, product.collection],
      ['category', extracted.category, product.category],
      ['batch', extracted.batchId, product.batchId],
    ];
    for (const [field, actual, expected] of comparisons) {
      if (actual !== expected) errors.push(`${product.page}: generated ${field} differs from full central product data.`);
    }
    if (extracted.errors.length) errors.push(...extracted.errors);
  }

  try {
    const generatedPresentation = extractProductPresentation(generated, product);
    if (JSON.stringify(generatedPresentation) !== JSON.stringify(presentation)) {
      errors.push(`${product.page}: generated presentation content differs from the presentation manifest.`);
    }
  } catch (error) {
    errors.push(`${product.page}: ${error.message}`);
  }

  if (REQUIRE_LIVE_MATCH && generated !== live) {
    errors.push(`${product.page}: live page is not the deterministic generated output.`);
  }
}

if (errors.length) {
  console.error('Batch 3 product page validation failed:');
  for (const error of errors) console.error(`- ${error}`);
  process.exitCode = 1;
} else {
  console.log(
    `Batch 3 product page validation passed for ${products.length} pages using one template and the full catalog` +
    `${REQUIRE_LIVE_MATCH ? ', with byte-identical live output' : ''}.`,
  );
}
