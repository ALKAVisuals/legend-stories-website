function normalizeWhitespace(value = '') {
  return String(value).replace(/\s+/g, ' ').trim();
}

const ADDRESS_EDIT_EVENTS = Object.freeze([
  'pointerdown',
  'focus',
  'beforeinput',
  'input',
  'change',
  'paste',
  'cut',
]);

function keepFieldEditable(input) {
  if (!input) return;
  input.disabled = false;
  if ('readOnly' in input) input.readOnly = false;
  input.removeAttribute?.('disabled');
  input.removeAttribute?.('readonly');
}

function configureManualAddressField(input, name) {
  if (!input?.setAttribute) return input;

  keepFieldEditable(input);
  input.setAttribute('name', name);
  input.setAttribute('autocomplete', 'off');
  input.removeAttribute('aria-invalid');
  input.setCustomValidity?.('');
  return input;
}

export function installCheckoutAddressStyles(documentRef = globalThis.document) {
  if (!documentRef?.head || documentRef.getElementById('checkout-address-editable-styles')) {
    return false;
  }

  const style = documentRef.createElement('style');
  style.id = 'checkout-address-editable-styles';
  style.textContent = `
    #checkout-drawer input:-webkit-autofill,
    #checkout-drawer input:-webkit-autofill:hover,
    #checkout-drawer input:-webkit-autofill:focus,
    #checkout-drawer select:-webkit-autofill {
      -webkit-text-fill-color: var(--color-text-primary, #f5f5f5) !important;
      caret-color: var(--color-text-primary, #f5f5f5) !important;
      -webkit-box-shadow: 0 0 0 1000px var(--color-bg-primary, #0b0b0c) inset !important;
      box-shadow: 0 0 0 1000px var(--color-bg-primary, #0b0b0c) inset !important;
      transition: background-color 9999s ease-out 0s;
    }

    #checkout-drawer input::-webkit-contacts-auto-fill-button,
    #checkout-drawer input::-webkit-credentials-auto-fill-button {
      visibility: hidden !important;
      display: none !important;
      pointer-events: none !important;
    }
  `;
  documentRef.head.appendChild(style);
  return true;
}

export function configureStreetAddressInput(input) {
  configureManualAddressField(input, 'shipping-address-line1');
  if (!input?.setAttribute) return input;

  input.setAttribute('inputmode', 'text');
  input.setAttribute('autocapitalize', 'words');
  input.setAttribute('autocorrect', 'off');
  input.setAttribute('spellcheck', 'false');
  input.setAttribute('enterkeyhint', 'next');
  return input;
}

export function createManualAddress({ street, postalCode, city, country } = {}) {
  const normalizedStreet = normalizeWhitespace(street);
  const normalizedPostalCode = normalizeWhitespace(postalCode).toUpperCase();
  const normalizedCity = normalizeWhitespace(city);
  const normalizedCountry = normalizeWhitespace(country).toUpperCase();

  if (!normalizedStreet || !normalizedPostalCode || !normalizedCity || !normalizedCountry) {
    return {
      address: null,
      error: 'Please complete the street, postal code, city and country.',
    };
  }

  if (!/\d/.test(normalizedStreet)) {
    return {
      address: null,
      error: 'Please include the house number in the street address.',
    };
  }

  return {
    error: null,
    address: {
      street: normalizedStreet,
      postal_code: normalizedPostalCode,
      city: normalizedCity,
      country: normalizedCountry,
      formatted: `${normalizedStreet}, ${normalizedPostalCode} ${normalizedCity}, ${normalizedCountry}`,
      source: 'manual',
    },
  };
}

export function resetValidatedAddressFields({ streetInput, zipInput, cityInput, countryInput } = {}) {
  [streetInput, zipInput, cityInput, countryInput].forEach((input) => {
    if (!input) return;
    keepFieldEditable(input);
    if (input.dataset) delete input.dataset.validated;
    input.removeAttribute?.('aria-invalid');
    input.setCustomValidity?.('');
    input.title = '';
  });
}

export function bindEditableAddressFields({
  streetInput,
  zipInput,
  cityInput,
  countryInput,
  onEdit,
} = {}) {
  const fields = [streetInput, zipInput, cityInput, countryInput].filter(Boolean);

  configureStreetAddressInput(streetInput);
  configureManualAddressField(zipInput, 'shipping-postal-code');
  configureManualAddressField(cityInput, 'shipping-city');
  configureManualAddressField(countryInput, 'shipping-country');
  installCheckoutAddressStyles();

  const invalidateSelection = (input) => {
    resetValidatedAddressFields({ streetInput, zipInput, cityInput, countryInput });
    onEdit?.(input);
  };

  fields.forEach((input) => {
    keepFieldEditable(input);
    if (!input?.addEventListener || input.dataset?.addressEditBound === 'true') return;
    if (input.dataset) input.dataset.addressEditBound = 'true';

    ADDRESS_EDIT_EVENTS.forEach((eventName) => {
      input.addEventListener(eventName, () => invalidateSelection(input));
    });
  });

  return fields.length;
}

if (typeof document !== 'undefined') {
  installCheckoutAddressStyles(document);
}
