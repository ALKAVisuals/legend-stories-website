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
  'aria-label="Decrease quantity"',
  'aria-label="Increase quantity"',
  'aria-label="Remove ',
  'cartControlsModule.escapeCartHtml(item.name)',
  'cartControlsModule.escapeCartHtml(item.image',
]) {
  if (!appSource.includes(signal)) {
    errors.push(`js/app.js is missing required delegated cart markup: ${signal}`);
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
    errors.push(`js/cart-controls.mjs is missing required behavior: ${signal}`);
  }
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

console.log('Cart control validation passed with delegated controls and no global inline API.');
