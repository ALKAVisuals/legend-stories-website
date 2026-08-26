import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const app = await readFile(new URL('../js/app.js', import.meta.url), 'utf8');

test('checkout address fields remain editable with local validation', () => {
  assert.match(app, /bindEditableAddressFields\(\{/);
  assert.match(app, /streetInput: streetField/);
  assert.match(app, /zipInput: zipField/);
  assert.match(app, /cityInput: cityField/);
  assert.match(app, /countryInput: countryField/);
  assert.doesNotMatch(app, /countryInput\.disabled = true/);
});

test('checkout no longer carries Google-selected address state', () => {
  assert.doesNotMatch(app, /validatedAddress/);
  assert.doesNotMatch(app, /Address selected\. You can edit any field before continuing\./);
  assert.doesNotMatch(app, /place_changed/);
});
