import assert from 'node:assert/strict';
import test from 'node:test';

import {
  bindEditableAddressFields,
  configureStreetAddressInput,
  createManualAddress,
  resetValidatedAddressFields,
} from '../js/checkout-address-entry.mjs';

class FakeInput {
  constructor() {
    this.attributes = new Map();
    this.dataset = { validated: 'true' };
    this.disabled = false;
    this.readOnly = false;
    this.title = 'Locked';
    this.customValidity = 'invalid';
  }

  setAttribute(name, value) { this.attributes.set(name, String(value)); }
  removeAttribute(name) { this.attributes.delete(name); }
  setCustomValidity(value) { this.customValidity = value; }
  addEventListener(name, handler) {
    this.listeners ||= {};
    this.listeners[name] = handler;
  }
  trigger(name) { this.listeners?.[name]?.(); }
}

test('configures the street field for Google suggestions without Safari address autofill conflicts', () => {
  const input = new FakeInput();
  input.disabled = true;
  input.readOnly = true;
  input.setAttribute('disabled', '');
  input.setAttribute('readonly', '');

  configureStreetAddressInput(input);

  assert.equal(input.disabled, false);
  assert.equal(input.readOnly, false);
  assert.equal(input.attributes.has('disabled'), false);
  assert.equal(input.attributes.has('readonly'), false);
  assert.equal(input.attributes.get('autocomplete'), 'off');
  assert.equal(input.attributes.get('name'), 'shipping-address-line1');
  assert.equal(input.attributes.get('inputmode'), 'text');
  assert.equal(input.attributes.get('autocorrect'), 'off');
  assert.equal(input.attributes.get('spellcheck'), 'false');
  assert.equal(input.customValidity, '');
});

test('normalizes a complete manually entered address', () => {
  const result = createManualAddress({
    street: '  Dorpsstraat   12 A ',
    postalCode: ' 6585 xz ',
    city: ' Mook ',
    country: 'nl',
  });

  assert.equal(result.error, null);
  assert.deepEqual(result.address, {
    street: 'Dorpsstraat 12 A',
    postal_code: '6585 XZ',
    city: 'Mook',
    country: 'NL',
    formatted: 'Dorpsstraat 12 A, 6585 XZ Mook, NL',
    source: 'manual',
  });
});

test('requires a house number before accepting manual fallback', () => {
  const result = createManualAddress({
    street: 'Dorpsstraat',
    postalCode: '6585 XZ',
    city: 'Mook',
    country: 'NL',
  });

  assert.equal(result.address, null);
  assert.match(result.error, /house number/i);
});

test('editing a selected address unlocks and clears validated field state', () => {
  const streetInput = new FakeInput();
  const zipInput = new FakeInput();
  const cityInput = new FakeInput();
  const countryInput = new FakeInput();
  streetInput.disabled = true;
  zipInput.readOnly = true;
  cityInput.disabled = true;
  countryInput.disabled = true;

  resetValidatedAddressFields({ streetInput, zipInput, cityInput, countryInput });

  for (const input of [streetInput, zipInput, cityInput, countryInput]) {
    assert.equal(input.disabled, false);
    assert.equal(input.readOnly, false);
    assert.equal(input.title, '');
  }
  assert.equal('validated' in streetInput.dataset, false);
  assert.equal('validated' in zipInput.dataset, false);
  assert.equal('validated' in cityInput.dataset, false);
});

test('every address field is unlocked immediately and invalidates a selected address when changed', () => {
  const streetInput = new FakeInput();
  const zipInput = new FakeInput();
  const cityInput = new FakeInput();
  const countryInput = new FakeInput();
  countryInput.tagName = 'SELECT';
  for (const input of [streetInput, zipInput, cityInput, countryInput]) {
    input.disabled = true;
    input.readOnly = true;
  }
  let edits = 0;

  assert.equal(bindEditableAddressFields({
    streetInput,
    zipInput,
    cityInput,
    countryInput,
    onEdit: () => { edits += 1; },
  }), 4);

  for (const input of [streetInput, zipInput, cityInput, countryInput]) {
    assert.equal(input.disabled, false);
    assert.equal(input.readOnly, false);
  }

  zipInput.trigger('input');
  assert.equal(edits, 1);
  assert.equal('validated' in streetInput.dataset, false);
  assert.equal('validated' in zipInput.dataset, false);
  assert.equal('validated' in cityInput.dataset, false);

  countryInput.disabled = true;
  countryInput.trigger('change');
  assert.equal(edits, 2);
  assert.equal(countryInput.disabled, false);
});
