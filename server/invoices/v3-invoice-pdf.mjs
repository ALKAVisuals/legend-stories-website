import { createHash } from 'node:crypto';

import PDFDocument from 'pdfkit';

export const V3_INVOICE_PDF_RENDERER_VERSION = 2;
const SUPPORTED_SNAPSHOT_SCHEMA_VERSION = 1;
const SUPPORTED_CURRENCY = 'EUR';

const PAGE_WIDTH = 595.28;
const PAGE_HEIGHT = 841.89;
const MARGIN = 42;
const CONTENT_RIGHT = 553;
const CONTENT_WIDTH = CONTENT_RIGHT - MARGIN;
const CONTENT_BOTTOM = 720;
const FOOTER_Y = 742;

const COLORS = Object.freeze({
  paper: '#fbfcf9',
  ink: '#111412',
  black: '#020202',
  muted: '#6f746f',
  soft: '#8e948f',
  green: '#2a8a4a',
  rule: '#dfe5df',
  table: '#f0f5f1',
  card: '#f7f9f6',
  cardStroke: '#e0e5e0',
  paidFill: '#edf7f0',
  paidStroke: '#b9dcc4',
  footer: '#0f1711',
  footerMuted: '#9aa39b',
  white: '#f5f5f5',
});

// Exact official LegendMural logo vector used by the owner-approved A4 V1 mock-up.
const OFFICIAL_LEGENDMURAL_LOGO_PATH = 'M384 63L384 65L386 68L393 68L396 65L396 60L387 60ZM170 40L170 76L181 76L181 55L182 54L182 53L184 51L185 51L186 50L191 50L192 51L193 51L195 54L195 76L206 76L206 49L205 48L204 45L200 41L199 41L198 40L188 40L187 41L186 41L184 43L183 43L183 44L182 45L181 44L181 40ZM143 40L142 41L141 41L140 42L137 43L134 46L134 47L132 49L132 51L131 52L131 55L130 56L130 61L131 62L131 65L132 66L133 69L137 73L138 73L140 75L142 75L143 76L156 76L157 75L158 75L159 74L162 73L164 71L164 69L160 65L158 65L153 68L148 68L147 67L146 67L142 63L142 62L143 61L167 61L167 54L166 53L166 51L165 50L165 48L161 43L160 43L157 41L155 41L154 40ZM142 52L146 48L152 48L156 52L156 54L155 55L143 55L142 54ZM55 52L55 64L56 65L56 67L58 69L58 70L61 73L62 73L67 76L80 76L81 75L83 75L85 73L86 73L89 70L84 65L82 65L80 67L78 67L77 68L72 68L71 67L70 67L67 64L67 63L66 62L67 61L91 61L92 62L92 64L93 65L94 68L98 72L99 72L100 73L102 73L103 74L110 74L111 73L113 73L116 70L117 71L117 75L116 76L116 77L114 79L113 79L112 80L110 80L109 81L107 81L106 80L102 80L97 77L96 78L96 79L93 84L93 85L94 85L96 87L98 87L99 88L101 88L102 89L115 89L116 88L118 88L119 87L120 87L122 85L123 85L125 83L125 82L128 77L128 40L117 40L117 43L116 44L113 41L112 41L111 40L101 40L100 41L99 41L97 43L96 43L96 44L93 47L93 48L92 49L92 51L91 52L90 51L90 50L89 49L88 46L85 43L84 43L82 41L80 41L79 40L68 40L67 41L65 41L64 42L63 42L61 44L60 44L59 45L59 46L57 48L57 49ZM108 48L110 48L111 49L113 49L116 52L116 53L117 54L117 60L116 61L116 62L113 65L112 65L111 66L108 66L107 65L104 64L102 61L102 58L101 57L102 56L102 53L103 52L103 51L105 49L107 49ZM66 53L67 52L67 51L69 49L70 49L71 48L76 48L77 49L78 49L80 52L80 54L79 55L67 55L66 54ZM40 27L40 75L41 76L51 76L51 68L52 67L52 56L51 55L51 38L52 37L52 28L51 27ZM208 63L209 64L209 66L210 67L211 70L215 74L216 74L219 76L228 76L229 77L228 78L228 80L227 81L227 83L228 84L229 87L232 89L430 89L431 88L433 88L434 87L435 87L436 86L439 85L443 81L443 80L445 78L446 75L448 73L449 70L451 68L452 65L454 63L455 60L457 58L457 57L458 56L459 53L461 51L462 48L464 46L465 43L467 41L468 38L470 36L471 33L473 31L473 30L474 29L475 26L477 24L477 23L479 20L479 18L480 17L479 16L479 14L478 13L478 12L475 10L276 10L275 11L273 11L272 12L271 12L269 14L268 14L263 19L262 22L260 24L259 27L257 29L256 32L254 34L254 35L252 38L252 40L256 40L257 41L257 45L261 41L262 41L263 40L265 40L266 39L271 39L272 40L274 40L275 41L276 41L280 45L280 46L281 47L281 46L286 41L287 41L288 40L290 40L291 39L296 39L297 40L299 40L300 41L301 41L305 45L305 46L306 47L306 50L307 51L307 74L305 76L296 76L295 75L295 54L294 53L294 52L292 50L290 50L289 49L288 49L287 50L284 51L284 52L282 55L282 75L281 76L271 76L270 75L270 54L269 53L269 52L267 50L266 50L265 49L264 49L263 50L261 50L258 53L258 55L257 56L257 75L256 76L246 76L245 75L245 41L247 39L247 27L236 27L236 43L235 44L233 42L232 42L229 40L219 40L218 41L215 42L211 46L211 47L209 50L209 52L208 53ZM432 65L434 65L435 66L437 66L439 69L439 73L436 76L431 76L428 73L428 68L430 66L431 66ZM224 49L230 49L231 50L232 50L234 52L234 53L235 54L235 57L236 58L235 59L235 63L231 67L224 67L220 63L220 62L219 61L219 56L220 55L220 53ZM310 41L311 40L321 40L322 41L322 63L325 66L329 66L330 65L331 65L333 63L333 62L334 61L334 41L335 40L345 40L346 41L346 75L345 76L335 76L334 75L334 70L334 71L331 74L330 74L327 76L319 76L318 75L316 75L311 70L311 69L310 68ZM378 42L379 42L380 41L383 41L384 40L387 40L388 39L395 39L396 40L399 40L400 41L403 42L407 46L407 48L408 49L408 75L407 76L398 76L396 74L396 72L393 75L391 75L390 76L381 76L380 75L379 75L374 70L374 69L373 68L373 62L374 61L374 60L378 56L379 56L380 55L382 55L383 54L396 54L396 51L393 48L385 48L384 49L382 49L381 50L379 50L377 48L377 47L376 46L376 44ZM374 39L375 40L375 48L373 50L368 50L364 54L364 55L363 56L363 75L362 76L352 76L351 75L351 41L352 40L362 40L363 41L363 45L367 41L368 41L369 40L371 40L372 39ZM414 26L423 26L424 27L424 75L423 76L414 76L412 74L412 28Z';

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

function requireAddress(addressInput, field) {
  const address = requireObject(addressInput, field);
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
      `Renderer v${V3_INVOICE_PDF_RENDERER_VERSION} supports snapshot schema ${SUPPORTED_SNAPSHOT_SCHEMA_VERSION} only.`,
      { schemaVersion: snapshot.schemaVersion },
    );
  }

  const document = requireObject(snapshot.document, 'snapshot.document');
  requireString(document.orderNumber, 'snapshot.document.orderNumber');
  requireString(document.invoiceNumber, 'snapshot.document.invoiceNumber');
  requireNonnegativeInteger(document.issuedAt, 'snapshot.document.issuedAt');
  if (document.currency !== SUPPORTED_CURRENCY) {
    fail('UNSUPPORTED_V3_INVOICE_CURRENCY', 'Renderer v2 supports EUR invoices only.', {
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
  requireNonnegativeInteger(totals.discountedSubtotalCents, 'snapshot.totals.discountedSubtotalCents');
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
  return `€${euros}.${remainder}`;
}

function formatAddressLines(address) {
  return [
    [address.street, address.line2].filter(Boolean).join(' · '),
    `${address.postalCode} ${address.city} · ${address.countryCode}`,
  ].filter(Boolean);
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
    document.once('end', () => resolve(Buffer.concat(chunks, byteLength)));
  });
}

function drawRule(doc, y, { green = false, x = MARGIN, right = CONTENT_RIGHT, width = null } = {}) {
  doc.save()
    .strokeColor(green ? COLORS.green : COLORS.rule)
    .lineWidth(width ?? (green ? 1.4 : 0.8))
    .moveTo(x, y)
    .lineTo(right, y)
    .stroke()
    .restore();
}

function drawOfficialLogo(doc) {
  doc.save()
    .translate(MARGIN, 36)
    .scale(0.30)
    .path(OFFICIAL_LEGENDMURAL_LOGO_PATH)
    .fill(COLORS.black, 'even-odd')
    .restore();
}

function drawLegalFooterBase(doc, snapshot) {
  doc.save().roundedRect(MARGIN, FOOTER_Y, CONTENT_WIDTH, 48, 5).fill(COLORS.footer);
  doc.rect(MARGIN, FOOTER_Y, 5, 48).fill(COLORS.green);
  doc.restore();

  const sellerAddress = formatAddressLines(snapshot.seller.address).join(' · ');
  const legalLine = [
    snapshot.seller.legalName,
    `Registration: ${snapshot.seller.registrationNumber}`,
    `VAT: ${snapshot.seller.vatIdentificationNumber}`,
  ].join(' · ');
  const contactLine = [sellerAddress, snapshot.seller.invoiceEmail, snapshot.seller.website].join(' · ');

  doc.fillColor(COLORS.footerMuted).font('Helvetica-Bold').fontSize(6.4)
    .text('LEGAL / SELLER', MARGIN + 18, FOOTER_Y + 10, { width: CONTENT_WIDTH - 34 });
  doc.fillColor(COLORS.white).font('Helvetica').fontSize(6.5)
    .text(legalLine, MARGIN + 18, FOOTER_Y + 22, { width: CONTENT_WIDTH - 34, lineBreak: false, ellipsis: true });
  doc.fillColor(COLORS.footerMuted).font('Helvetica').fontSize(5.8)
    .text(contactLine, MARGIN + 18, FOOTER_Y + 34, { width: CONTENT_WIDTH - 34, lineBreak: false, ellipsis: true });
}

function preparePage(doc, snapshot) {
  doc.save().rect(0, 0, PAGE_WIDTH, PAGE_HEIGHT).fill(COLORS.paper).restore();
  drawLegalFooterBase(doc, snapshot);
}

function drawPageNumber(doc, pageNumber, pageCount) {
  doc.fillColor(COLORS.soft).font('Helvetica').fontSize(6.2)
    .text('LegendMural V3 · Invoice', MARGIN, 812, { width: 180, lineBreak: false });
  doc.text(`Page ${pageNumber} / ${pageCount}`, 430, 812, {
    width: CONTENT_RIGHT - 430,
    align: 'right',
    lineBreak: false,
  });
}

function drawHeader(doc, snapshot) {
  drawOfficialLogo(doc);
  doc.fillColor(COLORS.ink).font('Helvetica-Bold').fontSize(27)
    .text('INVOICE', 360, 37, { width: 193, align: 'right', lineBreak: false });
  doc.fillColor(COLORS.green).font('Helvetica-Bold').fontSize(10.5)
    .text(snapshot.document.invoiceNumber, 330, 70, { width: 223, align: 'right', lineBreak: false });
  doc.fillColor(COLORS.muted).font('Helvetica').fontSize(7.2)
    .text(`Issued ${formatUtcDate(snapshot.document.issuedAt)}`, 360, 87, {
      width: 193,
      align: 'right',
      lineBreak: false,
    });
  drawRule(doc, 111, { green: true });
}

function drawMeta(doc, snapshot) {
  const label = (text, x, width) => {
    doc.fillColor(COLORS.muted).font('Helvetica-Bold').fontSize(7.2)
      .text(text, x, 128, { width, characterSpacing: 0.7, lineBreak: false });
  };
  const value = (text, x, width) => {
    doc.fillColor(COLORS.ink).font('Helvetica').fontSize(8.7)
      .text(text, x, 145, { width, lineBreak: false, ellipsis: true });
  };

  label('OFFICIAL ORDER', MARGIN, 150);
  value(snapshot.document.orderNumber, MARGIN, 150);
  label('PAID', 217, 85);
  value(formatUtcDate(snapshot.order.paidAt), 217, 85);
  label('CURRENCY', 337, 70);
  value(snapshot.document.currency, 337, 70);

  doc.save()
    .roundedRect(445, 127, 108, 29, 14)
    .fillAndStroke(COLORS.paidFill, COLORS.paidStroke)
    .circle(461, 141.5, 4)
    .fill(COLORS.green)
    .restore();
  doc.fillColor(COLORS.green).font('Helvetica-Bold').fontSize(5.8)
    .text('PAYMENT RECEIVED', 472, 138, { width: 72, lineBreak: false });
  drawRule(doc, 174);
}

function drawLines(doc, lines, x, y, width, { fontSize = 7.5, boldFirst = false } = {}) {
  let currentY = y;
  lines.forEach((line, index) => {
    doc.fillColor(index === 0 ? COLORS.ink : COLORS.muted)
      .font(index === 0 && boldFirst ? 'Helvetica-Bold' : 'Helvetica')
      .fontSize(index === 0 ? 8.7 : fontSize);
    const height = doc.heightOfString(line, { width, lineGap: 1 });
    doc.text(line, x, currentY, { width, lineGap: 1 });
    currentY += height + 3;
  });
  return currentY;
}

function drawParties(doc, snapshot) {
  const customerName = [snapshot.customer.firstName, snapshot.customer.lastName].join(' ');
  const billLines = [
    snapshot.customer.companyName,
    customerName,
    snapshot.customer.email,
    ...formatAddressLines(snapshot.customer.billingAddress),
  ].filter(Boolean);
  const shipLines = [
    snapshot.customer.companyName,
    customerName,
    ...formatAddressLines(snapshot.customer.shippingAddress),
  ].filter(Boolean);
  const sellerDisplay = snapshot.seller.tradingName || snapshot.seller.legalName;
  const sellerLines = [
    sellerDisplay,
    snapshot.seller.tradingName && snapshot.seller.tradingName !== snapshot.seller.legalName
      ? snapshot.seller.legalName
      : null,
    ...formatAddressLines(snapshot.seller.address),
    `Registration: ${snapshot.seller.registrationNumber}`,
    `VAT: ${snapshot.seller.vatIdentificationNumber}`,
    snapshot.seller.invoiceEmail,
  ].filter(Boolean);

  const columns = [
    { title: 'BILL TO', x: MARGIN, width: 168, lines: billLines },
    { title: 'SHIP TO', x: 233, width: 150, lines: shipLines },
    { title: 'SELLER', x: 405, width: 148, lines: sellerLines },
  ];
  let bottom = 198;
  for (const column of columns) {
    doc.fillColor(COLORS.ink).font('Helvetica-Bold').fontSize(9.2)
      .text(column.title, column.x, 194, { width: column.width, lineBreak: false });
    const end = drawLines(doc, column.lines, column.x, 213, column.width, { fontSize: 6.8, boldFirst: true });
    bottom = Math.max(bottom, end);
  }
  return Math.max(289, bottom + 18);
}

function drawContinuationHeader(doc, snapshot) {
  drawOfficialLogo(doc);
  doc.fillColor(COLORS.ink).font('Helvetica-Bold').fontSize(15)
    .text('INVOICE — CONTINUED', 300, 41, { width: 253, align: 'right', lineBreak: false });
  doc.fillColor(COLORS.green).font('Helvetica-Bold').fontSize(8.5)
    .text(snapshot.document.invoiceNumber, 330, 63, { width: 223, align: 'right', lineBreak: false });
  drawRule(doc, 86, { green: true });
  return 103;
}

function addContinuationPage(doc, snapshot) {
  doc.addPage();
  preparePage(doc, snapshot);
  return drawContinuationHeader(doc, snapshot);
}

function ensureSpace(doc, snapshot, y, requiredHeight) {
  return y + requiredHeight <= CONTENT_BOTTOM ? y : addContinuationPage(doc, snapshot);
}

function drawTableHeader(doc, y) {
  doc.save().roundedRect(MARGIN, y, CONTENT_WIDTH, 28, 4).fill(COLORS.table).restore();
  doc.fillColor(COLORS.muted).font('Helvetica-Bold').fontSize(7.2);
  doc.text('ITEM', 54, y + 10, { width: 260, characterSpacing: 0.6, lineBreak: false });
  doc.text('QTY', 330, y + 10, { width: 30, align: 'right', lineBreak: false });
  doc.text('UNIT', 374, y + 10, { width: 72, align: 'right', lineBreak: false });
  doc.text('TOTAL', 458, y + 10, { width: 83, align: 'right', lineBreak: false });
  return y + 39;
}

function drawLineItems(doc, snapshot, startY) {
  let y = drawTableHeader(doc, startY);
  for (const line of snapshot.lines) {
    const descriptor = `${line.sku} · ${line.variantLabel} · ${line.sizeLabel}`;
    doc.font('Helvetica-Bold').fontSize(8.7);
    const nameHeight = doc.heightOfString(line.name, { width: 265 });
    doc.font('Helvetica').fontSize(7.2);
    const detailHeight = doc.heightOfString(descriptor, { width: 265 });
    const rowHeight = Math.max(48, nameHeight + detailHeight + 17);

    const nextY = ensureSpace(doc, snapshot, y, rowHeight + 10);
    if (nextY !== y) y = drawTableHeader(doc, nextY);

    doc.fillColor(COLORS.ink).font('Helvetica-Bold').fontSize(8.7)
      .text(line.name, 54, y, { width: 265 });
    doc.fillColor(COLORS.muted).font('Helvetica').fontSize(7.2)
      .text(descriptor, 54, y + nameHeight + 3, { width: 265 });
    doc.fillColor(COLORS.ink).font('Helvetica').fontSize(8.7)
      .text(String(line.quantity), 330, y + 6, { width: 30, align: 'right', lineBreak: false });
    doc.text(formatMoney(line.unitPriceCents), 374, y + 6, { width: 72, align: 'right', lineBreak: false });
    doc.text(formatMoney(line.lineTotalCents), 458, y + 6, { width: 83, align: 'right', lineBreak: false });
    drawRule(doc, y + rowHeight - 5, { x: 54, right: 541 });
    y += rowHeight;
  }
  return y + 14;
}

function drawTaxAndTotals(doc, snapshot, startY) {
  const legalText = snapshot.tax.legalText || '';
  doc.font('Helvetica').fontSize(6.5);
  const legalHeight = legalText ? doc.heightOfString(legalText, { width: 238, lineGap: 1 }) : 0;
  const cardHeight = Math.max(124, 95 + legalHeight);
  const y = ensureSpace(doc, snapshot, startY, Math.max(cardHeight, 132) + 8);

  doc.save().roundedRect(MARGIN, y, 270, cardHeight, 5)
    .fillAndStroke(COLORS.card, COLORS.cardStroke).restore();
  doc.fillColor(COLORS.ink).font('Helvetica-Bold').fontSize(9.2)
    .text('TAX RECORD', 56, y + 17, { width: 230, lineBreak: false });
  doc.fillColor(COLORS.muted).font('Helvetica').fontSize(6.5)
    .text('Stored authoritative values only', 56, y + 35, { width: 230, lineBreak: false });
  doc.fillColor(COLORS.ink).font('Helvetica').fontSize(7.3)
    .text(`Treatment: ${snapshot.tax.treatmentCode}`, 56, y + 53, { width: 238 });
  doc.text(`Jurisdiction: ${snapshot.tax.jurisdictionCode}`, 56, y + 68, { width: 238 });
  doc.text(`Pricing basis: ${snapshot.tax.pricingBasis}`, 56, y + 83, { width: 238 });
  doc.fillColor(COLORS.muted).font('Helvetica').fontSize(6.3)
    .text(
      `Taxable: ${formatMoney(snapshot.tax.taxableAmountCents)} · Stored tax: ${formatMoney(snapshot.tax.taxAmountCents)}`,
      56,
      y + 99,
      { width: 238 },
    );
  if (legalText) doc.text(legalText, 56, y + 114, { width: 238, lineGap: 1 });

  let totalsY = y + 10;
  const labelX = 382;
  const valueX = 465;
  const valueWidth = 76;
  const row = (label, cents, { negative = false } = {}) => {
    doc.fillColor(COLORS.muted).font('Helvetica').fontSize(8.2)
      .text(label, labelX, totalsY, { width: 79 });
    doc.fillColor(COLORS.ink).font('Helvetica').fontSize(8.7)
      .text(`${negative ? '-' : ''}${formatMoney(cents)}`, valueX, totalsY, {
        width: valueWidth,
        align: 'right',
        lineBreak: false,
      });
    totalsY += 23;
  };

  row('Subtotal', snapshot.totals.subtotalCents);
  if (snapshot.totals.discountCents > 0) {
    row(`Discount${snapshot.discount.code ? ` (${snapshot.discount.code})` : ''}`, snapshot.totals.discountCents, {
      negative: true,
    });
  }
  row('Shipping', snapshot.totals.shippingCents);
  row('Tax (stored)', snapshot.tax.taxAmountCents);
  drawRule(doc, totalsY - 7, { green: true, x: labelX, right: 541 });
  doc.fillColor(COLORS.ink).font('Helvetica-Bold').fontSize(9.2)
    .text('TOTAL PAID', labelX, totalsY + 5, { width: 90, lineBreak: false });
  doc.fontSize(15).text(formatMoney(snapshot.totals.grandTotalCents), 457, totalsY + 2, {
    width: 84,
    align: 'right',
    lineBreak: false,
  });
  return y + Math.max(cardHeight, totalsY - y + 35) + 16;
}

function drawPaymentEvidence(doc, snapshot, startY) {
  let y = ensureSpace(doc, snapshot, startY, 88);
  drawRule(doc, y);
  y += 21;
  doc.fillColor(COLORS.ink).font('Helvetica-Bold').fontSize(9.2)
    .text('PAYMENT EVIDENCE', MARGIN, y, { width: 180, lineBreak: false });
  y += 19;
  const fields = [
    ['Provider', snapshot.payment.provider, MARGIN, 68],
    ['Provider order', snapshot.payment.providerOrderId, 119, 194],
    ['Capture', snapshot.payment.providerCaptureId || '—', 330, 223],
  ];
  for (const [label, value, x, width] of fields) {
    doc.fillColor(COLORS.muted).font('Helvetica').fontSize(6.5)
      .text(label, x, y, { width, lineBreak: false });
    doc.fillColor(COLORS.ink).font('Helvetica').fontSize(7.3)
      .text(value, x, y + 14, { width, lineBreak: false, ellipsis: true });
  }
  return y + 40;
}

function drawInvoice(doc, snapshot) {
  preparePage(doc, snapshot);
  drawHeader(doc, snapshot);
  drawMeta(doc, snapshot);
  let y = drawParties(doc, snapshot);
  y = drawLineItems(doc, snapshot, y);
  y = drawTaxAndTotals(doc, snapshot, y);
  drawPaymentEvidence(doc, snapshot, y);
}

function addPageNumbers(doc) {
  const range = doc.bufferedPageRange();
  for (let index = 0; index < range.count; index += 1) {
    doc.switchToPage(range.start + index);
    drawPageNumber(doc, index + 1, range.count);
  }
}

export async function renderV3InvoicePdf({ snapshot: snapshotInput } = {}) {
  const snapshot = requireSnapshot(snapshotInput);
  const issuedDate = dateFromEpochSeconds(snapshot.document.issuedAt);
  const document = new PDFDocument({
    size: 'A4',
    margins: { top: MARGIN, right: MARGIN, bottom: MARGIN, left: MARGIN },
    pdfVersion: '1.4',
    compress: false,
    autoFirstPage: true,
    bufferPages: true,
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
    addPageNumbers(document);
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
