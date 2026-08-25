import {
  OrderStoreContractError,
  requireOrderLookupStore,
} from '../orders/store-contract.mjs';

const MAX_REQUEST_BYTES = 4 * 1024;
const REFERENCE_PATTERN = /^[a-f0-9]{64}$/;
const PAYPAL_ORDER_ID_PATTERN = /^[A-Z0-9]{1,36}$/;
const ORDER_STATUSES = new Set([
  'payment_pending',
  'payment_processing',
  'payment_failed',
  'expired',
  'paid',
]);

export class OrderStatusLookupError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = 'OrderStatusLookupError';
    this.code = code;
    this.details = details;
  }
}

function fail(code, message, details) {
  throw new OrderStatusLookupError(code, message, details);
}

function parseAllowedOrigins(value = '') {
  return new Set(
    String(value)
      .split(',')
      .map((origin) => origin.trim())
      .filter(Boolean),
  );
}

function responseHeaders(origin = '') {
  const headers = {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'Content-Security-Policy': "default-src 'none'; frame-ancestors 'none'",
    'X-Content-Type-Options': 'nosniff',
    Vary: 'Origin',
  };
  if (origin) {
    headers['Access-Control-Allow-Origin'] = origin;
    headers['Access-Control-Allow-Methods'] = 'POST, OPTIONS';
    headers['Access-Control-Allow-Headers'] = 'Content-Type';
  }
  return headers;
}

function jsonResponse(status, body, origin = '') {
  return new Response(JSON.stringify(body), {
    status,
    headers: responseHeaders(origin),
  });
}

function errorResponse(status, code, message, origin = '') {
  return jsonResponse(status, { error: { code, message } }, origin);
}

function resolveCorsOrigin(request, configuredOrigins) {
  const origin = request.headers.get('origin') || '';
  if (!origin) return '';

  const allowed = parseAllowedOrigins(configuredOrigins);
  allowed.add(new URL(request.url).origin);
  if (!allowed.has(origin)) return null;
  return origin;
}

async function parseJsonRequest(request) {
  const contentType = request.headers.get('content-type') || '';
  if (!contentType.toLowerCase().startsWith('application/json')) {
    fail('UNSUPPORTED_CONTENT_TYPE', 'Content-Type must be application/json.');
  }

  const declaredLength = Number(request.headers.get('content-length') || 0);
  if (declaredLength > MAX_REQUEST_BYTES) {
    fail('REQUEST_TOO_LARGE', 'Order status request is too large.');
  }

  const source = await request.text();
  if (Buffer.byteLength(source, 'utf8') > MAX_REQUEST_BYTES) {
    fail('REQUEST_TOO_LARGE', 'Order status request is too large.');
  }

  try {
    return JSON.parse(source);
  } catch {
    fail('INVALID_JSON', 'Order status request body is invalid JSON.');
  }
}

function normalizeLookup(payload = {}) {
  const reference = String(payload.reference || '').trim().toLowerCase();
  if (!REFERENCE_PATTERN.test(reference)) {
    fail('INVALID_ORDER_LOOKUP', 'The order lookup reference is invalid.');
  }

  const sessionId = String(payload.sessionId || '').trim();
  if (/^cs_(test|live)_[A-Za-z0-9_-]+$/.test(sessionId)) {
    return Object.freeze({
      reference,
      sessionId,
      mode: sessionId.startsWith('cs_live_') ? 'live' : 'test',
    });
  }
  if (PAYPAL_ORDER_ID_PATTERN.test(sessionId)) {
    return Object.freeze({ reference, sessionId, mode: '' });
  }
  fail('INVALID_ORDER_LOOKUP', 'The payment session identifier is invalid.');
}

function normalizePublicStatus(order, lookup) {
  if (!order || typeof order !== 'object') return null;
  if (order.reference !== lookup.reference
    || order.paymentSessionId !== lookup.sessionId
    || (lookup.mode && order.mode !== lookup.mode)) {
    return null;
  }

  const mode = String(order.mode || '');
  if (!['test', 'live'].includes(mode)) {
    fail('INVALID_ORDER_STORE_RESULT', 'The stored order mode is invalid.');
  }
  const status = String(order.status || '');
  if (!ORDER_STATUSES.has(status)) {
    fail('INVALID_ORDER_STORE_RESULT', 'The stored order status is invalid.');
  }
  const version = Number(order.version);
  const updatedAt = Number(order.updatedAt);
  if (!Number.isInteger(version) || version < 0
    || !Number.isInteger(updatedAt) || updatedAt < 0) {
    fail('INVALID_ORDER_STORE_RESULT', 'The stored order status metadata is invalid.');
  }

  return Object.freeze({
    reference: lookup.reference,
    sessionId: lookup.sessionId,
    mode,
    status,
    paid: status === 'paid',
    terminal: ['paid', 'payment_failed', 'expired'].includes(status),
    updatedAt,
    version,
  });
}

function mapError(error, origin) {
  if (error instanceof OrderStoreContractError) {
    return errorResponse(
      503,
      'ORDER_STORE_NOT_CONFIGURED',
      'Order status storage is not configured.',
      origin,
    );
  }
  if (error instanceof OrderStatusLookupError) {
    if (error.code === 'INVALID_ORDER_STORE_RESULT') {
      return errorResponse(500, error.code, 'Stored order status is unavailable.', origin);
    }
    return errorResponse(400, error.code, error.message, origin);
  }

  console.error('Unexpected order status error.', {
    name: error?.name || 'Error',
    code: String(error?.code || 'UNKNOWN').slice(0, 120),
  });
  return errorResponse(500, 'ORDER_STATUS_FAILED', 'Order status could not be checked.', origin);
}

export async function handleOrderStatus(request, {
  orderStore = null,
  allowedOrigins = process.env.CHECKOUT_ALLOWED_ORIGINS || '',
} = {}) {
  const corsOrigin = resolveCorsOrigin(request, allowedOrigins);
  if (corsOrigin === null) {
    return errorResponse(403, 'ORIGIN_NOT_ALLOWED', 'Request origin is not allowed.');
  }

  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: responseHeaders(corsOrigin),
    });
  }
  if (request.method !== 'POST') {
    return errorResponse(405, 'METHOD_NOT_ALLOWED', 'Only POST is allowed.', corsOrigin);
  }

  try {
    const store = requireOrderLookupStore(orderStore);
    const lookup = normalizeLookup(await parseJsonRequest(request));
    const order = await store.getOrderByReference(lookup.reference);
    const status = normalizePublicStatus(order, lookup);
    if (!status) {
      return errorResponse(404, 'ORDER_NOT_FOUND', 'No matching order was found.', corsOrigin);
    }
    return jsonResponse(200, status, corsOrigin);
  } catch (error) {
    if (error?.code === 'ORDER_NOT_FOUND') {
      return errorResponse(404, 'ORDER_NOT_FOUND', 'No matching order was found.', corsOrigin);
    }
    return mapError(error, corsOrigin);
  }
}

export function createOrderStatusHandler(options = {}) {
  return (request) => handleOrderStatus(request, options);
}
