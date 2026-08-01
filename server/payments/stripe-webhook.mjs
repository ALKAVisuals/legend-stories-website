import { createHmac, timingSafeEqual } from 'node:crypto';

const DEFAULT_TOLERANCE_SECONDS = 300;
const SIGNATURE_HEX_PATTERN = /^[a-f0-9]{64}$/i;
const REFERENCE_PATTERN = /^[a-f0-9]{64}$/;
const SUPPORTED_EVENT_TYPES = new Set([
  'checkout.session.completed',
  'checkout.session.async_payment_succeeded',
  'checkout.session.async_payment_failed',
  'checkout.session.expired',
]);

export class StripeWebhookError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = 'StripeWebhookError';
    this.code = code;
    this.details = details;
  }
}

function fail(code, message, details) {
  throw new StripeWebhookError(code, message, details);
}

function parseSignatureHeader(value = '') {
  const timestampValues = [];
  const signatures = [];

  for (const part of String(value).split(',')) {
    const separator = part.indexOf('=');
    if (separator < 1) continue;
    const key = part.slice(0, separator).trim();
    const token = part.slice(separator + 1).trim();
    if (key === 't') timestampValues.push(token);
    if (key === 'v1' && SIGNATURE_HEX_PATTERN.test(token)) signatures.push(token.toLowerCase());
  }

  if (timestampValues.length !== 1 || signatures.length === 0) {
    fail('INVALID_STRIPE_SIGNATURE', 'The Stripe signature header is invalid.');
  }

  const timestamp = Number(timestampValues[0]);
  if (!Number.isInteger(timestamp) || timestamp < 1) {
    fail('INVALID_STRIPE_SIGNATURE', 'The Stripe signature timestamp is invalid.');
  }

  return { timestamp, signatures };
}

function safeEqualHex(leftHex, rightHex) {
  if (!SIGNATURE_HEX_PATTERN.test(leftHex) || !SIGNATURE_HEX_PATTERN.test(rightHex)) {
    return false;
  }
  const left = Buffer.from(leftHex, 'hex');
  const right = Buffer.from(rightHex, 'hex');
  return left.length === right.length && timingSafeEqual(left, right);
}

export function createStripeWebhookSignature({
  rawBody,
  secret,
  timestamp,
}) {
  const body = Buffer.isBuffer(rawBody) ? rawBody : Buffer.from(String(rawBody), 'utf8');
  const normalizedSecret = String(secret || '').trim();
  if (!normalizedSecret.startsWith('whsec_')) {
    fail('INVALID_WEBHOOK_SECRET', 'A Stripe webhook signing secret is required.');
  }
  if (!Number.isInteger(timestamp) || timestamp < 1) {
    fail('INVALID_STRIPE_SIGNATURE', 'A valid webhook timestamp is required.');
  }

  return createHmac('sha256', normalizedSecret)
    .update(Buffer.concat([Buffer.from(`${timestamp}.`, 'utf8'), body]))
    .digest('hex');
}

export function verifyStripeWebhookSignature({
  rawBody,
  signatureHeader,
  secret,
  toleranceSeconds = DEFAULT_TOLERANCE_SECONDS,
  now = Math.floor(Date.now() / 1000),
}) {
  const normalizedSecret = String(secret || '').trim();
  if (!normalizedSecret.startsWith('whsec_')) {
    fail('INVALID_WEBHOOK_SECRET', 'A Stripe webhook signing secret is required.');
  }

  const body = Buffer.isBuffer(rawBody) ? rawBody : Buffer.from(String(rawBody), 'utf8');
  const { timestamp, signatures } = parseSignatureHeader(signatureHeader);
  const safeTolerance = Math.min(3600, Math.max(0, Number(toleranceSeconds) || 0));
  const safeNow = Number.isInteger(now) ? now : Math.floor(Date.now() / 1000);
  if (Math.abs(safeNow - timestamp) > safeTolerance) {
    fail('STALE_STRIPE_SIGNATURE', 'The Stripe webhook signature is outside the allowed time window.');
  }

  const expected = createStripeWebhookSignature({
    rawBody: body,
    secret: normalizedSecret,
    timestamp,
  });
  if (!signatures.some((signature) => safeEqualHex(signature, expected))) {
    fail('INVALID_STRIPE_SIGNATURE', 'The Stripe webhook signature could not be verified.');
  }

  return Object.freeze({ timestamp });
}

function requiredString(value, field, maxLength = 200) {
  const normalized = String(value || '').trim();
  if (!normalized || normalized.length > maxLength) {
    fail('INVALID_STRIPE_EVENT', `Stripe event field ${field} is invalid.`, { field });
  }
  return normalized;
}

function normalizeCheckoutStatus(eventType, paymentStatus) {
  switch (eventType) {
    case 'checkout.session.completed':
      return paymentStatus === 'paid' ? 'paid' : 'payment_processing';
    case 'checkout.session.async_payment_succeeded':
      return 'paid';
    case 'checkout.session.async_payment_failed':
      return 'payment_failed';
    case 'checkout.session.expired':
      return 'expired';
    default:
      return null;
  }
}

export function normalizeStripeWebhookEvent(event) {
  if (!event || typeof event !== 'object') {
    fail('INVALID_STRIPE_EVENT', 'The Stripe webhook event is invalid.');
  }

  const eventId = requiredString(event.id, 'id', 255);
  if (!eventId.startsWith('evt_')) {
    fail('INVALID_STRIPE_EVENT', 'The Stripe webhook event ID is invalid.');
  }
  const eventType = requiredString(event.type, 'type', 255);
  const created = Number(event.created);
  if (!Number.isInteger(created) || created < 1) {
    fail('INVALID_STRIPE_EVENT', 'The Stripe webhook event timestamp is invalid.');
  }
  if (typeof event.livemode !== 'boolean') {
    fail('INVALID_STRIPE_EVENT', 'The Stripe webhook livemode flag is invalid.');
  }

  if (!SUPPORTED_EVENT_TYPES.has(eventType)) {
    return Object.freeze({
      eventId,
      eventType,
      created,
      livemode: event.livemode,
      ignored: true,
    });
  }

  const session = event.data?.object;
  if (!session || typeof session !== 'object') {
    fail('INVALID_STRIPE_EVENT', 'The Stripe Checkout Session is missing.');
  }

  const sessionId = requiredString(session.id, 'data.object.id', 255);
  const expectedPrefix = event.livemode ? 'cs_live_' : 'cs_test_';
  if (!sessionId.startsWith(expectedPrefix)) {
    fail('STRIPE_MODE_MISMATCH', 'The Stripe event mode does not match the Checkout Session.');
  }

  const reference = requiredString(
    session.client_reference_id || session.metadata?.order_reference,
    'client_reference_id',
    64,
  ).toLowerCase();
  const metadataReference = String(session.metadata?.order_reference || '').trim().toLowerCase();
  if (!REFERENCE_PATTERN.test(reference)
    || (metadataReference && metadataReference !== reference)) {
    fail('INVALID_ORDER_REFERENCE', 'The Stripe Checkout Session order reference is invalid.');
  }

  const amountTotal = Number(session.amount_total);
  if (!Number.isInteger(amountTotal) || amountTotal < 0) {
    fail('INVALID_STRIPE_EVENT', 'The Stripe Checkout Session amount is invalid.');
  }
  const currency = requiredString(session.currency, 'currency', 3).toUpperCase();
  if (currency !== 'EUR') {
    fail('UNSUPPORTED_CURRENCY', 'The Stripe Checkout Session currency is not supported.');
  }
  const paymentStatus = requiredString(session.payment_status || 'unpaid', 'payment_status', 40);
  const status = normalizeCheckoutStatus(eventType, paymentStatus);

  return Object.freeze({
    eventId,
    eventType,
    created,
    livemode: event.livemode,
    ignored: false,
    reference,
    sessionId,
    amountTotal,
    currency,
    paymentStatus,
    status,
  });
}

export function verifyAndNormalizeStripeWebhook({
  rawBody,
  signatureHeader,
  secret,
  toleranceSeconds = DEFAULT_TOLERANCE_SECONDS,
  now,
}) {
  verifyStripeWebhookSignature({
    rawBody,
    signatureHeader,
    secret,
    toleranceSeconds,
    now,
  });

  let event;
  try {
    const source = Buffer.isBuffer(rawBody) ? rawBody.toString('utf8') : String(rawBody);
    event = JSON.parse(source);
  } catch {
    fail('INVALID_STRIPE_EVENT', 'The Stripe webhook body is not valid JSON.');
  }
  return normalizeStripeWebhookEvent(event);
}
