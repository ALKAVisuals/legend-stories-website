const RESEND_EMAIL_ENDPOINT = 'https://api.resend.com/emails';

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

function optionalText(value, field, maxLength) {
  const normalized = String(value || '').trim();
  if (!normalized) return '';
  if (normalized.length > maxLength || /[\u0000-\u001F\u007F]/.test(normalized)) {
    fail('RESEND_PAID_ORDER_INVALID_CONFIG', `${field} is invalid.`, { field });
  }
  return normalized;
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function euros(value) {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return '€0.00';
  return `€${amount.toFixed(2)}`;
}

function cents(value) {
  const amount = Number(value);
  return euros(Number.isFinite(amount) ? amount / 100 : 0);
}

function referenceLabel(reference) {
  return `LM-${String(reference || '').slice(0, 12).toUpperCase()}`;
}

function itemText(item) {
  const size = item.sizeLabel || item.variantLabel || `${item.sizeCm || ''} cm`;
  return `${item.quantity}× ${item.name} | ${size} | ${item.sku} | ${euros(item.unitPrice)} each | ${euros(item.lineTotal)}`;
}

function itemHtml(item) {
  const size = item.sizeLabel || item.variantLabel || `${item.sizeCm || ''} cm`;
  return `<tr><td style="padding:8px 0">${escapeHtml(item.name)}<br><small>${escapeHtml(size)} · ${escapeHtml(item.sku)}</small></td><td style="padding:8px;text-align:center">${escapeHtml(item.quantity)}</td><td style="padding:8px;text-align:right">${escapeHtml(euros(item.unitPrice))}</td><td style="padding:8px 0 8px 8px;text-align:right">${escapeHtml(euros(item.lineTotal))}</td></tr>`;
}

function orderTotals(order) {
  return {
    subtotal: cents(order.totals?.subtotal),
    discount: cents(order.totals?.discount),
    shipping: cents(order.totals?.shipping),
    grandTotal: cents(order.totals?.grandTotal ?? order.amountTotal),
  };
}

function addressText(customer) {
  return [customer.street, customer.line2, `${customer.zip} ${customer.city}`, customer.country].filter(Boolean).join('\n');
}

function renderMerchant(order) {
  const customer = order.customer || {};
  const totals = orderTotals(order);
  const paidAtIso = new Date(Number(order.paidAt || order.updatedAt) * 1000).toISOString();
  const text = [
    'LegendMural — new paid order', '',
    `Order: ${referenceLabel(order.reference)}`,
    `PayPal order ID: ${order.paymentSessionId}`,
    `Paid at: ${paidAtIso}`,
    `Customer: ${customer.firstname} ${customer.lastname}`,
    `Email: ${customer.email}`,
    'Shipping address:', addressText(customer), '',
    'Items:', ...(order.items || []).map(itemText), '',
    `Subtotal: ${totals.subtotal}`,
    `Discount: -${totals.discount}`,
    `Shipping: ${totals.shipping}`,
    `Total paid: ${totals.grandTotal}`,
    `Shipping zone: ${order.shipping?.zone || ''} (${order.shipping?.deliveryCountry || customer.country || ''})`,
    `Discount code: ${order.discount?.code || '—'}`,
  ].join('\n');
  const html = `<!doctype html><html><body style="font-family:Arial,sans-serif;line-height:1.5;color:#111;max-width:720px;margin:auto"><h1 style="font-size:22px">New paid LegendMural order</h1><p><strong>${escapeHtml(referenceLabel(order.reference))}</strong><br>PayPal order ID: ${escapeHtml(order.paymentSessionId)}<br>Paid: ${escapeHtml(paidAtIso)}</p><h2 style="font-size:17px">Customer</h2><p>${escapeHtml(customer.firstname)} ${escapeHtml(customer.lastname)}<br>${escapeHtml(customer.email)}<br>${escapeHtml(addressText(customer)).replaceAll('\n','<br>')}</p><h2 style="font-size:17px">Items</h2><table style="width:100%;border-collapse:collapse">${(order.items || []).map(itemHtml).join('')}</table><hr><p>Subtotal: ${escapeHtml(totals.subtotal)}<br>Discount: -${escapeHtml(totals.discount)}<br>Shipping: ${escapeHtml(totals.shipping)}<br><strong>Total paid: ${escapeHtml(totals.grandTotal)}</strong></p><p>Shipping zone: ${escapeHtml(order.shipping?.zone || '')} (${escapeHtml(order.shipping?.deliveryCountry || customer.country || '')})<br>Discount code: ${escapeHtml(order.discount?.code || '—')}</p></body></html>`;
  return { text, html, subject: `New paid order — ${referenceLabel(order.reference)} — ${totals.grandTotal}` };
}

function renderCustomer(order) {
  const customer = order.customer || {};
  const totals = orderTotals(order);
  const text = [
    `Hi ${customer.firstname},`, '',
    'Thank you for your LegendMural order. We have received your payment.',
    `Order: ${referenceLabel(order.reference)}`, '',
    'Your order:', ...(order.items || []).map(itemText), '',
    'Shipping to:', addressText(customer), '',
    `Subtotal: ${totals.subtotal}`,
    `Discount: -${totals.discount}`,
    `Shipping: ${totals.shipping}`,
    `Total paid: ${totals.grandTotal}`, '',
    'We will use the address above to prepare your order for shipment.',
    'LegendMural',
  ].join('\n');
  const html = `<!doctype html><html><body style="font-family:Arial,sans-serif;line-height:1.55;color:#111;max-width:680px;margin:auto"><h1 style="font-size:24px">Your LegendMural order is confirmed</h1><p>Hi ${escapeHtml(customer.firstname)},</p><p>Thank you for your order. We have received your payment.</p><p><strong>Order ${escapeHtml(referenceLabel(order.reference))}</strong></p><table style="width:100%;border-collapse:collapse">${(order.items || []).map(itemHtml).join('')}</table><hr><p>Subtotal: ${escapeHtml(totals.subtotal)}<br>Discount: -${escapeHtml(totals.discount)}<br>Shipping: ${escapeHtml(totals.shipping)}<br><strong>Total paid: ${escapeHtml(totals.grandTotal)}</strong></p><h2 style="font-size:17px">Shipping address</h2><p>${escapeHtml(addressText(customer)).replaceAll('\n','<br>')}</p><p>We will use this address to prepare your order for shipment.</p><p>LegendMural</p></body></html>`;
  return { text, html, subject: `Your LegendMural order is confirmed — ${referenceLabel(order.reference)}` };
}

export function createResendPaidOrderNotifier({
  apiKey,
  from,
  replyTo = '',
  merchantTo,
  fetchImpl = globalThis.fetch,
  endpoint = RESEND_EMAIL_ENDPOINT,
} = {}) {
  const normalizedApiKey = requiredText(apiKey, 'apiKey', 512);
  const normalizedFrom = requiredText(from, 'from', 320);
  const normalizedReplyTo = optionalText(replyTo, 'replyTo', 320);
  const normalizedMerchantTo = requiredText(merchantTo, 'merchantTo', 320);
  if (typeof fetchImpl !== 'function') fail('RESEND_PAID_ORDER_INVALID_CONFIG', 'fetchImpl must be a function.');

  return Object.freeze({
    async sendPaidOrderNotification({ notificationType, order } = {}) {
      if (!order || order.status !== 'paid' || order.mode !== 'live') {
        fail('RESEND_PAID_ORDER_INVALID_MESSAGE', 'Only live paid orders can be emailed.');
      }
      const customerEmail = requiredText(order.customer?.email, 'customer email', 254);
      let rendered;
      let to;
      if (notificationType === 'merchant_paid_order') {
        rendered = renderMerchant(order);
        to = normalizedMerchantTo;
      } else if (notificationType === 'customer_paid_order') {
        rendered = renderCustomer(order);
        to = customerEmail;
      } else {
        fail('RESEND_PAID_ORDER_INVALID_MESSAGE', 'Unsupported paid-order notification type.');
      }

      const response = await fetchImpl(endpoint, {
        method: 'POST',
        headers: {
          authorization: `Bearer ${normalizedApiKey}`,
          'content-type': 'application/json',
          'idempotency-key': `paid-order-${notificationType}-${order.reference}`,
        },
        body: JSON.stringify({
          from: normalizedFrom,
          to: [to],
          subject: rendered.subject,
          text: rendered.text,
          html: rendered.html,
          ...(normalizedReplyTo ? { reply_to: normalizedReplyTo } : {}),
          tags: [{ name: 'category', value: notificationType }],
        }),
      });

      let payload = null;
      try { payload = await response.json(); } catch { payload = null; }
      if (!response.ok || !payload?.id) {
        fail('RESEND_PAID_ORDER_DELIVERY_REJECTED', 'Resend did not accept the paid-order email.', { status: Number(response.status) || 0 });
      }
      return Object.freeze({ accepted: true, providerMessageId: String(payload.id) });
    },
  });
}

export { RESEND_EMAIL_ENDPOINT };
