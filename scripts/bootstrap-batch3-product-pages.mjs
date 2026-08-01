import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { loadBatch3ProductData } from './batch3-product-data.mjs';
import {
  extractProductPresentation,
  normalizeTemplateStructure,
  templatizeProductPage,
  templateHash,
} from './product-page-template.mjs';

const ROOT = process.cwd();
const TEMPLATE_FILE = join(ROOT, 'templates', 'product-page.html');
const PRESENTATION_FILE = join(ROOT, 'data', 'products', '2026-batch-3-presentation.json');

function firstDifference(left, right) {
  const limit = Math.min(left.length, right.length);
  for (let index = 0; index < limit; index += 1) {
    if (left[index] !== right[index]) return index;
  }
  return limit;
}

const { batch, products } = await loadBatch3ProductData(ROOT);
let template = null;
let normalizedTemplate = null;
let referencePage = null;
const presentations = [];

for (const product of products) {
  const html = await readFile(join(ROOT, product.page), 'utf8');
  const candidate = templatizeProductPage(html);
  const normalizedCandidate = normalizeTemplateStructure(candidate);
  const presentation = extractProductPresentation(html, product);
  presentations.push(presentation);

  if (!template) {
    template = candidate;
    normalizedTemplate = normalizedCandidate;
    referencePage = product.page;
    continue;
  }

  if (normalizedCandidate !== normalizedTemplate) {
    const index = firstDifference(normalizedTemplate, normalizedCandidate);
    const start = Math.max(0, index - 120);
    const end = index + 120;
    throw new Error(
      `${product.page}: static page structure differs from ${referencePage} near normalized character ${index}.\n` +
      `Reference: ${JSON.stringify(normalizedTemplate.slice(start, end))}\n` +
      `Candidate: ${JSON.stringify(normalizedCandidate.slice(start, end))}`,
    );
  }
}

const presentationData = {
  schemaVersion: 1,
  batchId: batch.id,
  template: {
    path: 'templates/product-page.html',
    referencePage,
    sha256: templateHash(template),
  },
  products: presentations,
};

await mkdir(dirname(TEMPLATE_FILE), { recursive: true });
await mkdir(dirname(PRESENTATION_FILE), { recursive: true });
await writeFile(TEMPLATE_FILE, template, 'utf8');
await writeFile(PRESENTATION_FILE, `${JSON.stringify(presentationData, null, 2)}\n`, 'utf8');

console.log(`Bootstrapped one Batch 3 product template from ${referencePage}.`);
console.log(`Captured presentation data for ${presentations.length} products from the full catalog.`);
console.log(`Template SHA-256: ${presentationData.template.sha256}`);
