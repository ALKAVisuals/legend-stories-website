import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../js/app.js', import.meta.url), 'utf8');
const errors = [];

if (!source.includes("import('./commerce/totals.mjs')")) {
  errors.push('app.js must load the centralized commerce totals module.');
}
if (!source.includes("import('./commerce/discounts.mjs')")) {
  errors.push('app.js must load the centralized discount policy.');
}
if (!source.includes("import('./commerce/order-request.mjs')")) {
  errors.push('app.js must load the trusted order request builder.');
}
if (!source.includes('commerceModule.calculateCommerceTotals')) {
  errors.push('app.js must delegate totals to calculateCommerceTotals().');
}
if (!source.includes('commerceModule.resolveDiscount')) {
  errors.push('app.js must resolve discount codes through the shared policy.');
}
if (!source.includes('commerceModule.createOrderRequest')) {
  errors.push('app.js must build a minimal trusted order request before payment.');
}
if (!source.includes("sessionStorage.setItem('legendOrderRequest'")) {
  errors.push('app.js must store the minimal order request separately from display data.');
}
if (!source.includes('page: page,')) {
  errors.push('cart items must store a stable product page identifier.');
}
if (!source.includes("const savedDiscount = commerceModule.resolveDiscount(savedDiscountCode || '')")) {
  errors.push('stored discount codes must be revalidated through the central policy.');
}
if (source.includes("localStorage.setItem('legendDiscountPercent'")) {
  errors.push('app.js must not persist a browser-controlled discount percentage.');
}
if (source.includes("localStorage.getItem('legendDiscountPercent'")) {
  errors.push('app.js must not trust a stored browser discount percentage.');
}
if (/saveCart\(\);\s*saveCart\(\);/.test(source)) {
  errors.push('app.js must not persist the same cart state twice in succession.');
}
if (source.includes('const SHIPPING_ZONES =')) {
  errors.push('app.js must not contain a duplicate SHIPPING_ZONES table.');
}
if (source.includes('const VALID_DISCOUNT_CODES =')) {
  errors.push('app.js must not contain a duplicate discount-code table.');
}
if (/return state\.cart\.reduce\(\(sum, item\) => sum \+ item\.price \* item\.quantity/.test(source)) {
  errors.push('app.js must not calculate cart subtotal independently.');
}
if (/discountedSubtotal >= zone\.freeFrom/.test(source)) {
  errors.push('app.js must not calculate shipping thresholds independently.');
}
if (!/async function init\(\) \{\s*await loadCommerceModule\(\);\s*loadCart\(\)/.test(source)) {
  errors.push('app initialization must load commerce policies before restoring cart state.');
}

if (errors.length) {
  console.error('Commerce runtime validation failed:');
  errors.forEach((error) => console.error(`- ${error}`));
  process.exit(1);
}

console.log('Commerce runtime validation passed with stable product identities, revalidated discounts and single-write cart persistence.');
