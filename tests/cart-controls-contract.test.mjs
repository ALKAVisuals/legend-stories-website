import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const appSource = await readFile(new URL('../js/app.js', import.meta.url), 'utf8');
const moduleSource = await readFile(new URL('../js/cart-controls.mjs', import.meta.url), 'utf8');
const packageJson = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));

function count(source, needle) {
  return source.split(needle).length - 1;
}

test('cart controls use one shared delegated runtime', () => {
  assert.equal(count(appSource, "import('./cart-controls.mjs')"), 1);
  assert.equal(count(appSource, 'initCartControlDelegation({'), 1);
  assert.equal(count(appSource, 'renderCartItemMarkup({'), 1);
  assert.doesNotMatch(appSource, /window\.legendApp/);
  assert.doesNotMatch(appSource, /onclick=/);
});

test('cart markup remains escaped and product-labelled', () => {
  assert.match(moduleSource, /escapeCartHtml\(item\.name/);
  assert.match(moduleSource, /escapeCartHtml\(item\.image/);
  assert.match(moduleSource, /aria-label="Decrease quantity for /);
  assert.match(moduleSource, /aria-label="Increase quantity for /);
  assert.match(moduleSource, /aria-label="Remove /);
  assert.match(moduleSource, /data-cart-action="remove"/);
});

test('the permanent quality chain validates delegated cart controls once', () => {
  assert.equal(packageJson.scripts['validate:cart-controls'], 'node scripts/validate-cart-controls.mjs');
  assert.equal(count(packageJson.scripts.quality, 'npm run validate:cart-controls'), 1);
});
