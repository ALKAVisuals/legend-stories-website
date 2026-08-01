import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

const CONFIG_FILE = join('data', 'products', 'managed-page-batches.json');
const CATALOG_FILE = join('data', 'products', 'catalog.json');

function normalizeProduct(product) {
  return {
    ...product,
    batchId: product.batch?.id || null,
    batchYear: product.batch?.year || null,
    batchNumber: product.batch?.number || null,
  };
}

export function getArgumentValue(name, args = process.argv.slice(2)) {
  const prefix = `--${name}=`;
  const argument = args.find((value) => value.startsWith(prefix));
  return argument ? argument.slice(prefix.length) : null;
}

export async function loadCatalogBatch(root, batchId) {
  if (!batchId) throw new Error('A batch id is required.');

  const catalog = JSON.parse(await readFile(join(root, CATALOG_FILE), 'utf8'));
  const products = catalog.products
    .filter((product) => product.batch?.id === batchId)
    .map(normalizeProduct)
    .sort((a, b) => a.page.localeCompare(b.page));

  if (!products.length) throw new Error(`${batchId}: no products were found in the full catalog.`);

  const batchNumbers = new Set(products.map((product) => product.batchNumber));
  const batchYears = new Set(products.map((product) => product.batchYear));
  if (batchNumbers.size !== 1 || batchYears.size !== 1) {
    throw new Error(`${batchId}: catalog products do not share one batch year and number.`);
  }

  return {
    batch: {
      id: batchId,
      year: products[0].batchYear,
      number: products[0].batchNumber,
      expectedProductCount: products.length,
    },
    products,
  };
}

export async function loadManagedProductPageConfig(root = process.cwd()) {
  const config = JSON.parse(await readFile(join(root, CONFIG_FILE), 'utf8'));
  if (config.schemaVersion !== 1) {
    throw new Error(`Unsupported managed product page schema: ${config.schemaVersion}.`);
  }
  if (!config.template || !Array.isArray(config.batches) || !config.batches.length) {
    throw new Error('Managed product page config requires a template and at least one batch.');
  }

  const ids = new Set();
  for (const batch of config.batches) {
    if (!batch.id || !batch.presentationFile || !batch.outputDirectory) {
      throw new Error('Every managed batch requires id, presentationFile and outputDirectory.');
    }
    if (!Number.isInteger(batch.expectedProductCount) || batch.expectedProductCount < 1) {
      throw new Error(`${batch.id}: expectedProductCount must be a positive integer.`);
    }
    if (ids.has(batch.id)) throw new Error(`${batch.id}: duplicate managed batch entry.`);
    ids.add(batch.id);
  }

  return config;
}

export async function loadManagedProductPageBatches(root = process.cwd(), batchId = null) {
  const config = await loadManagedProductPageConfig(root);
  const selected = batchId
    ? config.batches.filter((batch) => batch.id === batchId)
    : config.batches;

  if (batchId && selected.length !== 1) {
    throw new Error(`${batchId}: batch is not enabled in managed-page-batches.json.`);
  }

  const batches = [];
  for (const entry of selected) {
    const { batch, products } = await loadCatalogBatch(root, entry.id);
    if (products.length !== entry.expectedProductCount) {
      throw new Error(
        `${entry.id}: full catalog contains ${products.length} products; expected ${entry.expectedProductCount}.`,
      );
    }
    batches.push({
      ...entry,
      batch: {
        ...batch,
        expectedProductCount: entry.expectedProductCount,
      },
      products,
    });
  }

  return {
    schemaVersion: config.schemaVersion,
    template: config.template,
    batches,
  };
}
