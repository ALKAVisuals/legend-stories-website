import { NeonWithdrawalStoreError } from '../adapters/neon-withdrawal-store.mjs';

const MAX_REQUEST_BYTES = 4 * 1024;

export class WithdrawalRequestError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'WithdrawalRequestError';
    this.code = code;
  }
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
  return allowed.has(origin) ? origin : null;
}

async function parseJsonRequest(request) {
  const contentType = request.headers.get('content-type') || '';
  if (!contentType.toLowerCase().startsWith('application/json')) {
    throw new WithdrawalRequestError('UNSUPPORTED_CONTENT_TYPE', 'Content-Type must be application/json.');
  }
  const declaredLength = Number(request.headers.get('content-length') || 0);
  if (declaredLength > MAX_REQUEST_BYTES) {
    throw new WithdrawalRequestError('REQUEST_TOO_LARGE', 'Withdrawal request is too large.');
  }
  const source = await request.text();
  if (Buffer.byteLength(source, 'utf8') > MAX_REQUEST_BYTES) {
    throw new WithdrawalRequestError('REQUEST_TOO_LARGE', 'Withdrawal request is too large.');
  }
  try {
    return JSON.parse(source);
  } catch {
    throw new WithdrawalRequestError('INVALID_JSON', 'Withdrawal request body is invalid JSON.');
  }
}

function mapError(error, origin) {
  if (error instanceof WithdrawalRequestError) {
    return errorResponse(400, error.code, error.message, origin);
  }
  if (error instanceof NeonWithdrawalStoreError) {
    if (error.code === 'WITHDRAWAL_ORDER_NOT_FOUND') {
      return errorResponse(404, 'WITHDRAWAL_ORDER_NOT_FOUND', 'No matching order was found.', origin);
    }
    if (error.code.startsWith('INVALID_')) {
      return errorResponse(400, 'INVALID_WITHDRAWAL_REQUEST', 'The withdrawal details are invalid.', origin);
    }
    return errorResponse(503, 'WITHDRAWAL_STORE_UNAVAILABLE', 'The withdrawal request could not be stored.', origin);
  }
  console.error('Unexpected withdrawal request error:', error);
  return errorResponse(500, 'WITHDRAWAL_REQUEST_FAILED', 'The withdrawal request could not be processed.', origin);
}

export async function handleCreateWithdrawal(request, {
  withdrawalStore,
  allowedOrigins = process.env.CHECKOUT_ALLOWED_ORIGINS || '',
  now = () => Math.floor(Date.now() / 1000),
} = {}) {
  const corsOrigin = resolveCorsOrigin(request, allowedOrigins);
  if (corsOrigin === null) {
    return errorResponse(403, 'ORIGIN_NOT_ALLOWED', 'Request origin is not allowed.');
  }
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: responseHeaders(corsOrigin) });
  }
  if (request.method !== 'POST') {
    return errorResponse(405, 'METHOD_NOT_ALLOWED', 'Only POST is allowed.', corsOrigin);
  }

  try {
    if (!withdrawalStore || typeof withdrawalStore.createWithdrawal !== 'function') {
      return errorResponse(503, 'WITHDRAWAL_STORE_NOT_CONFIGURED', 'Withdrawal storage is not configured.', corsOrigin);
    }
    const payload = await parseJsonRequest(request);
    if (payload?.confirm !== true) {
      throw new WithdrawalRequestError(
        'WITHDRAWAL_CONFIRMATION_REQUIRED',
        'You must explicitly confirm that you want to withdraw from this purchase.',
      );
    }
    const result = await withdrawalStore.createWithdrawal({
      orderId: payload.orderId,
      email: payload.email,
      withdrawnAt: now(),
    });
    const withdrawal = result.withdrawal;
    return jsonResponse(result.created ? 201 : 200, {
      orderId: withdrawal.orderId,
      confirmationCode: withdrawal.confirmationCode,
      withdrawnAt: withdrawal.withdrawnAt,
      withdrawnAtIso: new Date(withdrawal.withdrawnAt * 1000).toISOString(),
      alreadyReceived: !result.created,
    }, corsOrigin);
  } catch (error) {
    return mapError(error, corsOrigin);
  }
}
