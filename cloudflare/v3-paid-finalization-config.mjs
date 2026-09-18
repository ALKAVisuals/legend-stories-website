const VAT_RATE_BASIS_POINTS = 2100;
const VAT_NUMERATOR = 21n;
const VAT_DENOMINATOR = 121n;

function requireNonnegativeSafeInteger(value, field) {
  const normalized = Number(value);
  if (!Number.isSafeInteger(normalized) || normalized < 0) {
    throw new TypeError(`${field} must be a nonnegative safe integer.`);
  }
  return normalized;
}

function requirePositiveSafeInteger(value, field) {
  const normalized = Number(value);
  if (!Number.isSafeInteger(normalized) || normalized < 1) {
    throw new TypeError(`${field} must be a positive safe integer.`);
  }
  return normalized;
}

function utcYearFromEpochSeconds(value) {
  const epochSeconds = requireNonnegativeSafeInteger(value, 'paidAt');
  const date = new Date(epochSeconds * 1000);
  if (Number.isNaN(date.getTime())) {
    throw new TypeError('paidAt is outside the supported Date range.');
  }
  return String(date.getUTCFullYear());
}

function numberingPrefix(documentType) {
  if (documentType === 'order') return 'LM-ORD';
  if (documentType === 'invoice') return 'LM-INV';
  throw new TypeError('Unsupported V3 document type.');
}

const numberingPolicy = Object.freeze({
  resolveSeriesKey({ paidAt } = {}) {
    return utcYearFromEpochSeconds(paidAt);
  },

  format({ documentType, value, seriesKey } = {}) {
    const normalizedSeriesKey = String(seriesKey ?? '').trim();
    if (!/^\d{4}$/.test(normalizedSeriesKey)) {
      throw new TypeError('V3 document series key must be a four-digit UTC year.');
    }

    const allocatedValue = requirePositiveSafeInteger(value, 'document number value');
    const suffix = String(allocatedValue).padStart(6, '0');
    return `${numberingPrefix(documentType)}-${normalizedSeriesKey}-${suffix}`;
  },
});

function sellerIdentity() {
  return {
    legalName: 'Alka Group',
    tradingName: 'LegendMural',
    registrationNumber: '95153756',
    vatIdentificationNumber: 'NL867022346B01',
    invoiceEmail: 'info@legendmural.com',
    supportEmail: 'info@legendmural.com',
    website: 'https://legendmural.com',
    address: {
      street: 'Schutkolk 4 d 1',
      line2: '',
      postalCode: '6582 DB',
      city: 'Heumen',
      countryCode: 'NL',
    },
  };
}

function billingAddressFromOrder(order) {
  const customer = order?.customer;
  if (!customer || typeof customer !== 'object' || Array.isArray(customer)) {
    throw new TypeError('Paid order customer data is required for invoice billing identity.');
  }

  return {
    street: String(customer.street ?? '').trim(),
    line2: String(customer.line2 ?? '').trim(),
    postalCode: String(customer.zip ?? '').trim(),
    city: String(customer.city ?? '').trim(),
    countryCode: String(customer.country ?? '').trim().toUpperCase(),
  };
}

function roundTaxInclusiveVatCents(grossCents) {
  const gross = BigInt(requireNonnegativeSafeInteger(grossCents, 'gross taxable amount'));
  const numerator = gross * VAT_NUMERATOR;

  // Arithmetic half-up rounding for a non-negative rational numerator / 121.
  return Number(((numerator * 2n) + VAT_DENOMINATOR) / (VAT_DENOMINATOR * 2n));
}

function taxSnapshotFromOrder(order) {
  const amountTotal = requireNonnegativeSafeInteger(order?.amountTotal, 'order.amountTotal');
  const grandTotal = requireNonnegativeSafeInteger(
    order?.totals?.grandTotal,
    'order.totals.grandTotal',
  );

  if (amountTotal !== grandTotal) {
    throw new TypeError('Paid order gross total is internally inconsistent.');
  }

  const taxAmountCents = roundTaxInclusiveVatCents(grandTotal);

  return {
    treatmentCode: 'NL_STANDARD_VAT_21',
    jurisdictionCode: 'NL',
    pricingBasis: 'tax_inclusive',
    taxableAmountCents: grandTotal - taxAmountCents,
    taxAmountCents,
    rateBasisPoints: VAT_RATE_BASIS_POINTS,
    legalText: null,
  };
}

async function documentContextProvider({ order } = {}) {
  return {
    seller: sellerIdentity(),
    billingAddress: billingAddressFromOrder(order),
    tax: taxSnapshotFromOrder(order),
  };
}

// Single Cloudflare boundary for the owner-approved Profile-1 business/legal configuration.
// The feature remains inert until V3_PROFILE1_ORDER_CREATION_ENABLED is separately activated.
export function resolveCloudflareV3PaidFinalizationConfig() {
  return Object.freeze({
    enabled: true,
    numberingPolicy,
    documentContextProvider,
  });
}
