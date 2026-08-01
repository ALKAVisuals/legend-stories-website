import { readFile, writeFile } from 'node:fs/promises';

const appPath = new URL('../js/app.js', import.meta.url);
let source = await readFile(appPath, 'utf8');
const duplicate = '      saveCart();\n      saveCart();';
const matches = source.split(duplicate).length - 1;

if (matches === 0) {
  if (source.includes('      saveCart();')) {
    console.log('No duplicate cart persistence calls remain.');
    process.exit(0);
  }
  throw new Error('Expected cart persistence calls were not found.');
}

if (matches !== 2) {
  throw new Error(`Expected exactly 2 duplicate saveCart() pairs, found ${matches}.`);
}

source = source.replaceAll(duplicate, '      saveCart();');
await writeFile(appPath, source, 'utf8');
console.log('Removed duplicate cart persistence calls.');
