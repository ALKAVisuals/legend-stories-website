import {
  OrderStoreContractError,
  requirePaypalCaptureStore,
} from '../orders/store-contract.mjs';
import {
  PayPalApiError,
  PayPalConfigurationError,
  createPayPalApiClient,
  normalizePayPalOrderId,
} from '../payments/paypal-api.mjs';
import {
  PayPalCaptureError,
  validatePayPalCaptureResult,
} from '../payments/paypal-capture.mjs';

const MAX_REQUEST_BYTES = 4 * 1024;
const REFERENCE_PATTERN = /^[a-f0-9]{64}$/;

export class PayPalCaptureRequestError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = 'PayPalCaptureRequestError';
    this.code = code;
    this.details = details;
  }
}

function fail(code, message, details) {
  throw new PayPalCaptureRequestError(code, message, details);
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
    fail('REQUEST_TOO_LARGE', 'PayPal capture request is too large.');
  }
  const source = await request.text();
  if (Buffer.byteLength(source, 'utf8') > MAX_REQUEST_BYTES) {
    fail('REQUEST_TOO_LARGE', 'PayPal capture request is too large.');
  }
  try {
    return JSON.parse(source);
  } catch {
    fail('INVALID_JSON', 'PayPal capture request body is invalid JSON.');
  }
}

function normalizeCaptureLookup(payload = {}) {
  const reference = String(payload.reference || '').trim().toLowerCase();
  if (!REFERENCE_PATTERN.test(reference)) {
    fail('INVALID_PAYPAL_CAPTURE_LOOKUP', 'Order reference is invalid.');
  }
  let orderId;
  try {
    orderId = normalizePayPalOrderId(payload.orderId);
  } catch {
    fail('INVALID_PAYPAL_CAPTURE_LOOKUP', 'PayPal order ID is invalid.');
  }
  return Object.freeze({ reference, orderId });
}

function mapError(error, origin) {
  if (error instanceof PayPalCaptureRequestError) {
    return errorResponse(400, error.code, error.message, origin);
  }
  if (error instanceof OrderStoreContractError) {
    return errorResponse(503, 'PAYPAL_CAPTURE_STORE_NOT_CONFIGURED', 'PayPal order storage is not configured.', origin);
  }
  if (error instanceof PayPalConfigurationError) {
    return errorResponse(503, error.code, 'PayPal Sandbox capture is not configured.', origin);
  }
  if (error instanceof PayPalCaptureError) {
    const status = error.code.includes('MISMATCH') ? 409 : 502;
    return errorResponse(status, error.code, error.message, origin);
  }
  if (error instanceof PayPalApiError) {
    return errorResponse(502, error.code, 'PayPal could not capture the approved order.', origin);
  }
  if (error?.code === 'ORDER_NOT_FOUND') {
    return errorResponse(404, 'ORDER_NOT_FOUND', 'No matching PayPal order was found.', origin);
  }
  if (error?.code === 'PAYPAL_CAPTURE_ORDER_MISMATCH') {
    return errorResponse(409, error.code, 'PayPal capture does not match the reserved order.', origin);
  }
  if (error?.code === 'PAYPAL_CAPTURE_STORE_UNAVAILABLE'
    || error?.code === 'PAYPAL_CAPTURE_STORE_RETRYABLE') {
    return errorResponse(503, error.code, 'PayPal payment was captured but order confirmation storage is temporarily unavailable.', origin);
  }

  console.error('Unexpected PayPal capture error:', error);
  return errorResponse(500, 'PAYPAL_CAPTURE_FAILED', 'PayPal payment could not be confirmed.', origin);
}

export async function handleCapturePayPalOrder(request, {
  env = process.env,
  orderStore = null,
  paypalClient = null,
  paypalClientFactory = createPayPalApiClient,
  allowedOrigins = env.CHECKOUT_ALLOWED_ORIGINS || '',
  capturedAt = Math.floor(Date.now() / 1000),
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
    const store = requirePaypalCaptureStore(orderStore);
    const lookup = normalizeCaptureLookup(await parseJsonRequest(request));
    const reservedOrder = await store.getOrderByReference(lookup.reference);
    if (!reservedOrder) {
      return errorResponse(404, 'ORDER_NOT_FOUND', 'No matching PayPal order was found.', corsOrigin);
    }
    if (reservedOrder.paymentSessionId !== lookup.orderId) {
      return errorResponse(404, 'ORDER_NOT_FOUND', 'No matching PayPal order was found.', corsOrigin);
    }
    if (!['test', 'live'].includes(reservedOrder.mode)) {
      throw new PayPalCaptureError(
        'PAYPAL_CAPTURE_MODE_MISMATCH',
        'Stored PayPal order mode is invalid.',
      );
    }
    if (reservedOrder.status === 'paid') {
      return jsonResponse(200, {
        provider: 'paypal',
        reference: lookup.reference,
        orderId: lookup.orderId,
        mode: reservedOrder.mode,
        status: 'paid',
        paid: true,
        duplicate: true,
        captureIds: [],
      }, corsOrigin);
    }

    const client = paypalClient || paypalClientFactory({
      clientId: env.PAYPAL_CLIENT_ID,
      clientSecret: env.PAYPAL_CLIENT_SECRET,
      apiBase: env.PAYPAL_API_BASE,
      allowLive: env.PAYPAL_ALLOW_LIVE === 'true',
    });
    if (client.mode !== reservedOrder.mode) {
      throw new PayPalCaptureError(
        'PAYPAL_CAPTURE_MODE_MISMATCH',
        'PayPal environment does not match the reserved order.',
      );
    }

    const capturePayload = await client.captureOrder(lookup.orderId, {
      idempotencyKey: `legend-paypal-capture-${lookup.reference}`,
    });
    const capture = validatePayPalCaptureResult(capturePayload, {
      reference: lookup.reference,
      orderId: lookup.orderId,
      amountTotal: reservedOrder.amountTotal,
      currency: reservedOrder.currency,
      fallbackCapturedAt: capturedAt,
    });

    const persisted = await store.processPaypalCapture({
      ...capture,
      mode: reservedOrder.mode,
    });
    if (!persisted?.order || persisted.order.status !== 'paid') {
      throw new Error('PayPal capture store did not persist a paid order.');
    }

    return jsonResponse(200, {
      provider: 'paypal',
      reference: lookup.reference,
      orderId: lookup.orderId,
      mode: reservedOrder.mode,
      status: 'paid',
      paid: true,
      duplicate: Boolean(persisted.duplicate),
      captureIds: capture.captureIds,
    }, corsOrigin);
  } catch (error) {
    return mapError(error, corsOrigin);
  }
}

export function createCapturePayPalOrderHandler(options = {}) {
  return (request) => handleCapturePayPalOrder(request, options);
}
