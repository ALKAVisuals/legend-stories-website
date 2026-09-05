import { createHash, timingSafeEqual } from 'node:crypto';

const MAX_REQUEST_BYTES = 4 * 1024;
const REFERENCE_PATTERN = /^[a-f0-9]{64}$/;
const TOKEN_MIN_LENGTH = 32;
const TOKEN_MAX_LENGTH = 512;

export class DashboardInvoiceAccessError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = 'DashboardInvoiceAccessError';
    this.code = code;
    this.details = details;
  }
}

function fail(code, message, details = {}) {
  throw new DashboardInvoiceAccessError(code, message, details);
}

function enabled(value) {
  return String(value || '').trim().toLowerCase() === 'true';
}

function securityHeaders(contentType = 'application/json; charset=utf-8') {
  return {
    'Content-Type': contentType,
    'Cache-Control': 'private, no-store',
    'Content-Security-Policy': "default-src 'none'; frame-ancestors 'none'",
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'no-referrer',
  };
}

function jsonResponse(status, body, extraHeaders = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...securityHeaders(),
      ...extraHeaders,
    },
  });
}

function errorResponse(status, code, message, extraHeaders = {}) {
  return jsonResponse(status, { error: { code, message } }, extraHeaders);
}

function configuredToken(value) {
  const token = String(value ?? '');
  if (token.length < TOKEN_MIN_LENGTH
    || token.length > TOKEN_MAX_LENGTH
    || /[\u0000-\u001f\u007f]/.test(token)) {
    return null;
  }
  return token;
}

function bearerToken(request) {
  const header = request.headers.get('authorization') || '';
  const match = /^Bearer ([^\s]+)$/.exec(header);
  return match?.[1] || '';
}

function tokenDigest(value) {
  return createHash('sha256').update(value, 'utf8').digest();
}

function isAuthorized(request, expectedToken) {
  const actual = bearerToken(request);
  if (!actual) return false;
  return timingSafeEqual(tokenDigest(actual), tokenDigest(expectedToken));
}

async function parseJsonRequest(request) {
  const contentType = request.headers.get('content-type') || '';
  if (!contentType.toLowerCase().startsWith('application/json')) {
    fail('UNSUPPORTED_CONTENT_TYPE', 'Content-Type must be application/json.');
  }
  const declaredLength = Number(request.headers.get('content-length') || 0);
  if (declaredLength > MAX_REQUEST_BYTES) {
    fail('REQUEST_TOO_LARGE', 'Dashboard invoice request is too large.');
  }
  const source = await request.text();
  if (Buffer.byteLength(source, 'utf8') > MAX_REQUEST_BYTES) {
    fail('REQUEST_TOO_LARGE', 'Dashboard invoice request is too large.');
  }
  try {
    return JSON.parse(source);
  } catch {
    fail('INVALID_JSON', 'Dashboard invoice request body is invalid JSON.');
  }
}

function normalizeRequest(payload = {}) {
  const reference = String(payload.reference || '').trim().toLowerCase();
  if (!REFERENCE_PATTERN.test(reference)) {
    fail('INVALID_DASHBOARD_INVOICE_REQUEST', 'Order reference is invalid.');
  }
  const action = String(payload.action || '').trim().toLowerCase();
  if (!['metadata', 'download'].includes(action)) {
    fail('INVALID_DASHBOARD_INVOICE_REQUEST', 'Dashboard invoice action is invalid.');
  }
  if ('storageKey' in payload || 'pdfStorageKey' in payload || 'blobKey' in payload) {
    fail('INVALID_DASHBOARD_INVOICE_REQUEST', 'Blob storage keys are not accepted.');
  }
  return Object.freeze({ reference, action });
}

function assertSummarySource(source) {
  if (typeof source?.loadDashboardInvoiceSummary !== 'function') {
    throw new TypeError('Dashboard invoice source is missing loadDashboardInvoiceSummary().');
  }
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

async function loadArtifactOrNull(artifactStore, summary) {
  try {
    return await artifactStore.loadArtifactState({
      orderReference: summary.orderReference,
      invoiceId: summary.invoiceId,
    });
  } catch (error) {
    if (error?.code === 'V3_INVOICE_ARTIFACT_NOT_FOUND') return null;
    throw error;
  }
}

function publicMetadata(summary, artifact) {
  return Object.freeze({
    orderReference: summary.orderReference,
    invoiceNumber: summary.invoiceNumber,
    issuedAt: summary.issuedAt,
    currency: summary.currency,
    amountTotal: summary.amountTotal,
    schemaVersion: summary.schemaVersion,
    deliveryStatus: artifact?.deliveryStatus || null,
    attachmentFilename: artifact?.attachmentFilename || null,
    pdfAvailable: Boolean(artifact?.storageBound),
  });
}

function mapError(error) {
  if (error instanceof DashboardInvoiceAccessError) {
    return errorResponse(400, error.code, error.message);
  }
  const code = String(error?.code || '');
  if (code === 'V3_DASHBOARD_INVOICE_NOT_FOUND'
    || code === 'V3_DASHBOARD_INVOICE_IDENTITY_MISMATCH'
    || code === 'V3_INVOICE_ARTIFACT_NOT_FOUND'
    || code === 'V3_INVOICE_ARTIFACT_IDENTITY_MISMATCH') {
    return errorResponse(404, 'DASHBOARD_INVOICE_NOT_AVAILABLE', 'Invoice is not available.');
  }
  if (code.startsWith('V3_INVOICE_STORAGE_')
    || code.startsWith('V3_INVOICE_ARTIFACT_')
    || code === 'INVALID_NEON_CLIENT'
    || code === 'INVALID_NEON_CLIENT_FACTORY') {
    return errorResponse(503, 'DASHBOARD_INVOICE_UNAVAILABLE', 'Invoice service is temporarily unavailable.');
  }
  console.error('Unexpected dashboard invoice access error.', {
    name: error?.name || 'Error',
    code: String(error?.code || 'UNKNOWN').slice(0, 120),
  });
  return errorResponse(500, 'DASHBOARD_INVOICE_ACCESS_FAILED', 'Invoice request failed.');
}

export async function handleDashboardInvoiceAccess(request, {
  serviceToken = process.env.LEGENDMURAL_DASHBOARD_INVOICE_TOKEN,
  storageEnabled = process.env.V3_INVOICE_STORAGE_ENABLED,
  invoiceSource = null,
  artifactStore = null,
  pdfStore = null,
} = {}) {
  if (request.headers.get('origin')) {
    return errorResponse(403, 'BROWSER_ORIGIN_NOT_ALLOWED', 'Browser-origin requests are not allowed.');
  }
  if (request.method !== 'POST') {
    return errorResponse(405, 'METHOD_NOT_ALLOWED', 'Only POST is allowed.');
  }

  const expectedToken = configuredToken(serviceToken);
  if (!expectedToken) {
    return errorResponse(503, 'DASHBOARD_INVOICE_API_NOT_CONFIGURED', 'Dashboard invoice API is not configured.');
  }
  if (!isAuthorized(request, expectedToken)) {
    return errorResponse(
      401,
      'DASHBOARD_INVOICE_UNAUTHORIZED',
      'Dashboard invoice authorization failed.',
      { 'WWW-Authenticate': 'Bearer' },
    );
  }

  try {
    assertSummarySource(invoiceSource);
    assertArtifactStore(artifactStore);
    const input = normalizeRequest(await parseJsonRequest(request));
    const summary = await invoiceSource.loadDashboardInvoiceSummary({
      orderReference: input.reference,
    });
    const artifact = await loadArtifactOrNull(artifactStore, summary);

    if (input.action === 'metadata') {
      return jsonResponse(200, { invoice: publicMetadata(summary, artifact) });
    }

    if (!enabled(storageEnabled)) {
      return errorResponse(503, 'DASHBOARD_INVOICE_DOWNLOAD_DISABLED', 'Dashboard invoice download is not enabled.');
    }
    if (!artifact?.storageBound) {
      return errorResponse(404, 'DASHBOARD_INVOICE_NOT_AVAILABLE', 'Invoice PDF is not available.');
    }
    assertPdfStore(pdfStore);

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
        ...securityHeaders('application/pdf'),
        'Content-Disposition': `attachment; filename="${artifact.attachmentFilename}"`,
      },
    });
  } catch (error) {
    return mapError(error);
  }
}

export function createDashboardInvoiceAccessHandler(options = {}) {
  return (request) => handleDashboardInvoiceAccess(request, options);
}
