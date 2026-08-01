import { readFile, writeFile } from 'node:fs/promises';

const appPath = new URL('../js/app.js', import.meta.url);
let source = await readFile(appPath, 'utf8');

const helperBefore = "  function getCommerceTotals() {\n    if (!commerceModule) {\n      throw new Error('Commerce totals requested before the commerce module was loaded.');\n    }\n    return commerceModule.calculateCommerceTotals({\n      items: state.cart,\n      countryCode: state.shippingCountry,\n      discountPercent: state.discountPercent,\n    });\n  }";
const helperAfter = helperBefore.replace('getCommerceTotals()', 'getCommerceTotals(countryCode = state.shippingCountry)').replace('countryCode: state.shippingCountry', 'countryCode');

const calculationBefore = "    const validatedCountry = address.country;\n    const zone = SHIPPING_ZONES[validatedCountry] || SHIPPING_ZONES.OTHER;\n    const subtotal = getCartTotal();\n    const discount = getDiscountAmount(subtotal);\n    const discountedSubtotal = subtotal - discount;\n    const shipping = discountedSubtotal >= zone.freeFrom ? 0 : zone.cost;\n    const total = discountedSubtotal + shipping;";
const calculationAfter = "    const validatedCountry = address.country;\n    const totals = getCommerceTotals(validatedCountry);";

for (const [label, before, after] of [
  ['commerce helper', helperBefore, helperAfter],
  ['order calculation', calculationBefore, calculationAfter],
]) {
  if (!source.includes(before)) throw new Error(`${label} was not found.`);
  source = source.replace(before, after);
}

source = source.replace('shipping: { zone: zone.name, cost: shipping }', 'shipping: { zone: totals.zone.name, cost: totals.shipping }');
source = source.replace('subtotal: subtotal,', 'subtotal: totals.subtotal,');
source = source.replace('discount: discount,', 'discount: totals.discount,');
source = source.replace('total: total,', 'total: totals.grandTotal,');
source = source.replace("formatPrice(subtotal) + '\\nDiscount (' + state.discountPercent + '%): -' + formatPrice(discount) + '\\nShipping to ' + zone.name + ': ' + (shipping === 0 ? 'Free' : formatPrice(shipping)) + '\\nTotal: ' + formatPrice(total)", "formatPrice(totals.subtotal) + '\\nDiscount (' + state.discountPercent + '%): -' + formatPrice(totals.discount) + '\\nShipping to ' + totals.zone.name + ': ' + (totals.shipping === 0 ? 'Free' : formatPrice(totals.shipping)) + '\\nTotal: ' + formatPrice(totals.grandTotal)");

if (source.includes('SHIPPING_ZONES[validatedCountry]')) throw new Error('Legacy order shipping calculation remains.');
await writeFile(appPath, source, 'utf8');
console.log('Order totals migration applied successfully.');
