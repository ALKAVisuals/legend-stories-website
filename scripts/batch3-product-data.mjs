import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

const BATCH_ID = '2026-batch-3';

function normalizeProduct(product) {
  return {
    ...product,
    batchId: product.batch?.id || null,
    batchYear: product.batch?.year || null,
    batchNumber: product.batch?.number || null,
  };
}

export async function loadBatch3ProductData(root = process.cwd()) {
  const batchSource = JSON.parse(
    await readFile(join(root, 'data', 'products', '2026-batch-3.json'), 'utf8'),
  );
  const catalog = JSON.parse(
    await readFile(join(root, 'data', 'products', 'catalog.json'), 'utf8'),
  );

  const products = catalog.products
    .filter((product) => product.batch?.id === BATCH_ID)
    .map(normalizeProduct)
    .sort((a, b) => a.page.localeCompare(b.page));

  const expectedPages = new Set(batchSource.products.map((product) => product.page));
  const actualPages = new Set(products.map((product) => product.page));

  if (products.length !== batchSource.batch.expectedProductCount) {
    throw new Error(
      `Full catalog contains ${products.length} ${BATCH_ID} products; expected ${batchSource.batch.expectedProductCount}.`,
    );
  }
  for (const page of expectedPages) {
    if (!actualPages.has(page)) throw new Error(`${page}: missing from the full Batch 3 catalog selection.`);
  }
  for (const page of actualPages) {
    if (!expectedPages.has(page)) throw new Error(`${page}: unexpected page in the full Batch 3 catalog selection.`);
  }

  return {
    batch: batchSource.batch,
    products,
  };
}
