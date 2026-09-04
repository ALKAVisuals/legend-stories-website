import {
  OrderStoreContractError,
  requireOrderLookupStore,
} from '../orders/store-contract.mjs';

const MAX_REQUEST_BYTES = 4 * 1024;
const REFERENCE_PATTERN = /^[a-f0-9]{64}$/;
const PAYPAL_ORDER_ID_PATTERN = /^[A-Z0-9]{1,36}$/;

export class InvoiceDownloadError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = 'InvoiceDownloadError';
    this.code = code;
    this.details = details;
  }
}

function fail(code, message, details = {}) {
  throw new InvoiceDownloadError(code, message, details);
}

function enabled(value) {
  return String(value || '').trim().toLowerCase() === 'true';
}

function parseAllowedOrigins(value = '') {
  return new Set(
    String(value)
      .split(',')
      .map((origin) => origin.trim())
      .filter(Boolean),
  );
}

function resolveCorsOrigin(request, configuredOrigins) {
  const origin = request.headers.get('origin') || '';
  if (!origin) return '';
  const allowed = parseAllowedOrigins(configuredOrigins);
  allowed.add(new URL(request.url).origin);
  return allowed.has(origin) ? origin : null;
}

function securityHeaders(origin = '', contentType = 'application/json; charset=utf-8') {
  const headers = {
    'Content-Type': contentType,
    'Cache-Control': 'private, no-store',
    'Content-Security-Policy': "default-src 'none'; frame-ancestors 'none'",
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'no-referrer',
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
    headers: securityHeaders(origin),
  });
}

function errorResponse(status, code, message, origin = '') {
  return jsonResponse(status, { error: { code, message } }, origin);
}

async function parseJsonRequest(request) {
  const contentType = request.headers.get('content-type') || '';
  if (!contentType.toLowerCase().startsWith('application/json')) {
    fail('UNSUPPORTED_CONTENT_TYPE', 'Content-Type must be application/json.');
  }
  const declaredLength = Number(request.headers.get('content-length') || 0);
  if (declaredLength > MAX_REQUEST_BYTES) {
    fail('REQUEST_TOO_LARGE', 'Invoice download request is too large.');
  }
  const source = await request.text();
  if (Buffer.byteLength(source, 'utf8') > MAX_REQUEST_BYTES) {
    fail('REQUEST_TOO_LARGE', 'Invoice download request is too large.');
  }
  try {
    return JSON.parse(source);
  } catch {
    fail('INVALID_JSON', 'Invoice download request body is invalid JSON.');
  }
}

function normalizeLookup(payload = {}) {
  const reference = String(payload.reference || '').trim().toLowerCase();
  if (!REFERENCE_PATTERN.test(reference)) {
    fail('INVALID_INVOICE_LOOKUP', 'Invoice lookup reference is invalid.');
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
  fail('INVALID_INVOICE_LOOKUP', 'Payment session identifier is invalid.');
}

function orderMatches(order, lookup) {
  if (!order || typeof order !== 'object') return false;
  return order.reference === lookup.reference
    && order.paymentSessionId === lookup.sessionId
    && (!lookup.mode || order.mode === lookup.mode);
}

function assertArtifactStore(store) {
  if (typeof store?.loadArtifactState !== 'function') {
    throw new TypeError('Invoice artifact store is missing loadArtifactState().');
  }
}

function assertPdfStore(store) {
  if (typeof store?.loadVerifiedArtifact !== 'function') {
    throw new TypeError('Invoice PDF store is missing loadVerifiedArtifact().');
  }
}

function mapError(error, origin) {
  if (error instanceof OrderStoreContractError) {
    return errorResponse(503, 'INVOICE_DOWNLOAD_NOT_CONFIGURED', 'Invoice download is not configured.', origin);
  }
  if (error instanceof InvoiceDownloadError) {
    return errorResponse(400, error.code, error.message, origin);
  }
  const code = String(error?.code || '');
  if (code === 'V3_INVOICE_ARTIFACT_NOT_FOUND') {
    return errorResponse(404, 'INVOICE_NOT_AVAILABLE', 'Invoice PDF is not available.', origin);
  }
  if (code.startsWith('V3_INVOICE_STORAGE_') || code.startsWith('V3_INVOICE_ARTIFACT_')) {
    return errorResponse(503, 'INVOICE_PDF_UNAVAILABLE', 'Invoice PDF is temporarily unavailable.', origin);
  }
  console.error('Unexpected invoice download error.', {
    name: error?.name || 'Error',
    code: String(error?.code || 'UNKNOWN').slice(0, 120),
  });
  return errorResponse(500, 'INVOICE_DOWNLOAD_FAILED', 'Invoice PDF could not be downloaded.', origin);
}

export async function handleInvoiceDownload(request, {
  orderStore = null,
  artifactStore = null,
  pdfStore = null,
  storageEnabled = process.env.V3_INVOICE_STORAGE_ENABLED,
  allowedOrigins = process.env.CHECKOUT_ALLOWED_ORIGINS || '',
} = {}) {
  const corsOrigin = resolveCorsOrigin(request, allowedOrigins);
  if (corsOrigin === null) {
    return errorResponse(403, 'ORIGIN_NOT_ALLOWED', 'Request origin is not allowed.');
  }
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: securityHeaders(corsOrigin) });
  }
  if (request.method !== 'POST') {
    return errorResponse(405, 'METHOD_NOT_ALLOWED', 'Only POST is allowed.', corsOrigin);
  }
  if (!enabled(storageEnabled)) {
    return errorResponse(503, 'INVOICE_DOWNLOAD_DISABLED', 'Invoice download is not enabled.', corsOrigin);
  }

  try {
    const store = requireOrderLookupStore(orderStore);
    assertArtifactStore(artifactStore);
    assertPdfStore(pdfStore);
    const lookup = normalizeLookup(await parseJsonRequest(request));
    const order = await store.getOrderByReference(lookup.reference);
    if (!orderMatches(order, lookup)
      || order.status !== 'paid'
      || Number(order.documentProfileVersion) !== 1) {
      return errorResponse(404, 'INVOICE_NOT_AVAILABLE', 'Invoice PDF is not available.', corsOrigin);
    }

    const artifact = await artifactStore.loadArtifactState({
      orderReference: lookup.reference,
      invoiceId: order.invoiceId,
    });
    if (!artifact.storageBound) {
      return errorResponse(404, 'INVOICE_NOT_AVAILABLE', 'Invoice PDF is not available.', corsOrigin);
    }

    const persisted = await pdfStore.loadVerifiedArtifact({
      invoiceId: artifact.invoiceId,
      orderReference: artifact.orderReference,
      snapshotSchemaVersion: artifact.snapshotSchemaVersion,
      rendererVersion: artifact.rendererVersion,
      pdfSha256: artifact.pdfSha256,
      pdfByteLength: artifact.pdfByteLength,
      attachmentFilename: artifact.attachmentFilename,
      storageBackend: artifact.storageBackend,
      storageKey: artifact.storageKey,
    });

    return new Response(persisted.bytes, {
      status: 200,
      headers: {
        ...securityHeaders(corsOrigin, 'application/pdf'),
        'Content-Disposition': `attachment; filename="${artifact.attachmentFilename}"`,
      },
    });
  } catch (error) {
    if (error?.code === 'ORDER_NOT_FOUND') {
      return errorResponse(404, 'INVOICE_NOT_AVAILABLE', 'Invoice PDF is not available.', corsOrigin);
    }
    return mapError(error, corsOrigin);
  }
}

export function createInvoiceDownloadHandler(options = {}) {
  return (request) => handleInvoiceDownload(request, options);
}
