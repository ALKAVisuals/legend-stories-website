import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

const ROOT = process.cwd();
const errors = [];

function count(source, needle) {
  return source.split(needle).length - 1;
}

const [appSource, moduleSource, packageSource] = await Promise.all([
  readFile(join(ROOT, 'js/app.js'), 'utf8'),
  readFile(join(ROOT, 'js/cart-controls.mjs'), 'utf8'),
  readFile(join(ROOT, 'package.json'), 'utf8'),
]);
const packageJson = JSON.parse(packageSource);

if (count(appSource, "import('./cart-controls.mjs')") !== 1) {
  errors.push('js/app.js must load the cart-controls module exactly once.');
}
if (count(appSource, 'initCartControlDelegation({') !== 1) {
  errors.push('js/app.js must initialize cart control delegation exactly once.');
}
if (count(appSource, 'renderCartItemMarkup({') !== 1) {
  errors.push('js/app.js must render cart items through the shared module exactly once.');
}
if (appSource.includes('window.legendApp')) {
  errors.push('The legacy global window.legendApp API must be removed.');
}
if (/onclick=/.test(appSource)) {
  errors.push('js/app.js must not generate inline onclick attributes.');
}

for (const signal of [
  'data-cart-action="decrement"',
  'data-cart-action="increment"',
  'data-cart-action="remove"',
  'data-cart-index="',
  'aria-label="Decrease quantity for ',
  'aria-label="Increase quantity for ',
  'aria-label="Remove ',
  'escapeCartHtml(item.name',
  'escapeCartHtml(resolvedImage',
  'aria-hidden="true" focusable="false"',
]) {
  if (!moduleSource.includes(signal)) {
    errors.push(`js/cart-controls.mjs is missing required safe cart markup: ${signal}`);
  }
}

for (const signal of [
  "closest?.('[data-cart-action][data-cart-index]')",
  'container.contains?.(control)',
  "action === 'remove'",
  'onUpdateQuantity(index, ACTION_DELTAS[action])',
  'container.removeEventListener?.',
]) {
  if (!moduleSource.includes(signal)) {
    errors.push(`js/cart-controls.mjs is missing required delegated behavior: ${signal}`);
  }
}

for (const signal of [
  "import { loadProductRegistry } from './catalog/related-products.mjs'",
  'data-cart-product-page=',
  'data-cart-image-recovery=',
  'export async function recoverCartImage',
  'persistRecoveredCartImage(safePage, replacement, storage)',
  "container.addEventListener('error', handleImageError, true)",
  "container.removeEventListener?.('error', handleImageError, true)",
]) {
  if (!moduleSource.includes(signal)) {
    errors.push(`js/cart-controls.mjs is missing required image recovery behavior: ${signal}`);
  }
}

if (moduleSource.includes('(?:[A-Za-z0-9._~-]+\\/)*assets')) {
  errors.push('Cart image recovery must not contain GitHub Pages repository-prefixed asset support.');
}

if (packageJson.scripts?.['validate:cart-controls'] !== 'node scripts/validate-cart-controls.mjs') {
  errors.push('package.json must expose validate:cart-controls.');
}
if (count(packageJson.scripts?.quality || '', 'npm run validate:cart-controls') !== 1) {
  errors.push('The permanent quality chain must run validate:cart-controls exactly once.');
}

if (errors.length) {
  console.error('Cart control validation failed:');
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log('Cart control validation passed with delegated controls, escaped markup and Netlify cart image recovery.');
