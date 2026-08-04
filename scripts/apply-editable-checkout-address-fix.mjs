import { readFile, writeFile } from 'node:fs/promises';

const appPath = new URL('../js/app.js', import.meta.url);
const modulePath = new URL('../js/checkout-address-entry.mjs', import.meta.url);
const moduleTestPath = new URL('../tests/checkout-address-entry.test.mjs', import.meta.url);
const contractTestPath = new URL('../tests/checkout-address-edit-contract.test.mjs', import.meta.url);

let app = await readFile(appPath, 'utf8');
let moduleSource = await readFile(modulePath, 'utf8');
let moduleTests = await readFile(moduleTestPath, 'utf8');

const oldCountryLock = `      // Lock country field — it's determined by the validated address
      countryInput.disabled = true;
      countryInput.title = 'Country is set based on your address. Clear the street field to change.';`;
const newCountryBehavior = `      // Google pre-fills the country, but every address field remains editable.
      countryInput.disabled = false;
      countryInput.title = '';`;

if (!app.includes(oldCountryLock)) throw new Error('Expected Google-selected country lock was not found.');
app = app.replace(oldCountryLock, newCountryBehavior);

const oldAddressBinding = `    // Keep manual entry usable and invalidate a selected suggestion when it is edited.
    const streetField = document.getElementById('checkout-street');
    if (streetField) {
      checkoutAddressModule.configureStreetAddressInput(streetField);
      ensureCheckoutAddressStatus();
      if (streetField.dataset.addressEntryBound !== 'true') {
        streetField.dataset.addressEntryBound = 'true';
        streetField.addEventListener('input', function() {
          validatedAddress = null;
          checkoutAddressModule.resetValidatedAddressFields({
            streetInput: this,
            zipInput: document.getElementById('checkout-zip'),
            cityInput: document.getElementById('checkout-city'),
            countryInput: document.getElementById('checkout-country'),
          });
          setCheckoutAddressStatus('');
        });
      }
    }`;

const newAddressBinding = `    // Google suggestions only pre-fill the form. Every address field stays editable.
    const streetField = document.getElementById('checkout-street');
    const zipField = document.getElementById('checkout-zip');
    const cityField = document.getElementById('checkout-city');
    const countryField = document.getElementById('checkout-country');
    if (streetField) checkoutAddressModule.configureStreetAddressInput(streetField);
    ensureCheckoutAddressStatus();
    checkoutAddressModule.bindEditableAddressFields({
      streetInput: streetField,
      zipInput: zipField,
      cityInput: cityField,
      countryInput: countryField,
      onEdit: () => {
        validatedAddress = null;
        setCheckoutAddressStatus('');
      },
    });`;

if (!app.includes(oldAddressBinding)) throw new Error('Expected single-field address edit binding was not found.');
app = app.replace(oldAddressBinding, newAddressBinding);

const validationMarker = `    validatedAddress = {
      street: (route + ' ' + street_number).trim(),
      postal_code: postal_code,
      city: city,
      country: country_code.toUpperCase(),
      formatted: place.formatted_address || '',
    };`;
const validationReplacement = `${validationMarker}
    setCheckoutAddressStatus('Address selected. You can edit any field before continuing.');`;
if (!app.includes(validationMarker)) throw new Error('Expected validated address assignment was not found.');
app = app.replace(validationMarker, validationReplacement);

if (!moduleSource.includes('export function bindEditableAddressFields')) {
  moduleSource += `

export function bindEditableAddressFields({
  streetInput,
  zipInput,
  cityInput,
  countryInput,
  onEdit,
} = {}) {
  const fields = [streetInput, zipInput, cityInput, countryInput].filter(Boolean);

  fields.forEach((input) => {
    if (!input?.addEventListener || input.dataset?.addressEditBound === 'true') return;
    if (input.dataset) input.dataset.addressEditBound = 'true';
    const eventName = String(input.tagName || '').toUpperCase() === 'SELECT' ? 'change' : 'input';
    input.addEventListener(eventName, () => {
      resetValidatedAddressFields({ streetInput, zipInput, cityInput, countryInput });
      onEdit?.(input);
    });
  });

  return fields.length;
}
`;
}

if (!moduleTests.includes('bindEditableAddressFields')) {
  moduleTests = moduleTests.replace(
`import {
  configureStreetAddressInput,
  createManualAddress,
  resetValidatedAddressFields,
} from '../js/checkout-address-entry.mjs';`,
`import {
  bindEditableAddressFields,
  configureStreetAddressInput,
  createManualAddress,
  resetValidatedAddressFields,
} from '../js/checkout-address-entry.mjs';`,
  );

  moduleTests = moduleTests.replace(
`  setCustomValidity(value) { this.customValidity = value; }
}`,
`  setCustomValidity(value) { this.customValidity = value; }
  addEventListener(name, handler) {
    this.listeners ||= {};
    this.listeners[name] = handler;
  }
  trigger(name) { this.listeners?.[name]?.(); }
}`,
  );

  moduleTests += `

test('every address field stays editable and invalidates a selected address when changed', () => {
  const streetInput = new FakeInput();
  const zipInput = new FakeInput();
  const cityInput = new FakeInput();
  const countryInput = new FakeInput();
  countryInput.tagName = 'SELECT';
  countryInput.disabled = true;
  let edits = 0;

  assert.equal(bindEditableAddressFields({
    streetInput,
    zipInput,
    cityInput,
    countryInput,
    onEdit: () => { edits += 1; },
  }), 4);

  zipInput.trigger('input');
  assert.equal(edits, 1);
  assert.equal(countryInput.disabled, false);
  assert.equal('validated' in streetInput.dataset, false);
  assert.equal('validated' in zipInput.dataset, false);
  assert.equal('validated' in cityInput.dataset, false);

  countryInput.disabled = true;
  countryInput.trigger('change');
  assert.equal(edits, 2);
  assert.equal(countryInput.disabled, false);
});
`;
}

const contractTest = `import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const app = await readFile(new URL('../js/app.js', import.meta.url), 'utf8');

test('Google-selected checkout addresses never lock customer fields', () => {
  assert.doesNotMatch(app, /countryInput\\.disabled = true/);
  assert.match(app, /countryInput\\.disabled = false/);
  assert.match(app, /bindEditableAddressFields\\(\\{/);
  assert.match(app, /zipInput: zipField/);
  assert.match(app, /cityInput: cityField/);
  assert.match(app, /countryInput: countryField/);
});

test('editing any address field invalidates the previous Google selection', () => {
  assert.match(app, /onEdit: \\(\\) => \\{[\\s\\S]*validatedAddress = null/);
  assert.match(app, /Address selected\\. You can edit any field before continuing\\./);
});
`;

await writeFile(appPath, app);
await writeFile(modulePath, moduleSource);
await writeFile(moduleTestPath, moduleTests);
await writeFile(contractTestPath, contractTest);
