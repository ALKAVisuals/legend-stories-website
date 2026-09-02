export const V3_CUSTOMER_INVOICE_EMAIL_RENDERER_VERSION = 1;

const SUPPORTED_SNAPSHOT_SCHEMA_VERSION = 1;
const SUPPORTED_CURRENCY = 'EUR';

export class V3CustomerInvoiceEmailError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = 'V3CustomerInvoiceEmailError';
    this.code = code;
    this.details = details;
  }
}

function fail(code, message, details = {}) {
  throw new V3CustomerInvoiceEmailError(code, message, details);
}

function requireObject(value, field) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    fail('INVALID_V3_CUSTOMER_INVOICE_EMAIL_SNAPSHOT', `${field} must be an object.`, { field });
  }
  return value;
}

function requireString(value, field) {
  if (typeof value !== 'string' || value.trim() === '') {
    fail('INVALID_V3_CUSTOMER_INVOICE_EMAIL_SNAPSHOT', `${field} must be a non-empty string.`, {
      field,
    });
  }
  return value;
}

function optionalString(value, field) {
  if (value === null || value === undefined) return null;
  if (typeof value !== 'string') {
    fail('INVALID_V3_CUSTOMER_INVOICE_EMAIL_SNAPSHOT', `${field} must be a string or null.`, {
      field,
    });
  }
  return value;
}

function requireNonnegativeInteger(value, field) {
  if (!Number.isSafeInteger(value) || value < 0) {
    fail(
      'INVALID_V3_CUSTOMER_INVOICE_EMAIL_SNAPSHOT',
      `${field} must be a nonnegative integer.`,
      { field },
    );
  }
  return value;
}

function requirePositiveInteger(value, field) {
  if (!Number.isSafeInteger(value) || value < 1) {
    fail(
      'INVALID_V3_CUSTOMER_INVOICE_EMAIL_SNAPSHOT',
      `${field} must be a positive integer.`,
      { field },
    );
  }
  return value;
}

function requireAddress(value, field) {
  const address = requireObject(value, field);
  requireString(address.street, `${field}.street`);
  optionalString(address.line2, `${field}.line2`);
  requireString(address.postalCode, `${field}.postalCode`);
  requireString(address.city, `${field}.city`);
  requireString(address.countryCode, `${field}.countryCode`);
  return address;
}

function requireSnapshot(snapshotInput) {
  const snapshot = requireObject(snapshotInput, 'snapshot');
  if (snapshot.schemaVersion !== SUPPORTED_SNAPSHOT_SCHEMA_VERSION) {
    fail(
      'UNSUPPORTED_V3_INVOICE_SNAPSHOT_SCHEMA',
      `Email renderer v${V3_CUSTOMER_INVOICE_EMAIL_RENDERER_VERSION} supports snapshot schema ${SUPPORTED_SNAPSHOT_SCHEMA_VERSION} only.`,
      { schemaVersion: snapshot.schemaVersion },
    );
  }

  const document = requireObject(snapshot.document, 'snapshot.document');
  requireString(document.orderNumber, 'snapshot.document.orderNumber');
  requireString(document.invoiceNumber, 'snapshot.document.invoiceNumber');
  requireNonnegativeInteger(document.issuedAt, 'snapshot.document.issuedAt');
  if (document.currency !== SUPPORTED_CURRENCY) {
    fail('UNSUPPORTED_V3_CUSTOMER_INVOICE_EMAIL_CURRENCY', 'Email renderer v1 supports EUR invoices only.', {
      currency: document.currency,
    });
  }

  const seller = requireObject(snapshot.seller, 'snapshot.seller');
  requireString(seller.legalName, 'snapshot.seller.legalName');
  optionalString(seller.tradingName, 'snapshot.seller.tradingName');
  optionalString(seller.supportEmail, 'snapshot.seller.supportEmail');

  const customer = requireObject(snapshot.customer, 'snapshot.customer');
  requireString(customer.firstName, 'snapshot.customer.firstName');
  requireString(customer.lastName, 'snapshot.customer.lastName');
  requireString(customer.email, 'snapshot.customer.email');
  optionalString(customer.companyName, 'snapshot.customer.companyName');
  requireAddress(customer.shippingAddress, 'snapshot.customer.shippingAddress');

  const order = requireObject(snapshot.order, 'snapshot.order');
  requireString(order.reference, 'snapshot.order.reference');
  requireNonnegativeInteger(order.paidAt, 'snapshot.order.paidAt');

  if (!Array.isArray(snapshot.lines) || snapshot.lines.length === 0) {
    fail(
      'INVALID_V3_CUSTOMER_INVOICE_EMAIL_SNAPSHOT',
      'snapshot.lines must contain at least one item.',
      { field: 'snapshot.lines' },
    );
  }
  snapshot.lines.forEach((line, index) => {
    const field = `snapshot.lines[${index}]`;
    requireObject(line, field);
    requireString(line.sku, `${field}.sku`);
    requireString(line.name, `${field}.name`);
    requireString(line.variantLabel, `${field}.variantLabel`);
    requireString(line.sizeLabel, `${field}.sizeLabel`);
    requirePositiveInteger(line.quantity, `${field}.quantity`);
    requireNonnegativeInteger(line.unitPriceCents, `${field}.unitPriceCents`);
    requireNonnegativeInteger(line.lineTotalCents, `${field}.lineTotalCents`);
  });

  const discount = requireObject(snapshot.discount, 'snapshot.discount');
  optionalString(discount.code, 'snapshot.discount.code');
  requireNonnegativeInteger(discount.amountCents, 'snapshot.discount.amountCents');

  const shipping = requireObject(snapshot.shipping, 'snapshot.shipping');
  requireString(shipping.deliveryCountry, 'snapshot.shipping.deliveryCountry');
  requireString(shipping.zone, 'snapshot.shipping.zone');
  requireNonnegativeInteger(shipping.costCents, 'snapshot.shipping.costCents');

  const totals = requireObject(snapshot.totals, 'snapshot.totals');
  requireNonnegativeInteger(totals.subtotalCents, 'snapshot.totals.subtotalCents');
  requireNonnegativeInteger(totals.discountCents, 'snapshot.totals.discountCents');
  requireNonnegativeInteger(
    totals.discountedSubtotalCents,
    'snapshot.totals.discountedSubtotalCents',
  );
  requireNonnegativeInteger(totals.shippingCents, 'snapshot.totals.shippingCents');
  requireNonnegativeInteger(totals.grandTotalCents, 'snapshot.totals.grandTotalCents');

  const tax = requireObject(snapshot.tax, 'snapshot.tax');
  requireString(tax.treatmentCode, 'snapshot.tax.treatmentCode');
  requireString(tax.jurisdictionCode, 'snapshot.tax.jurisdictionCode');
  requireString(tax.pricingBasis, 'snapshot.tax.pricingBasis');
  requireNonnegativeInteger(tax.taxableAmountCents, 'snapshot.tax.taxableAmountCents');
  requireNonnegativeInteger(tax.taxAmountCents, 'snapshot.tax.taxAmountCents');
  optionalString(tax.legalText, 'snapshot.tax.legalText');

  return snapshot;
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function formatMoney(cents) {
  const euros = Math.floor(cents / 100);
  const remainder = String(cents % 100).padStart(2, '0');
  return `EUR ${euros}.${remainder}`;
}

function formatAddress(address) {
  return [
    address.street,
    address.line2 || null,
    `${address.postalCode} ${address.city}`,
    address.countryCode,
  ].filter(Boolean);
}

function lineDescription(line) {
  return [line.name, line.sku, line.variantLabel, line.sizeLabel].filter(Boolean).join(' — ');
}

function textLineItems(snapshot) {
  return snapshot.lines.flatMap((line) => [
    `${line.quantity} × ${lineDescription(line)}`,
    `  Unit price: ${formatMoney(line.unitPriceCents)}`,
    `  Line total: ${formatMoney(line.lineTotalCents)}`,
  ]);
}

function htmlLineItems(snapshot) {
  return snapshot.lines.map((line) => (
    `<li><strong>${escapeHtml(`${line.quantity} × ${line.name}`)}</strong><br>`
    + `${escapeHtml(`${line.sku} — ${line.variantLabel} — ${line.sizeLabel}`)}<br>`
    + `Unit price: ${escapeHtml(formatMoney(line.unitPriceCents))}<br>`
    + `Line total: ${escapeHtml(formatMoney(line.lineTotalCents))}</li>`
  )).join('');
}

function discountLabel(snapshot) {
  return snapshot.discount.code ? `Discount (${snapshot.discount.code})` : 'Discount';
}

function renderText(snapshot) {
  const customerName = `${snapshot.customer.firstName} ${snapshot.customer.lastName}`;
  const sellerName = snapshot.seller.tradingName || snapshot.seller.legalName;
  const shippingAddress = formatAddress(snapshot.customer.shippingAddress);
  const lines = [
    `Hi ${snapshot.customer.firstName},`,
    '',
    'Your payment has been received and your LegendMural order is confirmed.',
    'Your PDF invoice is attached to this email.',
    '',
    `Order number: ${snapshot.document.orderNumber}`,
    `Invoice number: ${snapshot.document.invoiceNumber}`,
    '',
    'Customer:',
    customerName,
    snapshot.customer.companyName || null,
    snapshot.customer.email,
    '',
    'Items:',
    ...textLineItems(snapshot),
    '',
    `Subtotal: ${formatMoney(snapshot.totals.subtotalCents)}`,
    `${discountLabel(snapshot)}: ${formatMoney(snapshot.totals.discountCents)}`,
    `Shipping: ${formatMoney(snapshot.totals.shippingCents)}`,
    `Tax amount: ${formatMoney(snapshot.tax.taxAmountCents)}`,
    `Total paid: ${formatMoney(snapshot.totals.grandTotalCents)}`,
    '',
    'Shipping address:',
    ...shippingAddress,
    '',
    ...(snapshot.tax.legalText ? [`Tax note: ${snapshot.tax.legalText}`, ''] : []),
    sellerName,
  ].filter((line) => line !== null);

  return lines.join('\n');
}

function renderHtml(snapshot) {
  const customerName = `${snapshot.customer.firstName} ${snapshot.customer.lastName}`;
  const sellerName = snapshot.seller.tradingName || snapshot.seller.legalName;
  const shippingAddress = formatAddress(snapshot.customer.shippingAddress)
    .map((line) => escapeHtml(line))
    .join('<br>');
  const taxNote = snapshot.tax.legalText
    ? `<p><strong>Tax note:</strong> ${escapeHtml(snapshot.tax.legalText)}</p>`
    : '';

  return '<!doctype html><html><body>'
    + `<h1>Payment received</h1><p>Hi ${escapeHtml(snapshot.customer.firstName)},</p>`
    + '<p>Your payment has been received and your LegendMural order is confirmed. '
    + 'Your PDF invoice is attached to this email.</p>'
    + '<h2>Order details</h2>'
    + `<p><strong>Order number:</strong> ${escapeHtml(snapshot.document.orderNumber)}<br>`
    + `<strong>Invoice number:</strong> ${escapeHtml(snapshot.document.invoiceNumber)}</p>`
    + '<h2>Customer</h2>'
    + `<p>${escapeHtml(customerName)}<br>`
    + `${snapshot.customer.companyName ? `${escapeHtml(snapshot.customer.companyName)}<br>` : ''}`
    + `${escapeHtml(snapshot.customer.email)}</p>`
    + `<h2>Items</h2><ul>${htmlLineItems(snapshot)}</ul>`
    + '<h2>Totals</h2><table>'
    + `<tr><td>Subtotal</td><td>${escapeHtml(formatMoney(snapshot.totals.subtotalCents))}</td></tr>`
    + `<tr><td>${escapeHtml(discountLabel(snapshot))}</td><td>${escapeHtml(formatMoney(snapshot.totals.discountCents))}</td></tr>`
    + `<tr><td>Shipping</td><td>${escapeHtml(formatMoney(snapshot.totals.shippingCents))}</td></tr>`
    + `<tr><td>Tax amount</td><td>${escapeHtml(formatMoney(snapshot.tax.taxAmountCents))}</td></tr>`
    + `<tr><td><strong>Total paid</strong></td><td><strong>${escapeHtml(formatMoney(snapshot.totals.grandTotalCents))}</strong></td></tr>`
    + '</table>'
    + `<h2>Shipping address</h2><p>${shippingAddress}</p>`
    + taxNote
    + `<p>${escapeHtml(sellerName)}</p>`
    + '</body></html>';
}

export function renderV3CustomerInvoiceEmail({ snapshot: snapshotInput } = {}) {
  const snapshot = requireSnapshot(snapshotInput);
  const subject = `Your LegendMural order ${snapshot.document.orderNumber} is confirmed — invoice ${snapshot.document.invoiceNumber}`;

  return Object.freeze({
    subject,
    text: renderText(snapshot),
    html: renderHtml(snapshot),
    rendererVersion: V3_CUSTOMER_INVOICE_EMAIL_RENDERER_VERSION,
  });
}
