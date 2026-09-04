export const V3_CUSTOMER_INVOICE_EMAIL_RENDERER_VERSION = 2;

const SUPPORTED_SNAPSHOT_SCHEMA_VERSION = 1;
const SUPPORTED_CURRENCY = 'EUR';
const BRAND_LOGO_URL = 'https://legendmural.com/media/LOGO/lm-logo-transparant.png';

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
    fail(
      'UNSUPPORTED_V3_CUSTOMER_INVOICE_EMAIL_CURRENCY',
      `Email renderer v${V3_CUSTOMER_INVOICE_EMAIL_RENDERER_VERSION} supports EUR invoices only.`,
      { currency: document.currency },
    );
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

function formatMoneyVisual(cents) {
  const euros = Math.floor(cents / 100);
  const remainder = String(cents % 100).padStart(2, '0');
  return `€${euros},${remainder}`;
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

const FONT_STACK = "Inter, 'Segoe UI', Arial, Helvetica, sans-serif";
const COLOR = Object.freeze({
  black: '#0A0A0A',
  charcoal: '#1A1A1A',
  surface: '#0F1711',
  surfaceAlt: '#121C15',
  green: '#2A8A4A',
  greenLight: '#3DA86A',
  greenDark: '#1D6A36',
  white: '#F5F5F5',
  muted: '#9A9A9A',
  line: '#29402F',
});

function renderItemRows(snapshot) {
  return snapshot.lines.map((line) => (
    '<tr><td style="padding:0 42px 22px 42px;">'
    + `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="border-collapse:separate;background:${COLOR.surfaceAlt};border:1px solid ${COLOR.line};border-radius:12px;">`
    + '<tr>'
    + '<td width="92" valign="middle" style="width:92px;padding:18px 0 18px 18px;">'
    + `<div aria-hidden="true" style="width:72px;height:82px;border-radius:8px;background:${COLOR.black};border:1px solid rgba(61,168,106,.28);color:${COLOR.greenLight};font-family:${FONT_STACK};font-size:11px;font-weight:700;letter-spacing:1.6px;line-height:82px;text-align:center;">LM</div>`
    + '</td>'
    + `<td valign="middle" style="padding:18px 14px;font-family:${FONT_STACK};">`
    + `<div style="font-size:17px;line-height:1.3;font-weight:700;color:${COLOR.white};">${escapeHtml(line.name)}</div>`
    + `<div style="margin-top:7px;font-size:13px;line-height:1.5;color:${COLOR.muted};">${escapeHtml(`${line.variantLabel} · ${line.sizeLabel}`)}</div>`
    + `<div style="margin-top:5px;font-size:12px;line-height:1.5;color:${COLOR.muted};">Quantity ${escapeHtml(line.quantity)}</div>`
    + `<div style="margin-top:5px;font-size:11px;line-height:1.5;color:#707970;">${escapeHtml(line.sku)}</div>`
    + '</td>'
    + `<td width="110" valign="middle" align="right" style="width:110px;padding:18px 18px 18px 8px;font-family:${FONT_STACK};font-size:15px;font-weight:700;color:${COLOR.white};white-space:nowrap;">${escapeHtml(formatMoneyVisual(line.lineTotalCents))}</td>`
    + '</tr></table></td></tr>'
  )).join('');
}

function summaryRow(label, value, { strong = false } = {}) {
  const weight = strong ? '700' : '400';
  const color = strong ? COLOR.white : COLOR.muted;
  const valueSize = strong ? '22px' : '14px';
  return '<tr>'
    + `<td style="padding:8px 0;font-family:${FONT_STACK};font-size:14px;line-height:1.4;font-weight:${weight};color:${color};">${escapeHtml(label)}</td>`
    + `<td align="right" style="padding:8px 0;font-family:${FONT_STACK};font-size:${valueSize};line-height:1.4;font-weight:${weight};color:${COLOR.white};white-space:nowrap;">${escapeHtml(value)}</td>`
    + '</tr>';
}

function renderHtml(snapshot) {
  const customerName = `${snapshot.customer.firstName} ${snapshot.customer.lastName}`;
  const sellerName = snapshot.seller.tradingName || snapshot.seller.legalName;
  const shippingAddressLines = [
    customerName,
    snapshot.customer.companyName || null,
    ...formatAddress(snapshot.customer.shippingAddress),
  ].filter(Boolean);
  const shippingAddress = shippingAddressLines
    .map((line) => escapeHtml(line))
    .join('<br>');
  const taxNote = snapshot.tax.legalText
    ? `<tr><td style="padding:14px 42px 0 42px;font-family:${FONT_STACK};font-size:11px;line-height:1.55;color:#758078;">${escapeHtml(snapshot.tax.legalText)}</td></tr>`
    : '';
  const supportLine = snapshot.seller.supportEmail
    ? `Questions about your order? Reply to this email or contact ${escapeHtml(snapshot.seller.supportEmail)}.`
    : 'Questions about your order? Reply to this email and we’ll help.';

  return '<!doctype html>'
    + '<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">'
    + '<meta name="color-scheme" content="dark"><meta name="supported-color-schemes" content="dark">'
    + '<title>LegendMural order confirmation</title></head>'
    + `<body style="margin:0;padding:0;background:${COLOR.black};color:${COLOR.white};">`
    + `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%;border-collapse:collapse;background:${COLOR.black};"><tr><td align="center" style="padding:28px 12px;">`
    + `<table role="presentation" width="620" cellspacing="0" cellpadding="0" border="0" style="width:100%;max-width:620px;border-collapse:separate;background:${COLOR.charcoal};border-radius:8px;overflow:hidden;">`
    + `<tr><td height="6" style="height:6px;background:${COLOR.green};font-size:0;line-height:0;">&nbsp;</td></tr>`
    + `<tr><td align="center" style="padding:26px 24px 30px 24px;background:${COLOR.charcoal};background-image:radial-gradient(circle at center,rgba(42,138,74,.28) 0,rgba(42,138,74,.12) 28%,rgba(26,26,26,0) 68%);">`
    + `<img src="${BRAND_LOGO_URL}" width="260" alt="LegendMural" style="display:block;width:260px;max-width:82%;height:auto;border:0;outline:none;text-decoration:none;filter:drop-shadow(0 0 8px rgba(42,138,74,.50)) drop-shadow(0 0 18px rgba(42,138,74,.18));">`
    + '</td></tr>'
    + `<tr><td align="center" style="padding:34px 42px 30px 42px;background:${COLOR.surface};font-family:${FONT_STACK};">`
    + `<table role="presentation" cellspacing="0" cellpadding="0" border="0" style="border-collapse:separate;background:rgba(42,138,74,.09);border:1px solid rgba(42,138,74,.42);border-radius:999px;"><tr><td style="padding:7px 14px;font-family:${FONT_STACK};font-size:10px;line-height:1.2;font-weight:700;letter-spacing:1.5px;color:${COLOR.greenLight};"><span style="display:inline-block;width:7px;height:7px;margin-right:8px;border-radius:50%;background:${COLOR.greenLight};vertical-align:1px;"></span>PAYMENT RECEIVED</td></tr></table>`
    + `<div style="padding-top:30px;font-family:${FONT_STACK};font-size:38px;line-height:1.12;font-weight:700;letter-spacing:-1.1px;color:${COLOR.white};">Your order is<br><span style="color:${COLOR.green};">confirmed.</span></div>`
    + `<div style="padding-top:18px;font-family:${FONT_STACK};font-size:14px;line-height:1.6;color:${COLOR.muted};">Thank you, ${escapeHtml(snapshot.customer.firstName)}. We’ll let you know when it’s ready to ship.</div>`
    + `<table role="presentation" width="264" cellspacing="0" cellpadding="0" border="0" style="width:264px;max-width:100%;margin-top:24px;border-collapse:separate;background:${COLOR.surfaceAlt};border:1px solid rgba(42,138,74,.30);border-radius:10px;"><tr><td align="center" style="padding:10px 14px 4px 14px;font-family:${FONT_STACK};font-size:9px;line-height:1.3;font-weight:700;letter-spacing:1.5px;color:#6F776F;">OFFICIAL ORDER NUMBER</td></tr><tr><td align="center" style="padding:0 14px 11px 14px;font-family:${FONT_STACK};font-size:15px;line-height:1.3;font-weight:600;letter-spacing:.6px;color:${COLOR.white};">${escapeHtml(snapshot.document.orderNumber)}</td></tr></table>`
    + '</td></tr>'
    + `<tr><td style="padding:34px 42px 16px 42px;background:${COLOR.surfaceAlt};font-family:${FONT_STACK};font-size:21px;line-height:1.3;font-weight:700;color:${COLOR.white};">Your order</td></tr>`
    + renderItemRows(snapshot)
    + `<tr><td style="padding:32px 42px 30px 42px;background:${COLOR.surface};">`
    + `<div style="padding-bottom:16px;font-family:${FONT_STACK};font-size:21px;line-height:1.3;font-weight:700;color:${COLOR.white};">Payment summary</div>`
    + '<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="border-collapse:collapse;">'
    + summaryRow('Subtotal', formatMoneyVisual(snapshot.totals.subtotalCents))
    + summaryRow(discountLabel(snapshot), `− ${formatMoneyVisual(snapshot.totals.discountCents)}`)
    + summaryRow('Shipping', formatMoneyVisual(snapshot.totals.shippingCents))
    + summaryRow('VAT / tax', formatMoneyVisual(snapshot.tax.taxAmountCents))
    + `<tr><td colspan="2" style="padding:10px 0 4px 0;"><div style="height:1px;background:${COLOR.line};font-size:0;line-height:0;">&nbsp;</div></td></tr>`
    + summaryRow('TOTAL PAID', formatMoneyVisual(snapshot.totals.grandTotalCents), { strong: true })
    + '</table></td></tr>'
    + taxNote
    + `<tr><td style="padding:30px 42px;background:${COLOR.surfaceAlt};">`
    + '<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0"><tr><td valign="top">'
    + `<div style="font-family:${FONT_STACK};font-size:21px;line-height:1.3;font-weight:700;color:${COLOR.white};">Shipping</div>`
    + `<div style="padding-top:16px;font-family:${FONT_STACK};font-size:14px;line-height:1.7;color:${COLOR.muted};">${shippingAddress}</div>`
    + `</td><td width="104" align="right" valign="top" style="width:104px;padding-left:14px;"><span style="display:inline-block;padding:9px 24px;border-radius:999px;background:${COLOR.green};font-family:${FONT_STACK};font-size:10px;line-height:1;font-weight:700;letter-spacing:1.5px;color:${COLOR.white};">PAID</span></td></tr></table>`
    + '</td></tr>'
    + `<tr><td style="padding:30px 42px 34px 42px;background:${COLOR.surface};">`
    + `<div style="font-family:${FONT_STACK};font-size:10px;line-height:1.3;font-weight:700;letter-spacing:1.6px;color:${COLOR.greenLight};">YOUR INVOICE</div>`
    + `<div style="padding-top:10px;font-family:${FONT_STACK};font-size:21px;line-height:1.3;font-weight:700;color:${COLOR.white};">${escapeHtml(snapshot.document.invoiceNumber)}</div>`
    + `<div style="padding-top:12px;font-family:${FONT_STACK};font-size:14px;line-height:1.6;color:${COLOR.muted};">Your PDF invoice is attached to this email.</div>`
    + `<div style="display:inline-block;margin-top:20px;padding:13px 22px;border:1px solid ${COLOR.green};border-radius:999px;font-family:${FONT_STACK};font-size:10px;line-height:1;font-weight:700;letter-spacing:1.5px;color:${COLOR.white};">PDF INVOICE ATTACHED</div>`
    + '</td></tr>'
    + `<tr><td style="padding:28px 34px 24px 34px;background:${COLOR.charcoal};">`
    + '<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0"><tr>'
    + `<td width="33.33%" align="center" style="font-family:${FONT_STACK};"><span style="display:inline-block;width:28px;height:28px;border-radius:50%;background:${COLOR.green};font-size:11px;line-height:28px;font-weight:700;color:${COLOR.white};">1</span><div style="padding-top:9px;font-size:10px;line-height:1.2;letter-spacing:1.4px;color:${COLOR.white};">PAID</div></td>`
    + `<td width="33.33%" align="center" style="font-family:${FONT_STACK};"><span style="display:inline-block;width:28px;height:28px;border-radius:50%;background:#2A2A2A;font-size:11px;line-height:28px;font-weight:700;color:${COLOR.white};">2</span><div style="padding-top:9px;font-size:10px;line-height:1.2;letter-spacing:1.4px;color:${COLOR.white};">PRODUCTION</div></td>`
    + `<td width="33.33%" align="center" style="font-family:${FONT_STACK};"><span style="display:inline-block;width:28px;height:28px;border-radius:50%;background:#2A2A2A;font-size:11px;line-height:28px;font-weight:700;color:${COLOR.white};">3</span><div style="padding-top:9px;font-size:10px;line-height:1.2;letter-spacing:1.4px;color:${COLOR.white};">SHIPPING</div></td>`
    + '</tr></table></td></tr>'
    + `<tr><td align="center" style="padding:24px 34px 28px 34px;background:${COLOR.surfaceAlt};font-family:${FONT_STACK};">`
    + `<div style="font-size:11px;line-height:1.6;color:${COLOR.muted};">${supportLine}</div>`
    + `<div style="padding-top:12px;font-size:10px;line-height:1.4;font-weight:700;letter-spacing:1.5px;color:${COLOR.white};">${escapeHtml(sellerName)} · ORDER CONFIRMATION</div>`
    + '</td></tr>'
    + '</table></td></tr></table></body></html>';
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
