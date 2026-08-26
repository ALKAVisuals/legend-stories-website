import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const app = await readFile(new URL('../js/app.js', import.meta.url), 'utf8');

test('checkout country options come from the shared shipping policy', () => {
  assert.ok(app.includes("import('./commerce/shipping.mjs')"));
  assert.match(app, /commerceModule\.getCheckoutCountryOptions/);
  assert.match(app, /option\.disabled = !country\.enabled/);
  assert.doesNotMatch(app, /const COUNTRY_OPTIONS/);
  assert.doesNotMatch(app, /c\.flag/);
});

test('unsupported markets cannot reach payment even after DOM manipulation', () => {
  assert.match(app, /if \(!commerceModule\.isShippingCountryEnabled\(country\)\)/);
  assert.match(app, /if \(!commerceModule\.isShippingCountryEnabled\(validatedCountry\)\)/);
  assert.match(app, /commerceModule\.getShippingMarketNotice/);
});

test('shipping market changes no longer depend on Google Places state', () => {
  assert.match(app, /state\.shippingCountry = nextCountry/);
  assert.match(app, /updateShippingMarketNotice\(nextCountry\)/);
  assert.match(app, /updateCheckoutTotals\(\)/);
  assert.doesNotMatch(app, /componentRestrictions:/);
  assert.doesNotMatch(app, /setComponentRestrictions/);
});

test('cart explains the active launch shipping rates without emoji flags', () => {
  assert.match(app, /€9,95 to the EU and United States/);
  assert.doesNotMatch(app, /United States shipping opens/);
  assert.doesNotMatch(app, /Shipping calculated at checkout based on your country/);
});
