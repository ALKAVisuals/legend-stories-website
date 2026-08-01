import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { renderProductPage } from './product-page-generation.mjs';

const ROOT = process.cwd();
const DATA_FILE = join(ROOT, 'data', 'products', '2026-batch-3.json');
const PRESENTATION_FILE = join(ROOT, 'data', 'products', '2026-batch-3-presentation.json');
const TEMPLATE_FILE = join(ROOT, 'templates', 'product-page.html');
const OUTPUT_DIR = join(ROOT, 'generated', 'product-pages', 'batch-3');
const WRITE_LIVE = process.argv.includes('--write-live');

const { batch, products } = JSON.parse(await readFile(DATA_FILE, 'utf8'));
const presentationData = JSON.parse(await readFile(PRESENTATION_FILE, 'utf8'));
const template = await readFile(TEMPLATE_FILE, 'utf8');
const presentationByPage = new Map(presentationData.products.map((entry) => [entry.page, entry]));

if (presentationData.batchId !== batch.id) {
  throw new Error(`Presentation data belongs to ${presentationData.batchId}, expected ${batch.id}.`);
}

await rm(OUTPUT_DIR, { recursive: true, force: true });
await mkdir(OUTPUT_DIR, { recursive: true });

for (const product of [...products].sort((a, b) => a.page.localeCompare(b.page))) {
  const presentation = presentationByPage.get(product.page);
  if (!presentation) throw new Error(`${product.page}: presentation data is missing.`);
  const html = renderProductPage(template, product, presentation);
  await writeFile(join(OUTPUT_DIR, product.page), html, 'utf8');
  if (WRITE_LIVE) await writeFile(join(ROOT, product.page), html, 'utf8');
}

console.log(`Generated ${products.length} Batch 3 product pages in ${OUTPUT_DIR}.`);
if (WRITE_LIVE) console.log(`Updated ${products.length} live Batch 3 product pages from the central template.`);
