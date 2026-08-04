import assert from 'node:assert/strict';
import test from 'node:test';

import {
  bindEditableAddressFields,
  installCheckoutAddressStyles,
} from '../js/checkout-address-entry.mjs';

class FakeInput {
  constructor(tagName = 'INPUT') {
    this.tagName = tagName;
    this.attributes = new Map();
    this.dataset = { validated: 'true' };
    this.disabled = true;
    this.readOnly = true;
    this.title = 'Locked';
    this.listeners = new Map();
  }

  setAttribute(name, value) { this.attributes.set(name, String(value)); }
  removeAttribute(name) { this.attributes.delete(name); }
  setCustomValidity() {}
  addEventListener(name, handler) { this.listeners.set(name, handler); }
  trigger(name) { this.listeners.get(name)?.(); }
}

test('manual interaction immediately invalidates a Google-selected address', () => {
  const streetInput = new FakeInput();
  const zipInput = new FakeInput();
  const cityInput = new FakeInput();
  const countryInput = new FakeInput('SELECT');
  let edits = 0;

  bindEditableAddressFields({
    streetInput,
    zipInput,
    cityInput,
    countryInput,
    onEdit: () => { edits += 1; },
  });

  for (const field of [streetInput, zipInput, cityInput, countryInput]) {
    assert.equal(field.disabled, false);
    assert.equal(field.readOnly, false);
    assert.equal(field.attributes.get('autocomplete'), 'off');
  }

  streetInput.trigger('beforeinput');
  assert.equal(edits, 1);
  assert.equal('validated' in streetInput.dataset, false);

  zipInput.dataset.validated = 'true';
  zipInput.trigger('paste');
  assert.equal(edits, 2);
  assert.equal('validated' in zipInput.dataset, false);

  countryInput.dataset.validated = 'true';
  countryInput.trigger('change');
  assert.equal(edits, 3);
  assert.equal('validated' in countryInput.dataset, false);
});

test('checkout injects dark-theme-safe autofill styling once', () => {
  const nodes = new Map();
  const documentRef = {
    head: {
      appendChild(node) { nodes.set(node.id, node); },
    },
    getElementById(id) { return nodes.get(id) || null; },
    createElement() { return { id: '', textContent: '' }; },
  };

  assert.equal(installCheckoutAddressStyles(documentRef), true);
  assert.equal(installCheckoutAddressStyles(documentRef), false);
  assert.match(nodes.get('checkout-address-editable-styles').textContent, /-webkit-autofill/);
  assert.match(nodes.get('checkout-address-editable-styles').textContent, /contacts-auto-fill-button/);
});
