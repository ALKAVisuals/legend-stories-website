const RESEND_EMAIL_ENDPOINT = 'https://api.resend.com/emails';
const V3_REFERENCE_PATTERN = /^[a-f0-9]{64}$/;
const SUPPORTED_V3_EMAIL_RENDERER_VERSION = 1;

export class ResendPaidOrderNotifierError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = 'ResendPaidOrderNotifierError';
    this.code = code;
    this.details = details;
  }
}

function fail(code, message, details) {
  throw new ResendPaidOrderNotifierError(code, message, details);
}

function requiredText(value, field, maxLength) {
  const normalized = String(value || '').trim();
  if (!normalized || normalized.length > maxLength || /[\u0000-\u001F\u007F]/.test(normalized)) {
    fail('RESEND_PAID_ORDER_INVALID_CONFIG', `${field} is invalid.`, { field });
  }
  return normalized;
}

function requiredEmail(value, field) {
  const email = requiredText(value, field, 320).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    fail('RESEND_PAID_ORDER_INVALID_CONFIG', `${field} is invalid.`, { field });
  }
  return email;
}

function optionalText(value, field, maxLength) {
  const normalized = String(value || '').trim();
  if (!normalized) return '';
  if (normalized.length > maxLength || /[\u0000-\u001F\u007F]/.test(normalized)) {
    fail('RESEND_PAID_ORDER_INVALID_CONFIG', `${field} is invalid.`, { field });
  }
  return normalized;
}

function requiredMessageString(value, field, maxLength) {
  if (typeof value !== 'string' || value.trim() === '' || value.length > maxLength || value.includes('\u0000')) {
    fail('RESEND_PAID_ORDER_INVALID_MESSAGE', `${field} is invalid.`, { field });
  }
  return value;
}

function normalizeV3OrderReference(value) {
  const reference = String(value || '').trim().toLowerCase();
  if (!V3_REFERENCE_PATTERN.test(reference)) {
    fail('RESEND_PAID_ORDER_INVALID_MESSAGE', 'orderReference is invalid.', {
      field: 'orderReference',
    });
  }
  return reference;
}

function normalizeV3RenderedEmail(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    fail('RESEND_PAID_ORDER_INVALID_MESSAGE', 'renderedEmail is invalid.', {
      field: 'renderedEmail',
    });
  }
  if (value.rendererVersion !== SUPPORTED_V3_EMAIL_RENDERER_VERSION) {
    fail('RESEND_PAID_ORDER_INVALID_MESSAGE', 'renderedEmail.rendererVersion is unsupported.', {
      field: 'renderedEmail.rendererVersion',
    });
  }
  return Object.freeze({
    subject: requiredMessageString(value.subject, 'renderedEmail.subject', 998),
    text: requiredMessageString(value.text, 'renderedEmail.text', 200_000),
    html: requiredMessageString(value.html, 'renderedEmail.html', 500_000),
    rendererVersion: value.rendererVersion,
  });
}

function normalizeV3Attachment(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    fail('RESEND_PAID_ORDER_INVALID_MESSAGE', 'attachment is invalid.', { field: 'attachment' });
  }
  const filename = String(value.filename || '').trim();
  if (!filename
    || filename.length > 200
    || /[\u0000-\u001F\u007F]/.test(filename)
    || /[\\/]/.test(filename)
    || !filename.toLowerCase().endsWith('.pdf')) {
    fail('RESEND_PAID_ORDER_INVALID_MESSAGE', 'attachment.filename is invalid.', {
      field: 'attachment.filename',
    });
  }
  if (!Buffer.isBuffer(value.bytes) || value.bytes.byteLength < 1) {
    fail('RESEND_PAID_ORDER_INVALID_MESSAGE', 'attachment.bytes must be a non-empty Buffer.', {
      field: 'attachment.bytes',
    });
  }
  return Object.freeze({ filename, bytes: value.bytes });
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function eurosFromCents(cents) {
  const value = Number(cents);
  if (!Number.isInteger(value) || value < 0) return '€0.00';
  return `€${(value / 100).toFixed(2)}`;
}

function eurosFromAmount(amount) {
  const value = Number(amount);
  if (!Number.isFinite(value) || value < 0) return '€0.00';
  return `€${value.toFixed(2)}`;
}

function displayReference(reference) {
  const source = String(reference || '').trim().toUpperCase();
  return source ? `LM-${source.slice(0, 12)}` : 'LegendMural order';
}

function addressLines(customer = {}) {
  return [
    `${customer.firstname || ''} ${customer.lastname || ''}`.trim(),
    customer.street || '',
    customer.line2 || '',
    `${customer.zip || ''} ${customer.city || ''}`.trim(),
    customer.country || '',
  ].filter(Boolean);
}

function itemText(item = {}) {
  const quantity = Number.isInteger(Number(item.quantity)) && Number(item.quantity) > 0
    ? Number(item.quantity)
    : 1;
  const size = item.variantLabel || item.sizeLabel || (item.sizeCm ? `${item.sizeCm} cm` : '');
  const details = [item.name || item.sku || 'LegendMural sticker', size].filter(Boolean).join(' — ');
  const unitPrice = eurosFromAmount(item.unitPrice || 0);
  const lineTotal = eurosFromAmount(item.lineTotal ?? ((item.unitPrice || 0) * quantity));
  return `${quantity} × ${details} — ${unitPrice} each — ${lineTotal}`;
}

function itemHtml(item = {}) {
  return `<li>${escapeHtml(itemText(item))}</li>`;
}

function discountLabel(order = {}) {
  const code = String(order.discount?.code || '').trim();
  const percent = Number(order.discount?.percent);
  if (code && Number.isFinite(percent) && percent > 0) return `Discount (${code}, ${percent}%)`;
  if (code) return `Discount (${code})`;
  return 'Discount';
}

function totalRows(order = {}) {
  const totals = order.totals || {};
  return [
    ['Subtotal', totals.subtotal],
    [discountLabel(order), totals.discount],
    ['Shipping', totals.shipping],
    ['Total paid', totals.grandTotal ?? order.amountTotal],
  ];
}

function renderMerchant(order) {
  const ref = displayReference(order.reference);
  const customer = order.customer || {};
  const lines = [
    'NEW PAID LEGENDMURAL ORDER',
    '',
    `Reference: ${ref}`,
    'Status: PAID',
    `Paid at: ${order.paidAt ? new Date(order.paidAt * 1000).toISOString() : 'confirmed'}`,
    `PayPal order ID: ${order.paymentSessionId || ''}`,
    `Customer: ${customer.firstname || ''} ${customer.lastname || ''}`.trim(),
    `Email: ${customer.email || ''}`,
    '',
    'Shipping address:',
    ...addressLines(customer),
    `Shipping zone: ${order.shipping?.zone || ''}`,
    '',
    'Items:',
    ...(order.items || []).map(itemText),
    '',
    ...totalRows(order).map(([label, value]) => `${label}: ${eurosFromCents(value)}`),
  ];

  const totals = totalRows(order)
    .map(([label, value]) => `<tr><td style="padding:4px 12px 4px 0">${escapeHtml(label)}</td><td style="padding:4px 0;text-align:right"><strong>${escapeHtml(eurosFromCents(value))}</strong></td></tr>`)
    .join('');
  const address = addressLines(customer).map((line) => escapeHtml(line)).join('<br>');
  const items = (order.items || []).map(itemHtml).join('');
  const html = `<!doctype html><html><body style="font-family:Arial,sans-serif;line-height:1.5;color:#111;max-width:680px;margin:0 auto;padding:24px"><p style="font-size:12px;letter-spacing:.12em;font-weight:700">LEGENDMURAL · PAID ORDER</p><h1 style="font-size:24px">New paid order</h1><p><strong>${escapeHtml(ref)}</strong><br>Status: <strong>PAID</strong><br>Paid at: ${escapeHtml(order.paidAt ? new Date(order.paidAt * 1000).toISOString() : 'confirmed')}<br>PayPal order ID: ${escapeHtml(order.paymentSessionId || '')}</p><h2 style="font-size:17px">Customer</h2><p>${escapeHtml(`${customer.firstname || ''} ${customer.lastname || ''}`.trim())}<br>${escapeHtml(customer.email || '')}</p><h2 style="font-size:17px">Shipping address</h2><p>${address}</p><p><strong>Shipping zone:</strong> ${escapeHtml(order.shipping?.zone || '')}</p><h2 style="font-size:17px">Items</h2><ul>${items}</ul><table style="border-collapse:collapse">${totals}</table></body></html>`;
  return { subject: `New paid order — ${ref} — ${eurosFromCents(order.amountTotal)}`, text: lines.join('\n'), html };
}

function renderCustomer(order) {
  const ref = displayReference(order.reference);
  const customer = order.customer || {};
  const firstName = customer.firstname || 'there';
  const lines = [
    `Hi ${firstName},`,
    '',
    'Thank you for your LegendMural order. Your payment has been received and your order is confirmed.',
    '',
    `Order ID: ${order.paymentSessionId || ''}`,
    `Reference: ${ref}`,
    '',
    'Items:',
    ...(order.items || []).map(itemText),
    '',
    ...totalRows(order).map(([label, value]) => `${label}: ${eurosFromCents(value)}`),
    '',
    'Shipping to:',
    ...addressLines(customer),
    '',
    'We will use this address for fulfilment. If anything looks incorrect, reply to this email as soon as possible.',
    '',
    'LegendMural',
  ];
  const totals = totalRows(order)
    .map(([label, value]) => `<tr><td style="padding:4px 12px 4px 0">${escapeHtml(label)}</td><td style="padding:4px 0;text-align:right"><strong>${escapeHtml(eurosFromCents(value))}</strong></td></tr>`)
    .join('');
  const address = addressLines(customer).map((line) => escapeHtml(line)).join('<br>');
  const items = (order.items || []).map(itemHtml).join('');
  const html = `<!doctype html><html><body style="font-family:Arial,sans-serif;line-height:1.6;color:#111;max-width:680px;margin:0 auto;padding:24px"><p style="font-size:12px;letter-spacing:.12em;font-weight:700">LEGENDMURAL</p><h1 style="font-size:26px">Your order is confirmed</h1><p>Hi ${escapeHtml(firstName)},</p><p>Thank you for your LegendMural order. Your payment has been received.</p><p><strong>Order ID:</strong> ${escapeHtml(order.paymentSessionId || '')}<br><strong>Reference:</strong> ${escapeHtml(ref)}</p><h2 style="font-size:17px">Your order</h2><ul>${items}</ul><table style="border-collapse:collapse">${totals}</table><h2 style="font-size:17px">Shipping address</h2><p>${address}</p><p>If anything looks incorrect, reply to this email as soon as possible.</p><p>LegendMural</p></body></html>`;
  return { subject: `Your LegendMural order is confirmed — ${ref}`, text: lines.join('\n'), html };
}

export function createResendPaidOrderNotifier({
  apiKey,
  from,
  replyTo = '',
  fetchImpl = globalThis.fetch,
  endpoint = RESEND_EMAIL_ENDPOINT,
} = {}) {
  const normalizedApiKey = requiredText(apiKey, 'apiKey', 512);
  const normalizedFrom = requiredText(from, 'from', 320);
  const normalizedReplyTo = optionalText(replyTo, 'replyTo', 320);
  if (typeof fetchImpl !== 'function') {
    fail('RESEND_PAID_ORDER_INVALID_CONFIG', 'fetchImpl must be a function.', { field: 'fetchImpl' });
  }

  return Object.freeze({
    async sendPaidOrderEmail({ notificationType, to, order }) {
      if (!['merchant_paid_order', 'customer_paid_order'].includes(notificationType)) {
        fail('RESEND_PAID_ORDER_INVALID_MESSAGE', 'Unsupported paid-order notification type.');
      }
      const recipient = requiredEmail(to, 'to');
      if (!order?.reference || order?.status !== 'paid' || order?.mode !== 'live') {
        fail('RESEND_PAID_ORDER_INVALID_MESSAGE', 'Only verified live paid orders may be emailed.');
      }
      const rendered = notificationType === 'merchant_paid_order'
        ? renderMerchant(order)
        : renderCustomer(order);
      const response = await fetchImpl(endpoint, {
        method: 'POST',
        headers: {
          authorization: `Bearer ${normalizedApiKey}`,
          'content-type': 'application/json',
          'idempotency-key': `paid-order-${order.reference}-${notificationType}`,
        },
        body: JSON.stringify({
          from: normalizedFrom,
          to: [recipient],
          subject: rendered.subject,
          text: rendered.text,
          html: rendered.html,
          ...(normalizedReplyTo ? { reply_to: normalizedReplyTo } : {}),
          tags: [{ name: 'category', value: notificationType }],
        }),
      });

      let payload = null;
      try {
        payload = await response.json();
      } catch {
        payload = null;
      }
      if (!response.ok || !payload?.id) {
        fail('RESEND_PAID_ORDER_DELIVERY_REJECTED', 'Resend did not accept the paid-order email.', {
          status: Number(response.status) || 0,
        });
      }
      return Object.freeze({ accepted: true, providerMessageId: String(payload.id) });
    },

    async sendV3InvoiceEmail({ to, orderReference, renderedEmail, attachment } = {}) {
      const recipient = requiredEmail(to, 'to');
      const reference = normalizeV3OrderReference(orderReference);
      const rendered = normalizeV3RenderedEmail(renderedEmail);
      const pdf = normalizeV3Attachment(attachment);

      const response = await fetchImpl(endpoint, {
        method: 'POST',
        headers: {
          authorization: `Bearer ${normalizedApiKey}`,
          'content-type': 'application/json',
          'idempotency-key': `v3-invoice-${reference}-customer_v3_invoice`,
        },
        body: JSON.stringify({
          from: normalizedFrom,
          to: [recipient],
          subject: rendered.subject,
          text: rendered.text,
          html: rendered.html,
          ...(normalizedReplyTo ? { reply_to: normalizedReplyTo } : {}),
          tags: [{ name: 'category', value: 'customer_v3_invoice' }],
          attachments: [{
            filename: pdf.filename,
            content: pdf.bytes.toString('base64'),
            content_type: 'application/pdf',
          }],
        }),
      });

      let payload = null;
      try {
        payload = await response.json();
      } catch {
        payload = null;
      }
      if (!response.ok || !payload?.id) {
        fail('RESEND_PAID_ORDER_DELIVERY_REJECTED', 'Resend did not accept the V3 invoice email.', {
          status: Number(response.status) || 0,
        });
      }
      return Object.freeze({ providerMessageId: String(payload.id) });
    },
  });
}

export { RESEND_EMAIL_ENDPOINT, displayReference };
