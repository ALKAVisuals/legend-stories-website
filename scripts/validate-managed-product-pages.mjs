import { access, readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import {
  getArgumentValue,
  loadManagedProductPageBatches,
} from './managed-product-page-data.mjs';
import { extractProductFromHtml } from './product-inventory.mjs';
import {
  extractProductPresentation,
  normalizeTemplateStructure,
  templatizeProductPage,
  templateHash,
} from './product-page-template.mjs';

const ROOT = process.cwd();
const REQUIRE_LIVE_MATCH = process.argv.includes('--live');
const BATCH_ID = getArgumentValue('batch');
const managed = await loadManagedProductPageBatches(ROOT, BATCH_ID);
const template = await readFile(join(ROOT, managed.template), 'utf8');
const normalizedTemplate = normalizeTemplateStructure(template);
const approvedTemplateHash = templateHash(template);
const errors = [];
let validatedCount = 0;

for (const entry of managed.batches) {
  const presentationData = JSON.parse(
    await readFile(join(ROOT, entry.presentationFile), 'utf8'),
  );
  const presentationByPage = new Map(
    presentationData.products.map((presentation) => [presentation.page, presentation]),
  );

  if (presentationData.batchId !== entry.id) {
    errors.push(
      `${entry.presentationFile}: belongs to ${presentationData.batchId}, expected ${entry.id}.`,
    );
  }
  if (presentationData.template?.sha256 !== approvedTemplateHash) {
    errors.push(`${entry.id}: presentation manifest uses a different product template.`);
  }
  if (entry.products.length !== entry.expectedProductCount) {
    errors.push(
      `${entry.id}: catalog contains ${entry.products.length} products; expected ${entry.expectedProductCount}.`,
    );
  }
  if (presentationData.products.length !== entry.products.length) {
    errors.push(
      `${entry.id}: presentation manifest contains ${presentationData.products.length} products; expected ${entry.products.length}.`,
    );
  }

  const outputDirectory = join(ROOT, entry.outputDirectory);
  let outputFiles = [];
  try {
    outputFiles = (await readdir(outputDirectory)).filter((file) => file.endsWith('.html'));
  } catch {
    errors.push(`${entry.id}: generated output directory is missing.`);
    continue;
  }

  const expectedFiles = new Set(entry.products.map((product) => product.page));
  const actualFiles = new Set(outputFiles);
  for (const file of expectedFiles) {
    if (!actualFiles.has(file)) errors.push(`${entry.id}/${file}: generated page is missing.`);
  }
  for (const file of actualFiles) {
    if (!expectedFiles.has(file)) errors.push(`${entry.id}/${file}: stale generated page is present.`);
  }

  for (const product of entry.products) {
    const presentation = presentationByPage.get(product.page);
    if (!presentation) {
      errors.push(`${product.page}: presentation data is missing.`);
      continue;
    }

    const generatedPath = join(outputDirectory, product.page);
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
        errors.push(`${product.page}: live static structure differs from the shared template contract.`);
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
        if (actual !== expected) {
          errors.push(`${product.page}: generated ${field} differs from full central product data.`);
        }
      }
      if (extracted.errors.length) errors.push(...extracted.errors);
    }

    try {
      const generatedPresentation = extractProductPresentation(generated, product);
      if (JSON.stringify(generatedPresentation) !== JSON.stringify(presentation)) {
        errors.push(`${product.page}: generated presentation differs from its manifest.`);
      }
    } catch (error) {
      errors.push(`${product.page}: ${error.message}`);
    }

    if (REQUIRE_LIVE_MATCH && generated !== live) {
      errors.push(`${product.page}: live page is not byte-identical generated output.`);
    }
    validatedCount += 1;
  }
}

if (errors.length) {
  console.error('Managed product page validation failed:');
  for (const error of errors) console.error(`- ${error}`);
  process.exitCode = 1;
} else {
  console.log(
    `Managed product page validation passed for ${validatedCount} pages across ${managed.batches.length} batch${managed.batches.length === 1 ? '' : 'es'}` +
    `${REQUIRE_LIVE_MATCH ? ', with byte-identical live output' : ''}.`,
  );
}
