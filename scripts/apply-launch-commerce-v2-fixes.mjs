import { readFile, writeFile } from 'node:fs/promises';

const templatePath = 'templates/product-page.html';
const duplicateCompactCopy = 'Up to 50 × Up to 50 × 30 cm';
const canonicalCompactCopy = 'Up to 50 × 30 cm';

const source = await readFile(templatePath, 'utf8');
const updated = source.replaceAll(duplicateCompactCopy, canonicalCompactCopy);

if (!updated.includes(`${canonicalCompactCopy} · subtle wall accent`)) {
  throw new Error('The canonical Compact production-box copy is missing from the product template.');
}
if (!updated.includes('Up to 50 × 50 cm · maximum visual impact')) {
  throw new Error('The canonical Statement production-box copy is missing from the product template.');
}
if (!updated.includes('Original proportions are always preserved.')) {
  throw new Error('The product template must explain that original artwork proportions are preserved.');
}
if (updated.includes(duplicateCompactCopy)) {
  throw new Error('The duplicated Compact production-box copy is still present.');
}

if (updated !== source) {
  await writeFile(templatePath, updated, 'utf8');
  console.log('Restored canonical production-box copy in the product template.');
} else {
  console.log('Product template copy is already canonical.');
}
