import { readFile, writeFile } from 'node:fs/promises';

const appPath = new URL('../js/app.js', import.meta.url);
let source = await readFile(appPath, 'utf8');

function replaceOnce(label, pattern, replacement) {
  const matches = source.match(pattern);
  if (!matches) throw new Error(`Migration failed: ${label} was not found.`);
  source = source.replace(pattern, replacement);
}

replaceOnce(
  'shipping configuration',
  /  \/\/ ==========================================\n  \/\/ SHIPPING CONFIG\n  \/\/ ==========================================\n  const SHIPPING_ZONES = \{[\s\S]*?\n  \};\n\n/,
  `  // ==========================================\n  // COMMERCE RUNTIME - Single calculation authority\n  // ==========================================\n  let commerceModule = null;\n  let commerceModulePromise = null;\n\n  function loadCommerceModule() {\n    if (!commerceModulePromise) {\n      commerceModulePromise = import('./commerce/totals.mjs').then((module) => {\n        commerceModule = module;\n        return module;\n      });\n    }\n    return commerceModulePromise;\n  }\n\n  function getCommerceTotals() {\n    if (!commerceModule) {\n      throw new Error('Commerce totals requested before the commerce module was loaded.');\n    }\n    return commerceModule.calculateCommerceTotals({\n      items: state.cart,\n      countryCode: state.shippingCountry,\n      discountPercent: state.discountPercent,\n    });\n  }\n\n`
);

replaceOnce(
  'legacy cart total functions',
  /  function getCartTotal\(\) \{[\s\S]*?\n  function setShippingCountry\(code\) \{/,
  `  function getCartTotal() {\n    return getCommerceTotals().subtotal;\n  }\n\n  function getShippingCost() {\n    const totals = getCommerceTotals();\n    state.shippingCost = totals.shipping;\n    return totals.shipping;\n  }\n\n  function getGrandTotal() {\n    return getCommerceTotals().grandTotal;\n  }\n\n  function setShippingCountry(code) {`
);

replaceOnce(
  'cart total variables',
  /    const cartSubtotal = getCartTotal\(\);\n    const shippingCost = getShippingCost\(\);\n    const zone = SHIPPING_ZONES\[state\.shippingCountry\] \|\| SHIPPING_ZONES\.OTHER;/,
  `    const totals = getCommerceTotals();\n    const cartSubtotal = totals.subtotal;\n    const shippingCost = totals.shipping;\n    const zone = totals.zone;`
);

replaceOnce(
  'cart discount row',
  /formatPrice\(getDiscountAmount\(cartSubtotal\)\)/,
  'formatPrice(totals.discount)'
);

replaceOnce(
  'cart discounted total',
  /    \/\/ Update cart total to show discounted total\n    const discountedTotal = cartSubtotal - \(state\.discountPercent > 0 \? getDiscountAmount\(cartSubtotal\) : 0\);\n    if \(dom\.cartTotal\) dom\.cartTotal\.textContent = formatPrice\(discountedTotal\);/,
  `    // Cart drawer total excludes shipping because shipping is shown at checkout.\n    if (dom.cartTotal) dom.cartTotal.textContent = formatPrice(totals.discountedSubtotal);`
);

replaceOnce(
  'checkout totals function',
  /  function updateCheckoutTotals\(\) \{[\s\S]*?\n  \}\n\n  let validatedAddress = null;/,
  `  function updateCheckoutTotals() {\n    const totals = getCommerceTotals();\n    const subtotalEl = document.getElementById('checkout-subtotal');\n    const shippingEl = document.getElementById('checkout-shipping');\n    const grandTotalEl = document.getElementById('checkout-grandtotal');\n    const discountEl = document.getElementById('checkout-discount-amount');\n    const noteEl = document.getElementById('checkout-shipping-note');\n\n    if (subtotalEl) subtotalEl.textContent = formatPrice(totals.subtotal);\n    if (discountEl) {\n      discountEl.textContent = totals.discount > 0 ? '-' + formatPrice(totals.discount) : '€0,00';\n      discountEl.parentElement.classList.toggle('hidden', totals.discount === 0);\n    }\n    if (shippingEl) shippingEl.textContent = totals.shipping === 0 ? 'Free' : formatPrice(totals.shipping);\n    if (grandTotalEl) grandTotalEl.textContent = formatPrice(totals.grandTotal);\n    if (noteEl) {\n      if (totals.qualifiesForFreeShipping) {\n        noteEl.textContent = '✓ Free shipping to ' + totals.zone.name;\n      } else {\n        noteEl.textContent = 'Add ' + formatPrice(totals.freeShippingRemaining) + ' more for free shipping to ' + totals.zone.name;\n      }\n    }\n  }\n\n  let validatedAddress = null;`
);

replaceOnce(
  'discount calculation helper',
  /  function getDiscountAmount\(subtotal\) \{\n    return subtotal \* \(state\.discountPercent \/ 100\);\n  \}/,
  `  function getDiscountAmount() {\n    return getCommerceTotals().discount;\n  }`
);

replaceOnce(
  'initialization function',
  /  function init\(\) \{\n    loadCart\(\);  \/\/ Restore cart from localStorage/,
  `  async function init() {\n    loadCart();  // Restore cart from localStorage\n    await loadCommerceModule();`
);

replaceOnce(
  'DOMContentLoaded initialization',
  /  if \(document\.readyState === 'loading'\) \{\n    document\.addEventListener\('DOMContentLoaded', init\);\n  \} else \{\n    init\(\);\n  \}/,
  `  function startApp() {\n    init().catch((error) => {\n      console.error('LegendMural app initialization failed:', error);\n    });\n  }\n\n  if (document.readyState === 'loading') {\n    document.addEventListener('DOMContentLoaded', startApp);\n  } else {\n    startApp();\n  }`
);

if (source.includes('const SHIPPING_ZONES =')) {
  throw new Error('Migration failed: legacy SHIPPING_ZONES remains in app.js.');
}
if (!source.includes("import('./commerce/totals.mjs')")) {
  throw new Error('Migration failed: commerce module import is missing.');
}
if (!source.includes('const totals = getCommerceTotals();')) {
  throw new Error('Migration failed: centralized totals are not used.');
}

await writeFile(appPath, source, 'utf8');
console.log('Commerce runtime migration applied successfully.');
