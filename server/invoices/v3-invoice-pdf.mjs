import { createHash } from 'node:crypto';

import PDFDocument from 'pdfkit';

export const V3_INVOICE_PDF_RENDERER_VERSION = 1;
const SUPPORTED_SNAPSHOT_SCHEMA_VERSION = 1;
const SUPPORTED_CURRENCY = 'EUR';
const A4_MARGIN = 48;
const PAGE_BOTTOM = 794;

export class V3InvoicePdfError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = 'V3InvoicePdfError';
    this.code = code;
    this.details = details;
  }
}

function fail(code, message, details = {}) {
  throw new V3InvoicePdfError(code, message, details);
}

function requireObject(value, field) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    fail('INVALID_V3_INVOICE_PDF_SNAPSHOT', `${field} must be an object.`, { field });
  }
  return value;
}

function requireString(value, field) {
  if (typeof value !== 'string' || value.trim() === '') {
    fail('INVALID_V3_INVOICE_PDF_SNAPSHOT', `${field} must be a non-empty string.`, { field });
  }
  return value;
}

function optionalString(value, field) {
  if (value === null || value === undefined) return null;
  if (typeof value !== 'string') {
    fail('INVALID_V3_INVOICE_PDF_SNAPSHOT', `${field} must be a string or null.`, { field });
  }
  return value;
}

function requireNonnegativeInteger(value, field) {
  if (!Number.isSafeInteger(value) || value < 0) {
    fail('INVALID_V3_INVOICE_PDF_SNAPSHOT', `${field} must be a nonnegative integer.`, { field });
  }
  return value;
}

function requirePositiveInteger(value, field) {
  if (!Number.isSafeInteger(value) || value < 1) {
    fail('INVALID_V3_INVOICE_PDF_SNAPSHOT', `${field} must be a positive integer.`, { field });
  }
  return value;
}

function requireSnapshot(snapshotInput) {
  const snapshot = requireObject(snapshotInput, 'snapshot');
  if (snapshot.schemaVersion !== SUPPORTED_SNAPSHOT_SCHEMA_VERSION) {
    fail(
      'UNSUPPORTED_V3_INVOICE_SNAPSHOT_SCHEMA',
      `Renderer v${V3_INVOICE_PDF_RENDERER_VERSION} supports snapshot schema ${SUPPORTED_SNAPSHOT_SCHEMA_VERSION} only.`,
      { schemaVersion: snapshot.schemaVersion },
    );
  }

  const document = requireObject(snapshot.document, 'snapshot.document');
  requireString(document.orderNumber, 'snapshot.document.orderNumber');
  requireString(document.invoiceNumber, 'snapshot.document.invoiceNumber');
  requireNonnegativeInteger(document.issuedAt, 'snapshot.document.issuedAt');
  if (document.currency !== SUPPORTED_CURRENCY) {
    fail('UNSUPPORTED_V3_INVOICE_CURRENCY', 'Renderer v1 supports EUR invoices only.', {
      currency: document.currency,
    });
  }

  const seller = requireObject(snapshot.seller, 'snapshot.seller');
  requireString(seller.legalName, 'snapshot.seller.legalName');
  optionalString(seller.tradingName, 'snapshot.seller.tradingName');
  requireString(seller.registrationNumber, 'snapshot.seller.registrationNumber');
  requireString(seller.vatIdentificationNumber, 'snapshot.seller.vatIdentificationNumber');
  requireString(seller.invoiceEmail, 'snapshot.seller.invoiceEmail');
  requireString(seller.website, 'snapshot.seller.website');
  requireAddress(seller.address, 'snapshot.seller.address');

  const customer = requireObject(snapshot.customer, 'snapshot.customer');
  requireString(customer.firstName, 'snapshot.customer.firstName');
  requireString(customer.lastName, 'snapshot.customer.lastName');
  requireString(customer.email, 'snapshot.customer.email');
  optionalString(customer.companyName, 'snapshot.customer.companyName');
  requireAddress(customer.billingAddress, 'snapshot.customer.billingAddress');
  requireAddress(customer.shippingAddress, 'snapshot.customer.shippingAddress');

  const order = requireObject(snapshot.order, 'snapshot.order');
  requireString(order.reference, 'snapshot.order.reference');
  requireNonnegativeInteger(order.createdAt, 'snapshot.order.createdAt');
  requireNonnegativeInteger(order.paidAt, 'snapshot.order.paidAt');

  const payment = requireObject(snapshot.payment, 'snapshot.payment');
  requireString(payment.provider, 'snapshot.payment.provider');
  requireString(payment.providerOrderId, 'snapshot.payment.providerOrderId');
  optionalString(payment.providerCaptureId, 'snapshot.payment.providerCaptureId');
  requireNonnegativeInteger(payment.verifiedPaidAt, 'snapshot.payment.verifiedPaidAt');

  if (!Array.isArray(snapshot.lines) || snapshot.lines.length === 0) {
    fail('INVALID_V3_INVOICE_PDF_SNAPSHOT', 'snapshot.lines must contain at least one item.', {
      field: 'snapshot.lines',
    });
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

function requireAddress(addressInput, field) {
  const address = requireObject(addressInput, field);
  requireString(address.street, `${field}.street`);
  optionalString(address.line2, `${field}.line2`);
  requireString(address.postalCode, `${field}.postalCode`);
  requireString(address.city, `${field}.city`);
  requireString(address.countryCode, `${field}.countryCode`);
  return address;
}

function dateFromEpochSeconds(value) {
  const date = new Date(value * 1000);
  if (Number.isNaN(date.getTime())) {
    fail('INVALID_V3_INVOICE_PDF_SNAPSHOT', 'snapshot.document.issuedAt is outside Date range.', {
      field: 'snapshot.document.issuedAt',
    });
  }
  return date;
}

function formatUtcDate(epochSeconds) {
  return dateFromEpochSeconds(epochSeconds).toISOString().slice(0, 10);
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
  ].filter(Boolean).join('\n');
}

function filenameForInvoice(invoiceNumber) {
  const normalized = invoiceNumber
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Za-z0-9._-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^[-.]+|[-.]+$/g, '')
    .slice(0, 100);

  const fallback = createHash('sha256').update(invoiceNumber, 'utf8').digest('hex').slice(0, 16);
  return `invoice-${normalized || fallback}.pdf`;
}

function collectPdfBytes(document) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let byteLength = 0;

    document.on('data', (chunk) => {
      chunks.push(Buffer.from(chunk));
      byteLength += chunk.byteLength;
    });
    document.once('error', reject);
    document.once('end', () => {
      resolve(Buffer.concat(chunks, byteLength));
    });
  });
}

function drawRule(doc, y) {
  doc.save().lineWidth(0.6).moveTo(A4_MARGIN, y).lineTo(547, y).stroke().restore();
}

function drawLabelValue(doc, label, value, x, y, width) {
  doc.font('Helvetica-Bold').fontSize(8).text(label, x, y, { width, lineBreak: false });
  doc.font('Helvetica').fontSize(9).text(value, x, y + 12, { width });
}

function addContinuationPage(doc) {
  doc.addPage();
  doc.font('Helvetica-Bold').fontSize(11).text('INVOICE — CONTINUED', A4_MARGIN, A4_MARGIN);
  drawRule(doc, 70);
  return 86;
}

function ensureSpace(doc, y, requiredHeight) {
  return y + requiredHeight <= PAGE_BOTTOM ? y : addContinuationPage(doc);
}

function drawTableHeader(doc, y) {
  doc.font('Helvetica-Bold').fontSize(8);
  doc.text('ITEM', A4_MARGIN, y, { width: 260 });
  doc.text('QTY', 318, y, { width: 36, align: 'right' });
  doc.text('UNIT', 366, y, { width: 76, align: 'right' });
  doc.text('TOTAL', 454, y, { width: 93, align: 'right' });
  drawRule(doc, y + 13);
  return y + 21;
}

function drawLineItems(doc, snapshot, startY) {
  let y = drawTableHeader(doc, startY);

  for (const line of snapshot.lines) {
    doc.font('Helvetica').fontSize(9);
    const itemText = `${line.name}\n${line.sku} · ${line.variantLabel} · ${line.sizeLabel}`;
    const itemHeight = doc.heightOfString(itemText, { width: 252, lineGap: 1 });
    const rowHeight = Math.max(34, itemHeight + 8);

    const nextY = ensureSpace(doc, y, rowHeight + 22);
    if (nextY !== y) {
      y = drawTableHeader(doc, nextY);
    }

    doc.font('Helvetica').fontSize(9).text(itemText, A4_MARGIN, y, {
      width: 252,
      lineGap: 1,
    });
    doc.text(String(line.quantity), 318, y, { width: 36, align: 'right' });
    doc.text(formatMoney(line.unitPriceCents), 366, y, { width: 76, align: 'right' });
    doc.text(formatMoney(line.lineTotalCents), 454, y, { width: 93, align: 'right' });
    y += rowHeight;
    drawRule(doc, y - 5);
  }

  return y + 12;
}

function drawTotals(doc, snapshot, startY) {
  let y = ensureSpace(doc, startY, 150);
  const labelX = 330;
  const valueX = 438;
  const labelWidth = 100;
  const valueWidth = 109;

  const row = (label, cents, { bold = false } = {}) => {
    doc.font(bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(bold ? 10 : 9);
    doc.text(label, labelX, y, { width: labelWidth });
    doc.text(formatMoney(cents), valueX, y, { width: valueWidth, align: 'right' });
    y += bold ? 19 : 16;
  };

  row('Subtotal', snapshot.totals.subtotalCents);
  if (snapshot.totals.discountCents > 0) {
    row(`Discount${snapshot.discount.code ? ` (${snapshot.discount.code})` : ''}`, snapshot.totals.discountCents);
  }
  row('Shipping', snapshot.totals.shippingCents);
  row('Tax (stored)', snapshot.tax.taxAmountCents);
  drawRule(doc, y - 3);
  y += 6;
  row('Total paid', snapshot.totals.grandTotalCents, { bold: true });
  return y + 12;
}

function drawInvoice(doc, snapshot) {
  const contentWidth = 499;
  const sellerName = snapshot.seller.tradingName || snapshot.seller.legalName;

  doc.font('Helvetica-Bold').fontSize(25).text('INVOICE', A4_MARGIN, A4_MARGIN, {
    width: 220,
    lineBreak: false,
  });
  doc.font('Helvetica-Bold').fontSize(11).text(sellerName, 330, 51, {
    width: 217,
    align: 'right',
  });

  let y = 91;
  drawRule(doc, 78);
  drawLabelValue(doc, 'INVOICE NUMBER', snapshot.document.invoiceNumber, A4_MARGIN, y, 235);
  drawLabelValue(doc, 'ORDER NUMBER', snapshot.document.orderNumber, 310, y, 237);
  y += 48;
  drawLabelValue(doc, 'ISSUED', formatUtcDate(snapshot.document.issuedAt), A4_MARGIN, y, 160);
  drawLabelValue(doc, 'PAID', formatUtcDate(snapshot.order.paidAt), 210, y, 160);
  drawLabelValue(doc, 'CURRENCY', snapshot.document.currency, 430, y, 117);
  y += 50;
  drawRule(doc, y);
  y += 18;

  doc.font('Helvetica-Bold').fontSize(9).text('BILL TO', A4_MARGIN, y, { width: 225 });
  doc.font('Helvetica-Bold').fontSize(9).text('SELLER', 310, y, { width: 237 });
  y += 16;

  const customerName = [snapshot.customer.firstName, snapshot.customer.lastName].join(' ');
  const customerText = [
    snapshot.customer.companyName,
    customerName,
    snapshot.customer.email,
    formatAddress(snapshot.customer.billingAddress),
  ].filter(Boolean).join('\n');
  const sellerText = [
    snapshot.seller.legalName,
    formatAddress(snapshot.seller.address),
    `Registration: ${snapshot.seller.registrationNumber}`,
    `VAT ID: ${snapshot.seller.vatIdentificationNumber}`,
    snapshot.seller.invoiceEmail,
    snapshot.seller.website,
  ].join('\n');

  doc.font('Helvetica').fontSize(9).text(customerText, A4_MARGIN, y, { width: 225, lineGap: 2 });
  doc.font('Helvetica').fontSize(9).text(sellerText, 310, y, { width: 237, lineGap: 2 });
  const addressHeight = Math.max(
    doc.heightOfString(customerText, { width: 225, lineGap: 2 }),
    doc.heightOfString(sellerText, { width: 237, lineGap: 2 }),
  );
  y += addressHeight + 24;

  y = ensureSpace(doc, y, 90);
  doc.font('Helvetica-Bold').fontSize(9).text('SHIP TO', A4_MARGIN, y, { width: 225 });
  y += 16;
  const shippingText = [
    snapshot.customer.companyName,
    customerName,
    formatAddress(snapshot.customer.shippingAddress),
  ].filter(Boolean).join('\n');
  doc.font('Helvetica').fontSize(9).text(shippingText, A4_MARGIN, y, { width: 225, lineGap: 2 });
  y += doc.heightOfString(shippingText, { width: 225, lineGap: 2 }) + 24;

  y = ensureSpace(doc, y, 80);
  drawRule(doc, y - 8);
  y = drawLineItems(doc, snapshot, y + 8);
  y = drawTotals(doc, snapshot, y);

  y = ensureSpace(doc, y, 145);
  drawRule(doc, y);
  y += 15;
  doc.font('Helvetica-Bold').fontSize(9).text('TAX RECORD', A4_MARGIN, y, { width: contentWidth });
  y += 14;
  doc.font('Helvetica').fontSize(8).text(
    `${snapshot.tax.treatmentCode} · ${snapshot.tax.jurisdictionCode} · ${snapshot.tax.pricingBasis}\n`
      + `Taxable amount: ${formatMoney(snapshot.tax.taxableAmountCents)} · Stored tax: ${formatMoney(snapshot.tax.taxAmountCents)}`,
    A4_MARGIN,
    y,
    { width: contentWidth, lineGap: 2 },
  );
  y += 34;
  if (snapshot.tax.legalText) {
    doc.font('Helvetica').fontSize(8).text(snapshot.tax.legalText, A4_MARGIN, y, {
      width: contentWidth,
      lineGap: 2,
    });
    y += doc.heightOfString(snapshot.tax.legalText, { width: contentWidth, lineGap: 2 }) + 12;
  }

  y = ensureSpace(doc, y, 82);
  drawRule(doc, y);
  y += 14;
  doc.font('Helvetica-Bold').fontSize(8).text('PAYMENT EVIDENCE', A4_MARGIN, y, { width: contentWidth });
  y += 13;
  doc.font('Helvetica').fontSize(7.5).text(
    `Provider: ${snapshot.payment.provider}\n`
      + `Provider order: ${snapshot.payment.providerOrderId}\n`
      + `${snapshot.payment.providerCaptureId ? `Capture: ${snapshot.payment.providerCaptureId}\n` : ''}`
      + `Internal reference: ${snapshot.order.reference}`,
    A4_MARGIN,
    y,
    { width: contentWidth, lineGap: 1 },
  );
}

export async function renderV3InvoicePdf({ snapshot: snapshotInput } = {}) {
  const snapshot = requireSnapshot(snapshotInput);
  const issuedDate = dateFromEpochSeconds(snapshot.document.issuedAt);
  const document = new PDFDocument({
    size: 'A4',
    margins: {
      top: A4_MARGIN,
      right: A4_MARGIN,
      bottom: A4_MARGIN,
      left: A4_MARGIN,
    },
    pdfVersion: '1.4',
    compress: false,
    autoFirstPage: true,
    info: {
      Title: `Invoice ${snapshot.document.invoiceNumber}`,
      Author: snapshot.seller.legalName,
      Subject: 'Invoice',
      Keywords: 'LegendMural invoice',
      CreationDate: issuedDate,
      ModDate: issuedDate,
    },
  });

  const bytesPromise = collectPdfBytes(document);
  try {
    drawInvoice(document, snapshot);
    document.end();
  } catch (error) {
    document.destroy(error);
    await bytesPromise.catch(() => {});
    throw error;
  }

  const bytes = await bytesPromise;
  const sha256 = createHash('sha256').update(bytes).digest('hex');

  return Object.freeze({
    bytes,
    filename: filenameForInvoice(snapshot.document.invoiceNumber),
    rendererVersion: V3_INVOICE_PDF_RENDERER_VERSION,
    sha256,
    byteLength: bytes.byteLength,
  });
}