function normalizeWhitespace(value = '') {
  return String(value).replace(/\s+/g, ' ').trim();
}

export function configureStreetAddressInput(input) {
  if (!input?.setAttribute) return input;

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
  [streetInput, zipInput, cityInput].forEach((input) => {
    if (!input) return;
    delete input.dataset.validated;
    input.removeAttribute('aria-invalid');
    input.setCustomValidity?.('');
  });

  if (countryInput) {
    countryInput.disabled = false;
    countryInput.title = '';
  }
}
