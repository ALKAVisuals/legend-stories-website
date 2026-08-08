import { normalizePayPalOrderId } from './paypal-api.mjs';

const REFERENCE_PATTERN = /^[a-f0-9]{64}$/;

export class PayPalCaptureError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = 'PayPalCaptureError';
    this.code = code;
    this.details = details;
  }
}

function fail(code, message, details) {
  throw new PayPalCaptureError(code, message, details);
}

function amountToCents(amount, label) {
  const currency = String(amount?.currency_code || '').toUpperCase();
  const value = String(amount?.value || '').trim();
  if (currency !== 'EUR' || !/^\d+(?:\.\d{1,2})?$/.test(value)) {
    fail('INVALID_PAYPAL_CAPTURE', `${label} amount is invalid.`);
  }
  const [whole, fraction = ''] = value.split('.');
  const cents = (Number(whole) * 100) + Number(fraction.padEnd(2, '0'));
  if (!Number.isSafeInteger(cents) || cents < 0) {
    fail('INVALID_PAYPAL_CAPTURE', `${label} amount is invalid.`);
  }
  return cents;
}

function timestampSeconds(value) {
  const milliseconds = Date.parse(String(value || ''));
  if (!Number.isFinite(milliseconds) || milliseconds <= 0) return 0;
  return Math.floor(milliseconds / 1000);
}

export function validatePayPalCaptureResult(payload, {
  reference: referenceInput,
  orderId: orderIdInput,
  amountTotal,
  currency = 'EUR',
  fallbackCapturedAt = Math.floor(Date.now() / 1000),
} = {}) {
  const reference = String(referenceInput || '').trim().toLowerCase();
  if (!REFERENCE_PATTERN.test(reference)) {
    fail('INVALID_PAYPAL_CAPTURE', 'PayPal capture reference is invalid.');
  }
  const orderId = normalizePayPalOrderId(orderIdInput);
  if (normalizePayPalOrderId(payload?.id) !== orderId) {
    fail('PAYPAL_CAPTURE_ORDER_MISMATCH', 'PayPal captured a different order.');
  }
  if (String(payload?.status || '') !== 'COMPLETED') {
    fail('PAYPAL_CAPTURE_NOT_COMPLETED', 'PayPal has not completed the order capture.');
  }
  if (String(currency || '').toUpperCase() !== 'EUR') {
    fail('INVALID_PAYPAL_CAPTURE', 'PayPal capture currency is invalid.');
  }
  const expectedAmount = Number(amountTotal);
  if (!Number.isInteger(expectedAmount) || expectedAmount < 0) {
    fail('INVALID_PAYPAL_CAPTURE', 'Expected PayPal capture amount is invalid.');
  }

  const purchaseUnits = Array.isArray(payload?.purchase_units) ? payload.purchase_units : [];
  if (purchaseUnits.length !== 1) {
    fail('INVALID_PAYPAL_CAPTURE', 'PayPal capture must contain exactly one purchase unit.');
  }
  const unit = purchaseUnits[0];
  if (String(unit?.custom_id || '').toLowerCase() !== reference
    || String(unit?.reference_id || '').toLowerCase() !== reference) {
    fail('PAYPAL_CAPTURE_REFERENCE_MISMATCH', 'PayPal capture does not match the reserved order reference.');
  }

  const captures = Array.isArray(unit?.payments?.captures) ? unit.payments.captures : [];
  if (!captures.length || captures.some((capture) => capture?.status !== 'COMPLETED')) {
    fail('PAYPAL_CAPTURE_NOT_COMPLETED', 'PayPal payment capture is not completed.');
  }
  const capturedTotal = captures.reduce(
    (sum, capture) => sum + amountToCents(capture?.amount, 'Captured payment'),
    0,
  );
  if (capturedTotal !== expectedAmount) {
    fail('PAYPAL_CAPTURE_AMOUNT_MISMATCH', 'PayPal captured amount does not match the reserved order.');
  }

  const capturedAt = Math.max(
    ...captures.map((capture) => timestampSeconds(capture?.create_time)),
    Number(fallbackCapturedAt) || 0,
  );
  const captureIds = captures.map((capture) => String(capture?.id || '').trim()).filter(Boolean);
  if (captureIds.length !== captures.length) {
    fail('INVALID_PAYPAL_CAPTURE', 'PayPal capture identity is incomplete.');
  }

  return Object.freeze({
    reference,
    orderId,
    amountTotal: capturedTotal,
    currency: 'EUR',
    capturedAt,
    captureIds: Object.freeze(captureIds),
  });
}
