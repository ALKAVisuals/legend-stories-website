import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const app = await readFile(new URL('../js/app.js', import.meta.url), 'utf8');

test('Google-selected checkout addresses never lock customer fields', () => {
  assert.doesNotMatch(app, /countryInput\.disabled = true/);
  assert.match(app, /countryInput\.disabled = false/);
  assert.match(app, /bindEditableAddressFields\(\{/);
  assert.match(app, /zipInput: zipField/);
  assert.match(app, /cityInput: cityField/);
  assert.match(app, /countryInput: countryField/);
});

test('editing any address field invalidates the previous Google selection', () => {
  assert.match(app, /onEdit: \(\) => \{[\s\S]*validatedAddress = null/);
  assert.match(app, /Address selected\. You can edit any field before continuing\./);
});
