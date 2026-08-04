import { readFile, writeFile } from 'node:fs/promises';

const file = new URL('./validate-commerce-runtime.mjs', import.meta.url);
let source = await readFile(file, 'utf8');

const legacyCheck = `if (!/const product = \\{[\\s\\S]*?sizeCm: variant\\.sizeCm,/.test(source)) {
  errors.push('cart items must store the selected size for display and persistence.');
}`;

const productionBoxCheck = `if (!/const product = \\{[\\s\\S]*?sizeCm: variant\\.longestSideCm,[\\s\\S]*?sizeLabel: variant\\.sizeLabel,[\\s\\S]*?widthCm: variant\\.widthCm,[\\s\\S]*?heightCm: variant\\.heightCm,/.test(source)) {
  errors.push('cart items must store the selected production box for display and persistence.');
}`;

if (!source.includes(productionBoxCheck)) {
  if (!source.includes(legacyCheck)) {
    throw new Error('Commerce runtime size validation block was not found.');
  }
  source = source.replace(legacyCheck, productionBoxCheck);
  await writeFile(file, source, 'utf8');
}

console.log('Commerce runtime validator is aligned with production-box variants.');
