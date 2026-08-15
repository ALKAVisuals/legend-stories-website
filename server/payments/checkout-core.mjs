export class CheckoutSessionError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = 'CheckoutSessionError';
    this.code = code;
    this.details = details;
  }
}

function fail(code, message, details) {
  throw new CheckoutSessionError(code, message, details);
}

function hasControlCharacters(value) {
  return /[\u0000-\u001F\u007F]/.test(value);
}

function requiredText(value, field, maxLength) {
  const normalized = String(value || '').trim();
  if (!normalized) fail('INVALID_CUSTOMER', `${field} is required.`, { field });
  if (normalized.length > maxLength) {
    fail('INVALID_CUSTOMER', `${field} is too long.`, { field, maxLength });
  }
  if (hasControlCharacters(normalized)) {
    fail('INVALID_CUSTOMER', `${field} contains invalid characters.`, { field });
  }
  return normalized;
}

function optionalText(value, field, maxLength) {
  const normalized = String(value || '').trim();
  if (normalized.length > maxLength) {
    fail('INVALID_CUSTOMER', `${field} is too long.`, { field, maxLength });
  }
  if (hasControlCharacters(normalized)) {
    fail('INVALID_CUSTOMER', `${field} contains invalid characters.`, { field });
  }
  return normalized;
}

function normalizeCountryCode(value, field = 'Country') {
  const country = String(value || '').trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(country)) {
    fail('INVALID_COUNTRY', `${field} must be a two-letter country code.`, { field });
  }
  return country;
}

export function normalizeCheckoutCustomer(customer = {}) {
  const firstname = requiredText(customer.firstname, 'First name', 80);
  const lastname = requiredText(customer.lastname, 'Last name', 80);
  const email = requiredText(customer.email, 'Email', 254).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    fail('INVALID_CUSTOMER', 'Email address is invalid.', { field: 'email' });
  }

  return Object.freeze({
    firstname,
    lastname,
    email,
    street: requiredText(customer.street, 'Street', 160),
    line2: optionalText(customer.line2, 'Address line 2', 160),
    zip: requiredText(customer.zip, 'Postal code', 32),
    city: requiredText(customer.city, 'City', 100),
    country: normalizeCountryCode(customer.country),
  });
}

export function allocateDiscountCents(quote) {
  const subtotal = quote.amountInCents.subtotal;
  const discount = quote.amountInCents.discount;
  const lines = quote.items.map((item) => ({
    page: item.page,
    lineCents: Math.round(item.lineTotal * 100),
    allocation: 0,
    remainder: 0,
  }));

  const lineSum = lines.reduce((sum, line) => sum + line.lineCents, 0);
  if (lineSum !== subtotal) {
    fail('QUOTE_RECONCILIATION_FAILED', 'Product line totals do not match the quote subtotal.');
  }
  if (discount === 0) return Object.freeze(lines.map((line) => Object.freeze(line)));
  if (discount < 0 || discount > subtotal) {
    fail('QUOTE_RECONCILIATION_FAILED', 'The quote discount is outside the valid range.');
  }

  let allocated = 0;
  for (const line of lines) {
    const numerator = line.lineCents * discount;
    line.allocation = Math.floor(numerator / subtotal);
    line.remainder = numerator % subtotal;
    allocated += line.allocation;
  }

  const remaining = discount - allocated;
  const ranked = lines
    .map((line, index) => ({
      line,
      index,
      variantId: String(quote.items[index]?.variantId || ''),
    }))
    .sort((left, right) => {
      if (right.line.remainder !== left.line.remainder) {
        return right.line.remainder - left.line.remainder;
      }
      const pageOrder = left.line.page.localeCompare(right.line.page);
      if (pageOrder !== 0) return pageOrder;
      const variantOrder = left.variantId.localeCompare(right.variantId);
      return variantOrder || left.index - right.index;
    });
  for (let index = 0; index < remaining; index += 1) {
    ranked[index % ranked.length].line.allocation += 1;
  }

  return Object.freeze(lines.map((line) => Object.freeze(line)));
}
