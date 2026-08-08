import { COMMERCE_RUNTIME_CONFIG } from './runtime-config.mjs';

const DEFAULT_TIMEOUT_MS = 10_000;
const PAYPAL_ORDER_ID_PATTERN = /^[A-Z0-9]{1,36}$/;
const ORDER_STATUSES = new Set([
  'payment_pending',
  'payment_processing',
  'payment_failed',
  'expired',
  'paid',
]);

export const ORDER_STATUS_ENDPOINT = String(
  COMMERCE_RUNTIME_CONFIG.orderStatusEndpoint || '',
).trim();

export class OrderStatusClientError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = 'OrderStatusClientError';
    this.code = code;
    this.details = details;
  }
}

function fail(code, message, details) {
  throw new OrderStatusClientError(code, message, details);
}

function isLocalDevelopmentHost(hostname) {
  return ['localhost', '127.0.0.1', '[::1]'].includes(hostname);
}

export function normalizeOrderStatusEndpoint(value = '', baseUrl = '') {
  const raw = String(value || '').trim();
  if (!raw) return '';

  let endpoint;
  try {
    endpoint = baseUrl ? new URL(raw, baseUrl) : new URL(raw);
  } catch {
    fail('INVALID_ORDER_STATUS_ENDPOINT', 'The order status endpoint is not a valid URL.');
  }

  const localHttp = endpoint.protocol === 'http:' && isLocalDevelopmentHost(endpoint.hostname);
  if (endpoint.protocol !== 'https:' && !localHttp) {
    fail('INVALID_ORDER_STATUS_ENDPOINT', 'The order status endpoint must use HTTPS.');
  }
  if (endpoint.username || endpoint.password) {
    fail('INVALID_ORDER_STATUS_ENDPOINT', 'The order status endpoint cannot contain credentials.');
  }
  endpoint.hash = '';
  return endpoint.toString();
}

export function isOrderStatusConfigured(
  endpoint = ORDER_STATUS_ENDPOINT,
  baseUrl = globalThis.location?.origin || '',
) {
  return Boolean(normalizeOrderStatusEndpoint(endpoint, baseUrl));
}

function normalizeLookup(reference, sessionId) {
  const normalizedReference = String(reference || '').trim().toLowerCase();
  const normalizedSessionId = String(sessionId || '').trim();
  if (!/^[a-f0-9]{64}$/.test(normalizedReference)) {
    fail('INVALID_ORDER_LOOKUP', 'The order verification details are invalid.');
  }
  if (/^cs_(test|live)_[A-Za-z0-9_-]+$/.test(normalizedSessionId)) {
    return Object.freeze({
      reference: normalizedReference,
      sessionId: normalizedSessionId,
      mode: normalizedSessionId.startsWith('cs_live_') ? 'live' : 'test',
    });
  }
  if (PAYPAL_ORDER_ID_PATTERN.test(normalizedSessionId)) {
    return Object.freeze({
      reference: normalizedReference,
      sessionId: normalizedSessionId,
      mode: '',
    });
  }
  fail('INVALID_ORDER_LOOKUP', 'The order verification details are invalid.');
}

function parseStatusResponse(payload, lookup) {
  if (!payload || typeof payload !== 'object') {
    fail('INVALID_ORDER_STATUS_RESPONSE', 'The order status endpoint returned an invalid response.');
  }
  if (payload.reference !== lookup.reference
    || payload.sessionId !== lookup.sessionId
    || (lookup.mode && payload.mode !== lookup.mode)) {
    fail('INVALID_ORDER_STATUS_RESPONSE', 'The order status response does not match this payment session.');
  }
  const mode = String(payload.mode || '');
  if (!['test', 'live'].includes(mode)) {
    fail('INVALID_ORDER_STATUS_RESPONSE', 'The order status response has an invalid payment mode.');
  }

  const status = String(payload.status || '');
  if (!ORDER_STATUSES.has(status)
    || payload.paid !== (status === 'paid')
    || payload.terminal !== ['paid', 'payment_failed', 'expired'].includes(status)) {
    fail('INVALID_ORDER_STATUS_RESPONSE', 'The order status response is inconsistent.');
  }
  if (!Number.isInteger(payload.updatedAt) || payload.updatedAt < 0
    || !Number.isInteger(payload.version) || payload.version < 0) {
    fail('INVALID_ORDER_STATUS_RESPONSE', 'The order status metadata is invalid.');
  }

  return Object.freeze({
    reference: lookup.reference,
    sessionId: lookup.sessionId,
    mode,
    status,
    paid: payload.paid,
    terminal: payload.terminal,
    updatedAt: payload.updatedAt,
    version: payload.version,
  });
}

function responseError(status, payload) {
  const code = String(payload?.error?.code || '').trim() || 'ORDER_STATUS_REQUEST_FAILED';
  const message = String(payload?.error?.message || '').trim().slice(0, 240)
    || 'Order status could not be checked.';
  return new OrderStatusClientError(code, message, { status });
}

export async function requestVerifiedOrderStatus({
  endpoint = ORDER_STATUS_ENDPOINT,
  reference,
  sessionId,
  baseUrl = globalThis.location?.origin || '',
  fetchImpl = globalThis.fetch,
  timeoutMs = DEFAULT_TIMEOUT_MS,
} = {}) {
  const normalizedEndpoint = normalizeOrderStatusEndpoint(endpoint, baseUrl);
  if (!normalizedEndpoint) {
    fail('ORDER_STATUS_NOT_CONFIGURED', 'Order status verification is not configured.');
  }
  const lookup = normalizeLookup(reference, sessionId);
  if (typeof fetchImpl !== 'function') {
    fail('ORDER_STATUS_UNAVAILABLE', 'The browser cannot contact the order status endpoint.');
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
      body: JSON.stringify({
        reference: lookup.reference,
        sessionId: lookup.sessionId,
      }),
      cache: 'no-store',
      credentials: 'omit',
      redirect: 'error',
      ...(controller ? { signal: controller.signal } : {}),
    });

    let payload;
    try {
      payload = await response.json();
    } catch {
      fail('INVALID_ORDER_STATUS_RESPONSE', 'The order status endpoint did not return JSON.');
    }
    if (!response.ok) throw responseError(response.status, payload);
    return parseStatusResponse(payload, lookup);
  } catch (error) {
    if (error instanceof OrderStatusClientError) throw error;
    if (controller?.signal.aborted || error?.name === 'AbortError') {
      fail('ORDER_STATUS_TIMEOUT', 'Order verification took too long. Please try again later.');
    }
    fail('ORDER_STATUS_NETWORK_ERROR', 'The order status service could not be reached.');
  } finally {
    if (timer) clearTimeout(timer);
  }
}
