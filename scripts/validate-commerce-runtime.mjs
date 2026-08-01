import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../js/app.js', import.meta.url), 'utf8');
const errors = [];

if (!source.includes("import('./commerce/totals.mjs')")) {
  errors.push('app.js must load the centralized commerce totals module.');
}
if (!source.includes('commerceModule.calculateCommerceTotals')) {
  errors.push('app.js must delegate totals to calculateCommerceTotals().');
}
if (source.includes('const SHIPPING_ZONES =')) {
  errors.push('app.js must not contain a duplicate SHIPPING_ZONES table.');
}
if (/return state\.cart\.reduce\(\(sum, item\) => sum \+ item\.price \* item\.quantity/.test(source)) {
  errors.push('app.js must not calculate cart subtotal independently.');
}
if (/discountedSubtotal >= zone\.freeFrom/.test(source)) {
  errors.push('app.js must not calculate shipping thresholds independently.');
}
if (!/async function init\(\)[\s\S]*await loadCommerceModule\(\)/.test(source)) {
  errors.push('app initialization must await the commerce module.');
}

if (errors.length) {
  console.error('Commerce runtime validation failed:');
  errors.forEach((error) => console.error(`- ${error}`));
  process.exit(1);
}

console.log('Commerce runtime validation passed.');
