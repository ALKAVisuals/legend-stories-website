import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { getArgumentValue, loadCatalogBatch } from './managed-product-page-data.mjs';
import {
  extractProductPresentation,
  normalizeTemplateStructure,
  templatizeProductPage,
  templateHash,
} from './product-page-template.mjs';

const ROOT = process.cwd();
const BATCH_ID = getArgumentValue('batch');
const EXPECTED_COUNT_VALUE = getArgumentValue('expected');
const TEMPLATE_PATH = 'templates/product-page.html';

if (!BATCH_ID) {
  throw new Error('Usage: node scripts/bootstrap-product-page-batch.mjs --batch=<batch-id> [--expected=<count>]');
}

const { batch, products } = await loadCatalogBatch(ROOT, BATCH_ID);
const expectedCount = EXPECTED_COUNT_VALUE ? Number.parseInt(EXPECTED_COUNT_VALUE, 10) : products.length;
if (!Number.isInteger(expectedCount) || expectedCount < 1) {
  throw new Error(`${BATCH_ID}: --expected must be a positive integer.`);
}
if (products.length !== expectedCount) {
  throw new Error(`${BATCH_ID}: full catalog contains ${products.length} products; expected ${expectedCount}.`);
}

const template = await readFile(join(ROOT, TEMPLATE_PATH), 'utf8');
const normalizedTemplate = normalizeTemplateStructure(template);
const presentations = [];
let referencePage = null;

for (const product of products) {
  const html = await readFile(join(ROOT, product.page), 'utf8');
  const candidate = normalizeTemplateStructure(templatizeProductPage(html));
  if (candidate !== normalizedTemplate) {
    throw new Error(`${product.page}: live structure differs from the approved shared product template.`);
  }
  presentations.push(extractProductPresentation(html, product));
  referencePage ||= product.page;
}

const presentationData = {
  schemaVersion: 1,
  batchId: batch.id,
  template: {
    path: TEMPLATE_PATH,
    referencePage,
    sha256: templateHash(template),
  },
  products: presentations,
};

const presentationPath = join('data', 'products', `${BATCH_ID}-presentation.json`);
await mkdir(dirname(join(ROOT, presentationPath)), { recursive: true });
await writeFile(
  join(ROOT, presentationPath),
  `${JSON.stringify(presentationData, null, 2)}\n`,
  'utf8',
);

console.log(`Bootstrapped ${BATCH_ID} presentation data for ${products.length} products.`);
console.log(`Presentation manifest: ${presentationPath}`);
console.log(`Template SHA-256: ${presentationData.template.sha256}`);
