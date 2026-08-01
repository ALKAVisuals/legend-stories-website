import { readFile, writeFile } from 'node:fs/promises';

const appPath = new URL('../js/app.js', import.meta.url);
let source = await readFile(appPath, 'utf8');

function replaceExactly(before, after, label) {
  const first = source.indexOf(before);
  if (first < 0) {
    if (source.includes(after)) return;
    throw new Error(`${label}: expected source fragment was not found.`);
  }
  if (source.indexOf(before, first + before.length) >= 0) {
    throw new Error(`${label}: source fragment is not unique.`);
  }
  source = source.slice(0, first) + after + source.slice(first + before.length);
}

replaceExactly(
  "    localStorage.setItem('legendDiscountCode', state.discountCode);\n    localStorage.setItem('legendDiscountPercent', state.discountPercent);",
  "    localStorage.setItem('legendDiscountCode', state.discountCode);",
  'discount persistence',
);

replaceExactly(
  "    const savedDiscountCode = localStorage.getItem('legendDiscountCode');\n    const savedDiscountPercent = localStorage.getItem('legendDiscountPercent');",
  "    const savedDiscountCode = localStorage.getItem('legendDiscountCode');",
  'stored discount reads',
);

replaceExactly(
  "    if (savedDiscountCode) {\n      state.discountCode = savedDiscountCode;\n    }\n    if (savedDiscountPercent) {\n      state.discountPercent = parseInt(savedDiscountPercent) || 0;\n    }",
  "    const savedDiscount = commerceModule.resolveDiscount(savedDiscountCode || '');\n    state.discountCode = savedDiscount.code;\n    state.discountPercent = savedDiscount.percent;\n    localStorage.removeItem('legendDiscountPercent');\n    if (savedDiscountCode && !savedDiscount.valid) {\n      localStorage.removeItem('legendDiscountCode');\n    }",
  'stored discount validation',
);

replaceExactly(
  "  async function init() {\n    loadCart();  // Restore cart from localStorage\n    await loadCommerceModule();",
  "  async function init() {\n    await loadCommerceModule();\n    loadCart();  // Restore cart after commerce policies are available",
  'commerce initialization order',
);

replaceExactly(
  "      state.discountCode = discount.code;\n      state.discountPercent = percent;",
  "      state.discountCode = discount.code;\n      state.discountPercent = percent;\n      saveCart();",
  'valid discount persistence',
);

replaceExactly(
  "      state.discountCode = '';\n      state.discountPercent = 0;",
  "      state.discountCode = '';\n      state.discountPercent = 0;\n      saveCart();",
  'invalid discount persistence',
);

await writeFile(appPath, source, 'utf8');
console.log('Applied order state hardening to js/app.js.');
