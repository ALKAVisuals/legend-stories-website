import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import {
  getArgumentValue,
  loadManagedProductPageBatches,
} from './managed-product-page-data.mjs';
import { renderProductPage, templateHash } from './product-page-generation.mjs';

const ROOT = process.cwd();
const WRITE_LIVE = process.argv.includes('--write-live');
const BATCH_ID = getArgumentValue('batch');
const managed = await loadManagedProductPageBatches(ROOT, BATCH_ID);
const template = await readFile(join(ROOT, managed.template), 'utf8');

let generatedCount = 0;
for (const entry of managed.batches) {
  const presentationData = JSON.parse(
    await readFile(join(ROOT, entry.presentationFile), 'utf8'),
  );
  if (presentationData.batchId !== entry.id) {
    throw new Error(
      `${entry.presentationFile}: belongs to ${presentationData.batchId}, expected ${entry.id}.`,
    );
  }
  if (presentationData.template?.sha256 !== templateHash(template)) {
    throw new Error(`${entry.id}: presentation manifest uses a different product template.`);
  }

  const presentationByPage = new Map(
    presentationData.products.map((presentation) => [presentation.page, presentation]),
  );
  const outputDirectory = join(ROOT, entry.outputDirectory);
  await rm(outputDirectory, { recursive: true, force: true });
  await mkdir(outputDirectory, { recursive: true });

  for (const product of entry.products) {
    const presentation = presentationByPage.get(product.page);
    if (!presentation) throw new Error(`${product.page}: presentation data is missing.`);
    const html = renderProductPage(template, product, presentation);
    await writeFile(join(outputDirectory, product.page), html, 'utf8');
    if (WRITE_LIVE) await writeFile(join(ROOT, product.page), html, 'utf8');
    generatedCount += 1;
  }

  console.log(
    `Generated ${entry.products.length} ${entry.id} product pages in ${entry.outputDirectory}.`,
  );
  if (WRITE_LIVE) {
    console.log(`Updated ${entry.products.length} live ${entry.id} pages from the shared template.`);
  }
}

console.log(
  `Managed product page generation completed for ${generatedCount} page${generatedCount === 1 ? '' : 's'}.`,
);
