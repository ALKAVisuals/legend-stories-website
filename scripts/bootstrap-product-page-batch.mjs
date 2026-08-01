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
const NORMALIZE_LEGACY_PRESENTATION = process.argv.includes('--normalize-legacy-presentation');
const TEMPLATE_PATH = 'templates/product-page.html';

if (!BATCH_ID) {
  throw new Error(
    'Usage: node scripts/bootstrap-product-page-batch.mjs --batch=<batch-id> [--expected=<count>] [--normalize-legacy-presentation]',
  );
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
const presentationPath = join('data', 'products', `${BATCH_ID}-presentation.json`);
let existingTitlesByPage = new Map();
try {
  const existing = JSON.parse(await readFile(join(ROOT, presentationPath), 'utf8'));
  existingTitlesByPage = new Map(
    (existing.products || [])
      .filter((presentation) => presentation.pageTitle)
      .map((presentation) => [presentation.page, presentation.pageTitle]),
  );
} catch (error) {
  if (error.code !== 'ENOENT') throw error;
}
const presentations = [];
let referencePage = null;

for (const product of products) {
  const html = await readFile(join(ROOT, product.page), 'utf8');
  const candidate = normalizeTemplateStructure(templatizeProductPage(html));
  if (candidate !== normalizedTemplate) {
    throw new Error(`${product.page}: live structure differs from the approved shared product template.`);
  }

  const presentation = extractProductPresentation(html, product);
  const existingPageTitle = existingTitlesByPage.get(product.page);
  if (existingPageTitle) presentation.pageTitle = existingPageTitle;
  if (NORMALIZE_LEGACY_PRESENTATION) {
    presentation.imageAlt = `${product.name} — ${product.collection} Wall Sticker`;
    presentation.announcementHtml =
      `🔥 Batch ${batch.number} collection — use <span class="font-bold">LEGEND10</span> for 10% off`;
  }
  presentations.push(presentation);
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
if (NORMALIZE_LEGACY_PRESENTATION) {
  console.log('Normalized image alt text and announcement copy from central catalog batch data.');
}
console.log(`Template SHA-256: ${presentationData.template.sha256}`);
