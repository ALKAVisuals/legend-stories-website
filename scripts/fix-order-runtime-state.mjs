import { readFile, writeFile } from 'node:fs/promises';

const APP_PATH = new URL('../js/app.js', import.meta.url);
let source = await readFile(APP_PATH, 'utf8');

function replaceOnce(pattern, replacement, label, completedMarker = '') {
  if (completedMarker && source.includes(completedMarker)) return;
  const flags = pattern.flags.includes('g') ? pattern.flags : `${pattern.flags}g`;
  const matches = [...source.matchAll(new RegExp(pattern.source, flags))];
  if (matches.length !== 1) {
    throw new Error(`${label}: expected exactly one match, found ${matches.length}.`);
  }
  source = source.replace(pattern, replacement);
}

replaceOnce(
  /    localStorage\.setItem\('legendDiscountCode', state\.discountCode\);\n    localStorage\.setItem\('legendDiscountPercent', state\.discountPercent\);/,
  "    localStorage.setItem('legendDiscountCode', state.discountCode);",
  'discount persistence',
  "localStorage.setItem('legendDiscountCode', state.discountCode);\n  }",
);

replaceOnce(
  /    const savedDiscountCode = localStorage\.getItem\('legendDiscountCode'\);\n    const savedDiscountPercent = localStorage\.getItem\('legendDiscountPercent'\);/,
  "    const savedDiscountCode = localStorage.getItem('legendDiscountCode');",
  'stored discount percentage read',
);

replaceOnce(
  /    if \(savedDiscountCode\) \{\n      state\.discountCode = savedDiscountCode;\n    \}\n    if \(savedDiscountPercent\) \{\n      state\.discountPercent = parseInt\(savedDiscountPercent\) \|\| 0;\n    \}/,
  `    const savedDiscount = commerceModule.resolveDiscount(savedDiscountCode || '');\n    state.discountCode = savedDiscount.code;\n    state.discountPercent = savedDiscount.percent;\n    localStorage.removeItem('legendDiscountPercent');\n    if (savedDiscountCode && !savedDiscount.valid) {\n      localStorage.removeItem('legendDiscountCode');\n    }`,
  'stored discount revalidation',
  "const savedDiscount = commerceModule.resolveDiscount(savedDiscountCode || '');",
);

replaceOnce(
  /  async function init\(\) \{\n    loadCart\(\);  \/\/ Restore cart from localStorage\n    await loadCommerceModule\(\);/,
  `  async function init() {\n    await loadCommerceModule();\n    loadCart();  // Restore cart after commerce policies are available`,
  'commerce initialization order',
  'loadCart();  // Restore cart after commerce policies are available',
);

replaceOnce(
  /      state\.discountCode = discount\.code;\n      state\.discountPercent = percent;/,
  `      state.discountCode = discount.code;\n      state.discountPercent = percent;\n      saveCart();`,
  'valid discount persistence',
  'state.discountPercent = percent;\n      saveCart();',
);

replaceOnce(
  /      state\.discountCode = '';\n      state\.discountPercent = 0;/,
  `      state.discountCode = '';\n      state.discountPercent = 0;\n      saveCart();`,
  'invalid discount persistence',
  "state.discountPercent = 0;\n      saveCart();",
);

await writeFile(APP_PATH, source, 'utf8');
console.log('Revalidated stored discounts and aligned cart initialization with commerce policies.');
