const MAX_WEBHOOK_BODY_BYTES = 512 * 1024;
const WEBHOOK_ID_PATTERN = /^[A-Za-z0-9]{1,50}$/;
const AUTH_ALGO_PATTERN = /^[A-Za-z0-9]{1,100}$/;
const EVENT_TYPE_PATTERN = /^[A-Z0-9._-]{1,100}$/;

export class PayPalWebhookVerificationError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = 'PayPalWebhookVerificationError';
    this.code = code;
    this.details = details;
  }
}

function fail(code, message, details) {
  throw new PayPalWebhookVerificationError(code, message, details);
}

function headerValue(headers, name, maxLength) {
  const value = String(headers?.get?.(name) || '').trim();
  if (!value || value.length > maxLength || /[\r\n\0]/.test(value)) {
    fail('PAYPAL_WEBHOOK_HEADERS_INVALID', 'Required PayPal webhook headers are missing or invalid.', {
      header: name,
    });
  }
  return value;
}

function normalizeCertUrl(value) {
  let url;
  try {
    url = new URL(value);
  } catch {
    fail('PAYPAL_WEBHOOK_HEADERS_INVALID', 'The PayPal certificate URL is invalid.', {
      header: 'PAYPAL-CERT-URL',
    });
  }
  if (url.protocol !== 'https:' || url.username || url.password) {
    fail('PAYPAL_WEBHOOK_HEADERS_INVALID', 'The PayPal certificate URL is invalid.', {
      header: 'PAYPAL-CERT-URL',
    });
  }
  return url.toString();
}

function normalizeWebhookId(value) {
  const webhookId = String(value || '').trim();
  if (!WEBHOOK_ID_PATTERN.test(webhookId)) {
    fail(
      'PAYPAL_WEBHOOK_ID_NOT_CONFIGURED',
      'The PayPal webhook ID is not configured correctly.',
    );
  }
  return webhookId;
}

function parseWebhookEvent(rawBody) {
  const source = String(rawBody ?? '');
  if (!source) {
    fail('PAYPAL_WEBHOOK_BODY_INVALID', 'The PayPal webhook body is empty.');
  }
  if (Buffer.byteLength(source, 'utf8') > MAX_WEBHOOK_BODY_BYTES) {
    fail('PAYPAL_WEBHOOK_BODY_TOO_LARGE', 'The PayPal webhook body exceeds the accepted size.');
  }

  let event;
  try {
    event = JSON.parse(source);
  } catch {
    fail('PAYPAL_WEBHOOK_BODY_INVALID', 'The PayPal webhook body is not valid JSON.');
  }
  if (!event || typeof event !== 'object' || Array.isArray(event)) {
    fail('PAYPAL_WEBHOOK_BODY_INVALID', 'The PayPal webhook body must contain an event object.');
  }

  const eventId = String(event.id || '').trim();
  const eventType = String(event.event_type || '').trim();
  if (!eventId || eventId.length > 100 || /[\r\n\0]/.test(eventId)) {
    fail('PAYPAL_WEBHOOK_BODY_INVALID', 'The PayPal webhook event ID is invalid.');
  }
  if (!EVENT_TYPE_PATTERN.test(eventType)) {
    fail('PAYPAL_WEBHOOK_BODY_INVALID', 'The PayPal webhook event type is invalid.');
  }

  return event;
}

export function buildPayPalWebhookVerificationPayload({
  headers,
  rawBody,
  webhookId,
} = {}) {
  const authAlgo = headerValue(headers, 'PAYPAL-AUTH-ALGO', 100);
  if (!AUTH_ALGO_PATTERN.test(authAlgo)) {
    fail('PAYPAL_WEBHOOK_HEADERS_INVALID', 'The PayPal authentication algorithm is invalid.', {
      header: 'PAYPAL-AUTH-ALGO',
    });
  }

  const transmissionId = headerValue(headers, 'PAYPAL-TRANSMISSION-ID', 50);
  const transmissionSig = headerValue(headers, 'PAYPAL-TRANSMISSION-SIG', 500);
  const transmissionTime = headerValue(headers, 'PAYPAL-TRANSMISSION-TIME', 100);
  if (Number.isNaN(Date.parse(transmissionTime))) {
    fail('PAYPAL_WEBHOOK_HEADERS_INVALID', 'The PayPal transmission time is invalid.', {
      header: 'PAYPAL-TRANSMISSION-TIME',
    });
  }

  const certUrl = normalizeCertUrl(headerValue(headers, 'PAYPAL-CERT-URL', 500));
  const normalizedWebhookId = normalizeWebhookId(webhookId);
  const event = parseWebhookEvent(rawBody);

  return Object.freeze({
    event,
    payload: Object.freeze({
      auth_algo: authAlgo,
      cert_url: certUrl,
      transmission_id: transmissionId,
      transmission_sig: transmissionSig,
      transmission_time: transmissionTime,
      webhook_id: normalizedWebhookId,
      webhook_event: event,
    }),
  });
}

export async function verifyPayPalWebhookSignature({
  paypalClient,
  headers,
  rawBody,
  webhookId,
} = {}) {
  if (typeof paypalClient?.verifyWebhookSignature !== 'function') {
    fail(
      'PAYPAL_WEBHOOK_VERIFIER_NOT_CONFIGURED',
      'The PayPal webhook verifier is unavailable.',
    );
  }

  const verification = buildPayPalWebhookVerificationPayload({
    headers,
    rawBody,
    webhookId,
  });
  const response = await paypalClient.verifyWebhookSignature(verification.payload);
  const status = String(response?.verification_status || '').trim().toUpperCase();
  if (status === 'SUCCESS') {
    return Object.freeze({
      verified: true,
      event: verification.event,
      mode: String(paypalClient.mode || ''),
    });
  }
  if (status === 'FAILURE') {
    fail('PAYPAL_WEBHOOK_SIGNATURE_INVALID', 'The PayPal webhook signature is invalid.');
  }
  fail(
    'PAYPAL_WEBHOOK_VERIFICATION_INVALID_RESPONSE',
    'PayPal returned an invalid webhook verification response.',
  );
}

export { MAX_WEBHOOK_BODY_BYTES };
