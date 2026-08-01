import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import {
  extractProductPresentation,
  templatizeProductPage,
  templateHash,
} from './product-page-template.mjs';

const ROOT = process.cwd();
const DATA_FILE = join(ROOT, 'data', 'products', '2026-batch-3.json');
const TEMPLATE_FILE = join(ROOT, 'templates', 'product-page.html');
const PRESENTATION_FILE = join(ROOT, 'data', 'products', '2026-batch-3-presentation.json');

function firstDifference(left, right) {
  const limit = Math.min(left.length, right.length);
  for (let index = 0; index < limit; index += 1) {
    if (left[index] !== right[index]) return index;
  }
  return limit;
}

const { batch, products } = JSON.parse(await readFile(DATA_FILE, 'utf8'));
const sortedProducts = [...products].sort((a, b) => a.page.localeCompare(b.page));
if (sortedProducts.length !== batch.expectedProductCount) {
  throw new Error(`Batch metadata expects ${batch.expectedProductCount} products, found ${sortedProducts.length}.`);
}

let template = null;
let referencePage = null;
const presentations = [];

for (const product of sortedProducts) {
  const html = await readFile(join(ROOT, product.page), 'utf8');
  const candidate = templatizeProductPage(html);
  const presentation = extractProductPresentation(html, product);
  presentations.push(presentation);

  if (!template) {
    template = candidate;
    referencePage = product.page;
    continue;
  }

  if (candidate !== template) {
    const index = firstDifference(template, candidate);
    const start = Math.max(0, index - 120);
    const end = index + 120;
    throw new Error(
      `${product.page}: static page structure differs from ${referencePage} near character ${index}.\n` +
      `Reference: ${JSON.stringify(template.slice(start, end))}\n` +
      `Candidate: ${JSON.stringify(candidate.slice(start, end))}`,
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
console.log(`Captured presentation data for ${presentations.length} products.`);
console.log(`Template SHA-256: ${presentationData.template.sha256}`);
