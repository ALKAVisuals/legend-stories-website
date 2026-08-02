import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { templateHash } from './product-page-generation.mjs';

const ROOT = process.cwd();
const config = JSON.parse(
  await readFile(join(ROOT, 'data/products/managed-page-batches.json'), 'utf8'),
);
const template = await readFile(join(ROOT, config.template), 'utf8');
const sha256 = templateHash(template);
let updated = 0;

for (const batch of config.batches || []) {
  const path = join(ROOT, batch.presentationFile);
  const presentation = JSON.parse(await readFile(path, 'utf8'));
  if (presentation.batchId !== batch.id) {
    throw new Error(`${batch.presentationFile}: expected ${batch.id}, found ${presentation.batchId}.`);
  }
  if (!presentation.template || presentation.template.path !== config.template) {
    throw new Error(`${batch.presentationFile}: template path does not match ${config.template}.`);
  }
  if (presentation.template.sha256 === sha256) continue;
  presentation.template.sha256 = sha256;
  await writeFile(path, `${JSON.stringify(presentation, null, 2)}\n`, 'utf8');
  updated += 1;
  console.log(`${batch.id}: synchronized template SHA-256.`);
}

console.log(`Managed template hash synchronization complete: ${updated} manifest(s) updated, sha256=${sha256}.`);
