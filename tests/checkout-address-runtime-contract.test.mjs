import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const app = await readFile(new URL('../js/app.js', import.meta.url), 'utf8');

test('checkout validates the entered address locally before payment', () => {
  assert.match(app, /checkoutAddressModule\.createManualAddress\(\{[\s\S]*street,[\s\S]*postalCode: zip,[\s\S]*city,[\s\S]*country/);
  assert.match(app, /processOrder\(result\.address, firstname, lastname, email\)/);
  assert.doesNotMatch(app, /validateAddressWithGoogle/);
  assert.doesNotMatch(app, /doGoogleValidation/);
  assert.doesNotMatch(app, /Validating address\.\.\./);
});

test('checkout runtime no longer loads or initializes Google Places', () => {
  assert.doesNotMatch(app, /google-places-loader\.mjs/);
  assert.doesNotMatch(app, /createGooglePlacesLoader/);
  assert.doesNotMatch(app, /google\.maps\.places/);
  assert.doesNotMatch(app, /placeAutocomplete/);
  assert.doesNotMatch(app, /checkout-address-status/);
});

test('street input keeps the iOS-safe editable address configuration', () => {
  assert.match(app, /configureStreetAddressInput\(streetInput\)/);
  assert.match(app, /bindEditableAddressFields\(\{/);
});

test('Google API key remains scoped to the separate sticker fact feature', () => {
  assert.match(app, /const GP_API_KEY =/);
  assert.match(app, /kgsearch\.googleapis\.com\/v1\/entities:search/);
});
