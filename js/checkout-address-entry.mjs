function normalizeWhitespace(value = '') {
  return String(value).replace(/\s+/g, ' ').trim();
}

function keepFieldEditable(input) {
  if (!input) return;
  input.disabled = false;
  if ('readOnly' in input) input.readOnly = false;
  input.removeAttribute?.('disabled');
  input.removeAttribute?.('readonly');
}

export function configureStreetAddressInput(input) {
  if (!input?.setAttribute) return input;

  keepFieldEditable(input);
  input.setAttribute('name', 'shipping-address-line1');
  input.setAttribute('autocomplete', 'off');
  input.setAttribute('inputmode', 'text');
  input.setAttribute('autocapitalize', 'words');
  input.setAttribute('autocorrect', 'off');
  input.setAttribute('spellcheck', 'false');
  input.setAttribute('enterkeyhint', 'next');
  input.removeAttribute('aria-invalid');
  input.setCustomValidity?.('');
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

  fields.forEach((input) => {
    keepFieldEditable(input);
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
