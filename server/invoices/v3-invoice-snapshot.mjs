const REFERENCE_PATTERN = /^[a-f0-9]{64}$/;
const COUNTRY_CODE_PATTERN = /^[A-Z]{2}$/;
const SUPPORTED_CURRENCY = 'EUR';

export const V3_INVOICE_SNAPSHOT_SCHEMA_VERSION = 1;

export class V3InvoiceSnapshotError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = 'V3InvoiceSnapshotError';
    this.code = code;
    this.details = details;
  }
}

function fail(code, message, details = {}) {
  throw new V3InvoiceSnapshotError(code, message, details);
}

function requireObject(value, field) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    fail('INVALID_INVOICE_SNAPSHOT_INPUT', `${field} must be an object.`, { field });
  }
  return value;
}

function requireText(value, field, { maxLength = 256 } = {}) {
  const normalized = String(value ?? '').trim();
  if (!normalized || normalized.length > maxLength) {
    fail('INVALID_INVOICE_SNAPSHOT_INPUT', `${field} is invalid.`, { field });
  }
  return normalized;
}

function optionalText(value, field, { maxLength = 512 } = {}) {
  if (value === null || value === undefined || String(value).trim() === '') return null;
  const normalized = String(value).trim();
  if (normalized.length > maxLength) {
    fail('INVALID_INVOICE_SNAPSHOT_INPUT', `${field} is invalid.`, { field });
  }
  return normalized;
}

function nonnegativeInteger(value, field) {
  const normalized = Number(value);
  if (!Number.isInteger(normalized) || normalized < 0) {
    fail('INVALID_INVOICE_SNAPSHOT_INPUT', `${field} must be a nonnegative integer.`, { field });
  }
  return normalized;
}

function positiveInteger(value, field) {
  const normalized = Number(value);
  if (!Number.isInteger(normalized) || normalized < 1) {
    fail('INVALID_INVOICE_SNAPSHOT_INPUT', `${field} must be a positive integer.`, { field });
  }
  return normalized;
}

function optionalFiniteNumber(value, field) {
  if (value === null || value === undefined || value === '') return null;
  const normalized = Number(value);
  if (!Number.isFinite(normalized) || normalized < 0) {
    fail('INVALID_INVOICE_SNAPSHOT_INPUT', `${field} is invalid.`, { field });
  }
  return normalized;
}

function moneyToCents(value, field) {
  const normalized = Number(value);
  if (!Number.isFinite(normalized) || normalized < 0) {
    fail('INVALID_INVOICE_SNAPSHOT_INPUT', `${field} is invalid.`, { field });
  }
  const scaled = normalized * 100;
  const cents = Math.round(scaled);
  if (Math.abs(scaled - cents) > 1e-6) {
    fail('INVALID_INVOICE_SNAPSHOT_INPUT', `${field} must have at most two decimal places.`, {
      field,
    });
  }
  return cents;
}

function normalizeCountryCode(value, field) {
  const countryCode = String(value ?? '').trim().toUpperCase();
  if (!COUNTRY_CODE_PATTERN.test(countryCode)) {
    fail('INVALID_INVOICE_SNAPSHOT_INPUT', `${field} is invalid.`, { field });
  }
  return countryCode;
}

function normalizeAddress(input, field) {
  const address = requireObject(input, field);
  return {
    street: requireText(address.street, `${field}.street`),
    line2: optionalText(address.line2, `${field}.line2`),
    postalCode: requireText(address.postalCode ?? address.zip, `${field}.postalCode`, {
      maxLength: 64,
    }),
    city: requireText(address.city, `${field}.city`, { maxLength: 128 }),
    countryCode: normalizeCountryCode(
      address.countryCode ?? address.country,
      `${field}.countryCode`,
    ),
  };
}

function normalizeSeller(input) {
  const seller = requireObject(input, 'seller');
  const requiredFields = [
    ['legalName', 256],
    ['registrationNumber', 128],
    ['vatIdentificationNumber', 128],
    ['invoiceEmail', 320],
    ['website', 512],
  ];
  const missing = requiredFields
    .filter(([field]) => !String(seller[field] ?? '').trim())
    .map(([field]) => field);
  if (!seller.address || missing.length > 0) {
    fail(
      'INVOICE_SNAPSHOT_CONFIG_INCOMPLETE',
      'Approved seller identity is incomplete.',
      { missing: [...missing, ...(seller.address ? [] : ['address'])] },
    );
  }

  return {
    legalName: requireText(seller.legalName, 'seller.legalName'),
    tradingName: optionalText(seller.tradingName, 'seller.tradingName'),
    registrationNumber: requireText(
      seller.registrationNumber,
      'seller.registrationNumber',
      { maxLength: 128 },
    ),
    vatIdentificationNumber: requireText(
      seller.vatIdentificationNumber,
      'seller.vatIdentificationNumber',
      { maxLength: 128 },
    ),
    invoiceEmail: requireText(seller.invoiceEmail, 'seller.invoiceEmail', { maxLength: 320 }),
    supportEmail: optionalText(seller.supportEmail, 'seller.supportEmail', { maxLength: 320 }),
    website: requireText(seller.website, 'seller.website', { maxLength: 512 }),
    address: normalizeAddress(seller.address, 'seller.address'),
  };
}

function normalizeCustomer(order, billingAddressInput) {
  const customer = requireObject(order.customer, 'order.customer');
  const shippingAddress = normalizeAddress({
    street: customer.street,
    line2: customer.line2,
    postalCode: customer.zip,
    city: customer.city,
    countryCode: customer.country,
  }, 'order.customer.shippingAddress');

  return {
    firstName: requireText(customer.firstname, 'order.customer.firstname', { maxLength: 128 }),
    lastName: requireText(customer.lastname, 'order.customer.lastname', { maxLength: 128 }),
    email: requireText(customer.email, 'order.customer.email', { maxLength: 320 }),
    companyName: optionalText(customer.companyName, 'order.customer.companyName', { maxLength: 256 }),
    billingAddress: normalizeAddress(billingAddressInput, 'billingAddress'),
    shippingAddress,
  };
}

function normalizeLines(order) {
  if (!Array.isArray(order.items) || order.items.length === 0) {
    fail('INVALID_INVOICE_SNAPSHOT_INPUT', 'order.items must contain at least one line.', {
      field: 'order.items',
    });
  }

  return order.items.map((item, index) => {
    const field = `order.items[${index}]`;
    const line = requireObject(item, field);
    const quantity = positiveInteger(line.quantity, `${field}.quantity`);
    const unitPriceCents = moneyToCents(line.unitPrice, `${field}.unitPrice`);
    const lineTotalCents = moneyToCents(line.lineTotal, `${field}.lineTotal`);
    if (unitPriceCents * quantity !== lineTotalCents) {
      fail(
        'INVOICE_SNAPSHOT_TOTAL_MISMATCH',
        'Stored line total does not match the stored unit price and quantity.',
        { index, unitPriceCents, quantity, lineTotalCents },
      );
    }

    return {
      productId: requireText(line.productId, `${field}.productId`, { maxLength: 128 }),
      slug: requireText(line.slug, `${field}.slug`),
      page: requireText(line.page, `${field}.page`, { maxLength: 512 }),
      sku: requireText(line.sku, `${field}.sku`, { maxLength: 128 }),
      name: requireText(line.name, `${field}.name`, { maxLength: 512 }),
      image: optionalText(line.image, `${field}.image`, { maxLength: 1024 }),
      variantId: requireText(line.variantId, `${field}.variantId`, { maxLength: 128 }),
      variantLabel: requireText(line.variantLabel, `${field}.variantLabel`, { maxLength: 256 }),
      sizeLabel: requireText(line.sizeLabel, `${field}.sizeLabel`, { maxLength: 256 }),
      widthCm: optionalFiniteNumber(line.widthCm, `${field}.widthCm`),
      heightCm: optionalFiniteNumber(line.heightCm, `${field}.heightCm`),
      longestSideCm: optionalFiniteNumber(line.longestSideCm, `${field}.longestSideCm`),
      quantity,
      unitPriceCents,
      lineTotalCents,
    };
  });
}

function normalizeTotals(order, lines) {
  const totals = requireObject(order.totals, 'order.totals');
  const normalized = {
    subtotalCents: nonnegativeInteger(totals.subtotal, 'order.totals.subtotal'),
    discountCents: nonnegativeInteger(totals.discount, 'order.totals.discount'),
    discountedSubtotalCents: nonnegativeInteger(
      totals.discountedSubtotal,
      'order.totals.discountedSubtotal',
    ),
    shippingCents: nonnegativeInteger(totals.shipping, 'order.totals.shipping'),
    grandTotalCents: nonnegativeInteger(totals.grandTotal, 'order.totals.grandTotal'),
  };

  const lineSubtotalCents = lines.reduce((sum, line) => sum + line.lineTotalCents, 0);
  if (lineSubtotalCents !== normalized.subtotalCents
    || normalized.subtotalCents - normalized.discountCents !== normalized.discountedSubtotalCents
    || normalized.discountedSubtotalCents + normalized.shippingCents !== normalized.grandTotalCents
    || normalized.grandTotalCents !== Number(order.amountTotal)) {
    fail(
      'INVOICE_SNAPSHOT_TOTAL_MISMATCH',
      'Stored order totals are internally inconsistent.',
      { lineSubtotalCents, amountTotal: order.amountTotal, ...normalized },
    );
  }

  return normalized;
}

function normalizeDiscount(order, totals) {
  const discount = requireObject(order.discount, 'order.discount');
  const amountCents = moneyToCents(discount.amount ?? 0, 'order.discount.amount');
  if (amountCents !== totals.discountCents) {
    fail('INVOICE_SNAPSHOT_TOTAL_MISMATCH', 'Stored discount amount conflicts with order totals.');
  }
  const percent = Number(discount.percent ?? 0);
  if (!Number.isFinite(percent) || percent < 0 || percent > 100) {
    fail('INVALID_INVOICE_SNAPSHOT_INPUT', 'order.discount.percent is invalid.', {
      field: 'order.discount.percent',
    });
  }
  return {
    code: optionalText(discount.code, 'order.discount.code', { maxLength: 128 }),
    percent,
    amountCents,
  };
}

function normalizeShipping(order, totals) {
  const shipping = requireObject(order.shipping, 'order.shipping');
  const costCents = moneyToCents(shipping.cost ?? 0, 'order.shipping.cost');
  if (costCents !== totals.shippingCents) {
    fail('INVOICE_SNAPSHOT_TOTAL_MISMATCH', 'Stored shipping cost conflicts with order totals.');
  }
  return {
    deliveryCountry: normalizeCountryCode(
      shipping.deliveryCountry,
      'order.shipping.deliveryCountry',
    ),
    zoneCode: requireText(shipping.zoneCode, 'order.shipping.zoneCode', { maxLength: 64 }),
    zone: requireText(shipping.zone, 'order.shipping.zone', { maxLength: 128 }),
    costCents,
    freeFromCents: shipping.freeFrom === null || shipping.freeFrom === undefined
      ? null
      : moneyToCents(shipping.freeFrom, 'order.shipping.freeFrom'),
    qualifiesForFreeShipping: Boolean(shipping.qualifiesForFreeShipping),
  };
}

function normalizeTax(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    fail(
      'INVOICE_SNAPSHOT_CONFIG_INCOMPLETE',
      'Approved tax snapshot is required before V3 invoice issuance.',
      { missing: ['tax'] },
    );
  }

  const pricingBasis = String(input.pricingBasis ?? '').trim();
  if (!['tax_inclusive', 'tax_exclusive', 'not_applicable'].includes(pricingBasis)) {
    fail('INVALID_INVOICE_SNAPSHOT_INPUT', 'tax.pricingBasis is invalid.', {
      field: 'tax.pricingBasis',
    });
  }

  const rateBasisPoints = input.rateBasisPoints === null || input.rateBasisPoints === undefined
    ? null
    : nonnegativeInteger(input.rateBasisPoints, 'tax.rateBasisPoints');

  return {
    treatmentCode: requireText(input.treatmentCode, 'tax.treatmentCode', { maxLength: 128 }),
    jurisdictionCode: requireText(input.jurisdictionCode, 'tax.jurisdictionCode', {
      maxLength: 128,
    }),
    pricingBasis,
    taxableAmountCents: nonnegativeInteger(input.taxableAmountCents, 'tax.taxableAmountCents'),
    taxAmountCents: nonnegativeInteger(input.taxAmountCents, 'tax.taxAmountCents'),
    rateBasisPoints,
    legalText: optionalText(input.legalText, 'tax.legalText', { maxLength: 2000 }),
  };
}

function normalizePayment(order, input) {
  const payment = requireObject(input, 'payment');
  const providerOrderId = requireText(payment.providerOrderId, 'payment.providerOrderId', {
    maxLength: 256,
  });
  const verifiedPaidAt = nonnegativeInteger(payment.verifiedPaidAt, 'payment.verifiedPaidAt');
  if (providerOrderId !== String(order.paymentSessionId || '').trim()
    || verifiedPaidAt !== Number(order.paidAt)) {
    fail(
      'INVOICE_SNAPSHOT_PAYMENT_MISMATCH',
      'Verified payment evidence does not match the durable paid order.',
    );
  }

  return {
    provider: requireText(payment.provider, 'payment.provider', { maxLength: 64 }).toLowerCase(),
    providerOrderId,
    providerCaptureId: optionalText(payment.providerCaptureId, 'payment.providerCaptureId', {
      maxLength: 256,
    }),
    providerEventId: optionalText(payment.providerEventId, 'payment.providerEventId', {
      maxLength: 256,
    }),
    providerEventType: optionalText(payment.providerEventType, 'payment.providerEventType', {
      maxLength: 256,
    }),
    source: requireText(payment.source, 'payment.source', { maxLength: 128 }),
    verifiedPaidAt,
    mode: requireText(order.mode, 'order.mode', { maxLength: 16 }),
  };
}

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}

function clone(value) {
  return structuredClone(value);
}

export function createV3InvoiceSnapshot({
  order: orderInput,
  orderNumber,
  invoiceNumber,
  issuedAt,
  seller,
  billingAddress,
  tax,
  payment,
} = {}) {
  const order = requireObject(orderInput, 'order');
  const reference = String(order.reference ?? '').trim().toLowerCase();
  if (!REFERENCE_PATTERN.test(reference)) {
    fail('INVALID_INVOICE_SNAPSHOT_INPUT', 'order.reference is invalid.', {
      field: 'order.reference',
    });
  }
  if (order.status !== 'paid' || !Number.isInteger(Number(order.paidAt)) || Number(order.paidAt) < 0) {
    fail(
      'INVOICE_SNAPSHOT_ORDER_NOT_PAID',
      'An immutable V3 invoice snapshot can only be built from a durable paid order.',
    );
  }

  const currency = String(order.currency ?? '').trim().toUpperCase();
  if (currency !== SUPPORTED_CURRENCY) {
    fail('INVALID_INVOICE_SNAPSHOT_INPUT', 'order.currency is invalid.', {
      field: 'order.currency',
    });
  }

  const normalizedIssuedAt = nonnegativeInteger(issuedAt, 'issuedAt');
  if (normalizedIssuedAt < Number(order.paidAt)) {
    fail('INVALID_INVOICE_SNAPSHOT_INPUT', 'issuedAt cannot precede the durable paid timestamp.', {
      field: 'issuedAt',
    });
  }

  const lines = normalizeLines(order);
  const totals = normalizeTotals(order, lines);
  const normalizedCustomer = normalizeCustomer(order, billingAddress);
  const normalizedShipping = normalizeShipping(order, totals);
  if (normalizedCustomer.shippingAddress.countryCode !== normalizedShipping.deliveryCountry) {
    fail(
      'INVALID_INVOICE_SNAPSHOT_INPUT',
      'Stored shipping address country conflicts with the order delivery country.',
    );
  }

  const snapshot = {
    schemaVersion: V3_INVOICE_SNAPSHOT_SCHEMA_VERSION,
    document: {
      orderNumber: requireText(orderNumber, 'orderNumber', { maxLength: 128 }),
      invoiceNumber: requireText(invoiceNumber, 'invoiceNumber', { maxLength: 128 }),
      issuedAt: normalizedIssuedAt,
      currency,
    },
    seller: normalizeSeller(seller),
    customer: normalizedCustomer,
    order: {
      reference,
      createdAt: nonnegativeInteger(order.createdAt, 'order.createdAt'),
      paidAt: nonnegativeInteger(order.paidAt, 'order.paidAt'),
    },
    payment: normalizePayment(order, payment),
    lines,
    discount: normalizeDiscount(order, totals),
    shipping: normalizedShipping,
    totals,
    tax: normalizeTax(tax),
  };

  return deepFreeze(clone(snapshot));
}
