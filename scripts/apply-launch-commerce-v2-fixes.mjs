import { createHash } from 'node:crypto';
import { readFile, readdir, writeFile } from 'node:fs/promises';

async function updateTextFile(path, transform) {
  const source = await readFile(path, 'utf8');
  const updated = transform(source);
  if (updated !== source) {
    await writeFile(path, updated, 'utf8');
    console.log(`Updated ${path}.`);
  } else {
    console.log(`${path} is already canonical.`);
  }
  return updated;
}

const templatePath = 'templates/product-page.html';
const template = await updateTextFile(templatePath, (source) => (
  source.replaceAll('Up to 50 × Up to 50 × 30 cm', 'Up to 50 × 30 cm')
));

if (!template.includes('Up to 50 × 30 cm · subtle wall accent')) {
  throw new Error('The canonical Compact production-box copy is missing from the product template.');
}
if (!template.includes('Up to 50 × 50 cm · maximum visual impact')) {
  throw new Error('The canonical Statement production-box copy is missing from the product template.');
}
if (!template.includes('Original proportions are always preserved.')) {
  throw new Error('The product template must explain that original artwork proportions are preserved.');
}
if (template.includes('Up to 50 × Up to')) {
  throw new Error('Duplicated production-box copy is still present in the product template.');
}

const templateSha256 = createHash('sha256').update(template).digest('hex');
const presentationFiles = (await readdir('data/products'))
  .filter((name) => name.endsWith('-presentation.json'))
  .sort();

if (presentationFiles.length !== 6) {
  throw new Error(`Expected 6 presentation manifests, found ${presentationFiles.length}.`);
}

for (const name of presentationFiles) {
  const path = `data/products/${name}`;
  await updateTextFile(path, (source) => {
    const manifest = JSON.parse(source);
    if (manifest.template?.path !== templatePath) {
      throw new Error(`${manifest.batchId || name}: unexpected product template path.`);
    }
    manifest.template.sha256 = templateSha256;
    return `${JSON.stringify(manifest, null, 2)}\n`;
  });
}

const orderQuoteTest = await updateTextFile('tests/order-quote.test.mjs', (source) => {
  const testTitle = "test('aggregates duplicate product lines without trusting client totals'";
  const start = source.indexOf(testTitle);
  const end = source.indexOf("\ntest('", start + testTitle.length);
  if (start < 0 || end < 0) {
    throw new Error('Unable to locate the duplicate-line order quote test.');
  }
  const block = source.slice(start, end).replace("countryCode: 'DE'", "countryCode: 'NL'");
  return source.slice(0, start) + block + source.slice(end);
});

const aggregateStart = orderQuoteTest.indexOf("test('aggregates duplicate product lines without trusting client totals'");
const aggregateEnd = orderQuoteTest.indexOf("\ntest('", aggregateStart + 1);
if (orderQuoteTest.slice(aggregateStart, aggregateEnd).includes("countryCode: 'DE'")) {
  throw new Error('The duplicate-line order quote test still uses a disabled market.');
}

const variantContractTest = await updateTextFile('tests/product-variants-contract.test.mjs', (source) => (
  source.replace(
    'assert.match(templateSource, /original proportions are preserved/i);',
    'assert.match(templateSource, /Original proportions are always preserved/i);',
  )
));

if (!variantContractTest.includes('assert.match(templateSource, /Original proportions are always preserved/i);')) {
  throw new Error('The product variant contract does not validate the canonical proportion-preservation copy.');
}
