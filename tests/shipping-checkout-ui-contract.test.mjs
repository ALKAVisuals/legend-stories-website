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

test('Google Places follows the active enabled shipping market', () => {
  assert.match(app, /componentRestrictions:/);
  assert.match(app, /getPlacesCountryRestriction\(state\.shippingCountry\)/);
  assert.match(app, /setComponentRestrictions/);
});

test('cart and checkout explain the staged United States rollout without emoji flags', () => {
  assert.match(app, /United States shipping opens after tracked rates and import charges are confirmed/);
  assert.doesNotMatch(app, /Shipping calculated at checkout based on your country/);
});
