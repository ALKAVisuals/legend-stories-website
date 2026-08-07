import { COMMERCE_RUNTIME_CONFIG } from './runtime-config.mjs';

const DEFAULT_TIMEOUT_MS = 15_000;
const PAYPAL_ORDER_ID_PATTERN = /^[A-Z0-9]{1,36}$/;

export const PAYPAL_CAPTURE_ENDPOINT = String(
  COMMERCE_RUNTIME_CONFIG.paypalCaptureEndpoint || '',
).trim();

export class PayPalCaptureClientError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = 'PayPalCaptureClientError';
    this.code = code;
    this.details = details;
  }
}

function fail(code, message, details) {
  throw new PayPalCaptureClientError(code, message, details);
}

function isLocalDevelopmentHost(hostname) {
  return ['localhost', '127.0.0.1', '[::1]'].includes(hostname);
}

export function normalizePayPalCaptureEndpoint(value = '', baseUrl = '') {
  const raw = String(value || '').trim();
  if (!raw) return '';
  let endpoint;
  try {
    endpoint = baseUrl ? new URL(raw, baseUrl) : new URL(raw);
  } catch {
    fail('INVALID_PAYPAL_CAPTURE_ENDPOINT', 'The PayPal capture endpoint is not a valid URL.');
  }
  const localHttp = endpoint.protocol === 'http:' && isLocalDevelopmentHost(endpoint.hostname);
  if (endpoint.protocol !== 'https:' && !localHttp) {
    fail('INVALID_PAYPAL_CAPTURE_ENDPOINT', 'The PayPal capture endpoint must use HTTPS.');
  }
  if (endpoint.username || endpoint.password) {
    fail('INVALID_PAYPAL_CAPTURE_ENDPOINT', 'The PayPal capture endpoint cannot contain credentials.');
  }
  endpoint.hash = '';
  return endpoint.toString();
}

export function isPayPalCaptureConfigured(
  endpoint = PAYPAL_CAPTURE_ENDPOINT,
  baseUrl = globalThis.location?.origin || '',
) {
  return Boolean(normalizePayPalCaptureEndpoint(endpoint, baseUrl));
}

function normalizeLookup(reference, orderId) {
  const normalizedReference = String(reference || '').trim().toLowerCase();
  const normalizedOrderId = String(orderId || '').trim().toUpperCase();
  if (!/^[a-f0-9]{64}$/.test(normalizedReference)
    || !PAYPAL_ORDER_ID_PATTERN.test(normalizedOrderId)) {
    fail('INVALID_PAYPAL_CAPTURE_LOOKUP', 'PayPal return details are invalid.');
  }
  return Object.freeze({
    reference: normalizedReference,
    orderId: normalizedOrderId,
  });
}

function responseError(status, payload) {
  return new PayPalCaptureClientError(
    String(payload?.error?.code || '').trim() || 'PAYPAL_CAPTURE_REQUEST_FAILED',
    String(payload?.error?.message || '').trim().slice(0, 240)
      || 'PayPal payment could not be confirmed.',
    { status },
  );
}

function parseCaptureResponse(payload, lookup) {
  if (!payload || typeof payload !== 'object'
    || payload.provider !== 'paypal'
    || payload.reference !== lookup.reference
    || payload.orderId !== lookup.orderId
    || payload.status !== 'paid'
    || payload.paid !== true
    || !['test', 'live'].includes(payload.mode)) {
    fail('INVALID_PAYPAL_CAPTURE_RESPONSE', 'The PayPal capture response is invalid.');
  }
  return Object.freeze({
    reference: lookup.reference,
    orderId: lookup.orderId,
    mode: payload.mode,
    status: 'paid',
    paid: true,
    duplicate: Boolean(payload.duplicate),
  });
}

export async function requestPayPalCapture({
  endpoint = PAYPAL_CAPTURE_ENDPOINT,
  reference,
  orderId,
  baseUrl = globalThis.location?.origin || '',
  fetchImpl = globalThis.fetch,
  timeoutMs = DEFAULT_TIMEOUT_MS,
} = {}) {
  const normalizedEndpoint = normalizePayPalCaptureEndpoint(endpoint, baseUrl);
  if (!normalizedEndpoint) {
    fail('PAYPAL_CAPTURE_NOT_CONFIGURED', 'PayPal capture is not configured.');
  }
  const lookup = normalizeLookup(reference, orderId);
  if (typeof fetchImpl !== 'function') {
    fail('PAYPAL_CAPTURE_UNAVAILABLE', 'The browser cannot contact the PayPal capture service.');
  }

  const controller = typeof AbortController === 'function' ? new AbortController() : null;
  const safeTimeout = Math.min(60_000, Math.max(1_000, Number(timeoutMs) || DEFAULT_TIMEOUT_MS));
  const timer = controller ? setTimeout(() => controller.abort(), safeTimeout) : null;

  try {
    const response = await fetchImpl(normalizedEndpoint, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(lookup),
      cache: 'no-store',
      credentials: 'omit',
      redirect: 'error',
      ...(controller ? { signal: controller.signal } : {}),
    });
    let payload;
    try {
      payload = await response.json();
    } catch {
      fail('INVALID_PAYPAL_CAPTURE_RESPONSE', 'The PayPal capture endpoint did not return JSON.');
    }
    if (!response.ok) throw responseError(response.status, payload);
    return parseCaptureResponse(payload, lookup);
  } catch (error) {
    if (error instanceof PayPalCaptureClientError) throw error;
    if (controller?.signal.aborted || error?.name === 'AbortError') {
      fail('PAYPAL_CAPTURE_TIMEOUT', 'PayPal confirmation took too long. Please try again.');
    }
    fail('PAYPAL_CAPTURE_NETWORK_ERROR', 'The PayPal capture service could not be reached.');
  } finally {
    if (timer) clearTimeout(timer);
  }
}
