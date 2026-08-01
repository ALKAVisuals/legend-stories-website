const REFERENCE_PATTERN = /^[a-f0-9]{64}$/;
const ORDER_STATUSES = new Set([
  'payment_pending',
  'payment_processing',
  'payment_failed',
  'expired',
  'paid',
]);

export class OrderStatusError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = 'OrderStatusError';
    this.code = code;
    this.details = details;
  }
}

function fail(code, message, details) {
  throw new OrderStatusError(code, message, details);
}

function normalizeOrder(order = {}) {
  const reference = String(order.reference || '').trim().toLowerCase();
  if (!REFERENCE_PATTERN.test(reference)) {
    fail('INVALID_ORDER', 'The stored order reference is invalid.');
  }
  const status = String(order.status || '');
  if (!ORDER_STATUSES.has(status)) {
    fail('INVALID_ORDER', 'The stored order status is invalid.', { status });
  }
  const amountTotal = Number(order.amountTotal);
  if (!Number.isInteger(amountTotal) || amountTotal < 0) {
    fail('INVALID_ORDER', 'The stored order amount is invalid.');
  }
  const currency = String(order.currency || '').trim().toUpperCase();
  if (currency !== 'EUR') {
    fail('INVALID_ORDER', 'The stored order currency is invalid.');
  }
  const mode = String(order.mode || '');
  if (!['test', 'live'].includes(mode)) {
    fail('INVALID_ORDER', 'The stored order mode is invalid.');
  }
  const version = Number(order.version);
  if (!Number.isInteger(version) || version < 0) {
    fail('INVALID_ORDER', 'The stored order version is invalid.');
  }

  return {
    ...order,
    reference,
    status,
    amountTotal,
    currency,
    mode,
    version,
    paymentSessionId: String(order.paymentSessionId || '').trim(),
  };
}

function resolveNextStatus(currentStatus, eventStatus) {
  if (!ORDER_STATUSES.has(eventStatus)) {
    fail('INVALID_PAYMENT_EVENT', 'The payment event status is invalid.', { eventStatus });
  }
  if (currentStatus === 'paid') return 'paid';
  if (eventStatus === 'paid') return 'paid';
  if (currentStatus === eventStatus) return currentStatus;

  const allowed = {
    payment_pending: new Set(['payment_processing', 'payment_failed', 'expired']),
    payment_processing: new Set(['payment_failed', 'expired']),
    payment_failed: new Set(['payment_processing', 'expired']),
    expired: new Set(),
  };
  return allowed[currentStatus]?.has(eventStatus) ? eventStatus : currentStatus;
}

export function createOrderStatusUpdate(orderInput, paymentEvent = {}) {
  const order = normalizeOrder(orderInput);
  if (paymentEvent.ignored) {
    fail('INVALID_PAYMENT_EVENT', 'Ignored Stripe events cannot update an order.');
  }

  const reference = String(paymentEvent.reference || '').trim().toLowerCase();
  if (reference !== order.reference) {
    fail('ORDER_REFERENCE_MISMATCH', 'The Stripe event references a different order.');
  }
  if (Number(paymentEvent.amountTotal) !== order.amountTotal) {
    fail('ORDER_AMOUNT_MISMATCH', 'The Stripe event amount does not match the stored order.');
  }
  if (String(paymentEvent.currency || '').toUpperCase() !== order.currency) {
    fail('ORDER_CURRENCY_MISMATCH', 'The Stripe event currency does not match the stored order.');
  }

  const eventMode = paymentEvent.livemode ? 'live' : 'test';
  if (eventMode !== order.mode) {
    fail('ORDER_MODE_MISMATCH', 'The Stripe event mode does not match the stored order.');
  }

  const sessionId = String(paymentEvent.sessionId || '').trim();
  if (!sessionId) {
    fail('INVALID_PAYMENT_EVENT', 'The Stripe event has no Checkout Session ID.');
  }
  if (order.paymentSessionId && order.paymentSessionId !== sessionId) {
    fail('ORDER_SESSION_MISMATCH', 'The Stripe event belongs to a different Checkout Session.');
  }

  const eventId = String(paymentEvent.eventId || '').trim();
  const eventType = String(paymentEvent.eventType || '').trim();
  const eventCreated = Number(paymentEvent.created);
  if (!eventId.startsWith('evt_') || !eventType || !Number.isInteger(eventCreated)) {
    fail('INVALID_PAYMENT_EVENT', 'The Stripe event identity is invalid.');
  }

  const status = resolveNextStatus(order.status, paymentEvent.status);
  return Object.freeze({
    ...order,
    status,
    paymentSessionId: sessionId,
    lastStripeEventId: eventId,
    lastStripeEventType: eventType,
    lastStripeEventCreated: eventCreated,
    paidAt: status === 'paid' ? (order.paidAt || eventCreated) : (order.paidAt || null),
    updatedAt: eventCreated,
    version: order.version + 1,
  });
}

export function createPendingOrderRecord({
  reference,
  amountTotal,
  currency = 'EUR',
  mode = 'test',
  paymentSessionId = '',
  createdAt = Math.floor(Date.now() / 1000),
} = {}) {
  return Object.freeze(normalizeOrder({
    reference,
    status: 'payment_pending',
    amountTotal,
    currency,
    mode,
    paymentSessionId,
    createdAt,
    updatedAt: createdAt,
    paidAt: null,
    version: 0,
  }));
}
