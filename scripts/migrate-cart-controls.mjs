import { readFile, writeFile } from 'node:fs/promises';

function replaceRequired(source, pattern, replacement, label) {
  const flags = pattern instanceof RegExp
    ? (pattern.flags.includes('g') ? pattern.flags : `${pattern.flags}g`)
    : '';
  const matches = typeof pattern === 'string'
    ? source.split(pattern).length - 1
    : [...source.matchAll(new RegExp(pattern.source, flags))].length;
  if (matches !== 1) {
    throw new Error(`${label}: expected exactly one match, found ${matches}.`);
  }
  return source.replace(pattern, replacement);
}

const appPath = 'js/app.js';
let app = await readFile(appPath, 'utf8');

app = replaceRequired(
  app,
  'let motionPreferencesModule = null;\n',
  `let cartControlsModule = null;\nlet cartControlsModulePromise = null;\n\nfunction loadCartControlsModule() {\n  if (!cartControlsModulePromise) {\n    cartControlsModulePromise = import('./cart-controls.mjs')\n      .then((module) => {\n        cartControlsModule = module;\n        return module;\n      });\n  }\n  return cartControlsModulePromise;\n}\n\nlet motionPreferencesModule = null;\n`,
  'insert cart controls loader',
);

app = replaceRequired(
  app,
  /      state\.cart\.map\(\(item, i\) => \{[\s\S]*?      \}\)\.join\(''\) \+/,
  `      state.cart.map((item, i) =>\n        cartControlsModule.renderCartItemMarkup({\n          item,\n          index: i,\n          formatPrice,\n        })\n      ).join('') +`,
  'replace inline cart item markup',
);

app = replaceRequired(
  app,
  "    if (dom.cartOverlay) dom.cartOverlay.addEventListener('click', closeCart);\n\n    const checkoutBtn = document.getElementById('checkout-btn');\n",
  `    if (dom.cartOverlay) dom.cartOverlay.addEventListener('click', closeCart);\n    if (dom.cartItems) {\n      cartControlsModule.initCartControlDelegation({\n        container: dom.cartItems,\n        onUpdateQuantity: updateCartQuantity,\n        onRemoveItem: removeFromCart,\n      });\n    }\n\n    const checkoutBtn = document.getElementById('checkout-btn');\n`,
  'initialize cart control delegation',
);

app = replaceRequired(
  app,
  '    await loadMotionPreferencesModule();\n',
  '    await loadMotionPreferencesModule();\n    await loadCartControlsModule();\n',
  'load cart controls during initialization',
);

app = replaceRequired(
  app,
  /\n\n  \/\/ Expose for inline onclick\n  window\.legendApp = \{[\s\S]*?  \};\n/,
  '',
  'remove legacy global cart API',
);

await writeFile(appPath, app, 'utf8');

const packagePath = 'package.json';
const packageJson = JSON.parse(await readFile(packagePath, 'utf8'));
packageJson.scripts['validate:cart-controls'] = 'node scripts/validate-cart-controls.mjs';
const qualityMarker = 'npm run validate:motion-preferences &&';
if (!packageJson.scripts.quality.includes(qualityMarker)) {
  throw new Error('package quality chain is missing the motion-preferences marker.');
}
if (!packageJson.scripts.quality.includes('npm run validate:cart-controls')) {
  packageJson.scripts.quality = packageJson.scripts.quality.replace(
    qualityMarker,
    `${qualityMarker} npm run validate:cart-controls &&`,
  );
}
await writeFile(packagePath, `${JSON.stringify(packageJson, null, 2)}\n`, 'utf8');

console.log('Cart control migration completed.');
