const REFERENCE_PATTERN = /^[a-f0-9]{64}$/;
const PAYPAL_ORDER_ID_PATTERN = /^[A-Z0-9]{1,36}$/;
const PAYPAL_CAPTURE_ID_PATTERN = /^[A-Z0-9]{1,128}$/;
const EVENT_ID_PATTERN = /^[A-Za-z0-9_-]{1,128}$/;
const EVENT_TYPE_PATTERN = /^[A-Z0-9._-]{1,128}$/;

export class NeonPayPalWebhookEventRecorderError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = 'NeonPayPalWebhookEventRecorderError';
    this.code = code;
    this.details = details;
  }
}

function fail(code, message, details = {}) {
  throw new NeonPayPalWebhookEventRecorderError(code, message, details);
}

function nonnegativeInteger(value, field) {
  const normalized = Number(value);
  if (!Number.isSafeInteger(normalized) || normalized < 0) {
    fail('INVALID_PAYPAL_WEBHOOK_EVENT', `${field} is invalid.`, { field });
  }
  return normalized;
}

function normalizePaymentEvent(payment = {}) {
  const provider = String(payment.provider || '').trim().toLowerCase();
  const eventId = String(payment.providerEventId || '').trim();
  const eventType = String(payment.providerEventType || '').trim().toUpperCase();
  const reference = String(payment.reference || '').trim().toLowerCase();
  const orderId = String(payment.providerOrderId || '').trim().toUpperCase();
  const paymentCaptureId = payment.providerCaptureId == null || String(payment.providerCaptureId).trim() === ''
    ? null
    : String(payment.providerCaptureId).trim().toUpperCase();
  // The webhook ledger stores identity carried by the webhook event itself. A recovery capture
  // triggered by CHECKOUT.ORDER.APPROVED is payment evidence, but its capture ID is not part of
  // the APPROVED event identity. Keeping those separate makes duplicate APPROVED delivery stable.
  const captureId = eventType.startsWith('PAYMENT.CAPTURE.') ? paymentCaptureId : null;
  const mode = String(payment.mode || '').trim();

  if (provider !== 'paypal') {
    fail('INVALID_PAYPAL_WEBHOOK_EVENT', 'Transactional webhook event recording is only supported for PayPal.');
  }
  if (!EVENT_ID_PATTERN.test(eventId)) {
    fail('INVALID_PAYPAL_WEBHOOK_EVENT', 'PayPal webhook event ID is invalid.');
  }
  if (!EVENT_TYPE_PATTERN.test(eventType)) {
    fail('INVALID_PAYPAL_WEBHOOK_EVENT', 'PayPal webhook event type is invalid.');
  }
  if (!REFERENCE_PATTERN.test(reference)) {
    fail('INVALID_PAYPAL_WEBHOOK_EVENT', 'PayPal webhook order reference is invalid.');
  }
  if (!PAYPAL_ORDER_ID_PATTERN.test(orderId)) {
    fail('INVALID_PAYPAL_WEBHOOK_EVENT', 'PayPal webhook order ID is invalid.');
  }
  if (captureId !== null && !PAYPAL_CAPTURE_ID_PATTERN.test(captureId)) {
    fail('INVALID_PAYPAL_WEBHOOK_EVENT', 'PayPal webhook capture ID is invalid.');
  }
  if (!['test', 'live'].includes(mode)) {
    fail('INVALID_PAYPAL_WEBHOOK_EVENT', 'PayPal webhook mode is invalid.');
  }

  return Object.freeze({
    eventId,
    eventType,
    reference,
    orderId,
    captureId,
    mode,
    createdAt: nonnegativeInteger(payment.providerEventCreatedAt, 'PayPal webhook event timestamp'),
    processedAt: nonnegativeInteger(payment.providerEventProcessedAt, 'PayPal webhook processed timestamp'),
  });
}

function sameNullable(left, right) {
  return (left ?? null) === (right ?? null);
}

function assertStoredEventMatches(row, event) {
  if (!row
    || String(row.event_type || '') !== event.eventType
    || String(row.order_reference || '') !== event.reference
    || String(row.paypal_order_id || '') !== event.orderId
    || !sameNullable(row.paypal_capture_id, event.captureId)
    || String(row.mode || '') !== event.mode
    || Number(row.paypal_created_at) !== event.createdAt) {
    fail(
      'PAYPAL_WEBHOOK_EVENT_CONFLICT',
      'PayPal webhook event ID already exists with different identity data.',
      { eventId: event.eventId },
    );
  }
}

const INSERT_PAYPAL_EVENT = `
  INSERT INTO legend_commerce.paypal_webhook_events (
    event_id, event_type, order_reference, paypal_order_id,
    paypal_capture_id, mode, paypal_created_at, processed_at
  ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
  ON CONFLICT (event_id) DO NOTHING
  RETURNING event_id
`;

const SELECT_PAYPAL_EVENT = `
  SELECT event_id, event_type, order_reference, paypal_order_id,
         paypal_capture_id, mode, paypal_created_at
  FROM legend_commerce.paypal_webhook_events
  WHERE event_id = $1
  FOR SHARE
`;

export async function recordPayPalWebhookEventInTransaction({ client, payment } = {}) {
  if (typeof client?.query !== 'function') {
    fail('INVALID_NEON_CLIENT', 'A transaction-local Neon client is required.');
  }

  const event = normalizePaymentEvent(payment);
  const inserted = await client.query(INSERT_PAYPAL_EVENT, [
    event.eventId,
    event.eventType,
    event.reference,
    event.orderId,
    event.captureId,
    event.mode,
    event.createdAt,
    event.processedAt,
  ]);

  if (inserted.rows?.length === 1) {
    return Object.freeze({ duplicate: false, eventId: event.eventId });
  }

  const existing = await client.query(SELECT_PAYPAL_EVENT, [event.eventId]);
  assertStoredEventMatches(existing.rows?.[0], event);
  return Object.freeze({ duplicate: true, eventId: event.eventId });
}
