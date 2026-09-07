import assert from 'node:assert/strict';
import test from 'node:test';

import { handleDashboardInvoiceAccess } from '../server/api/dashboard-invoice-access.mjs';

const reference = 'c'.repeat(64);
const token = 'dashboard-invoice-service-token-2026-test-only';
const hash = 'a'.repeat(64);
const storageKey = `v1/invoices/77/${hash}.pdf`;

function request(body, {
  authorization = `Bearer ${token}`,
  origin = '',
  method = 'POST',
} = {}) {
  const headers = new Headers({ 'Content-Type': 'application/json' });
  if (authorization) headers.set('Authorization', authorization);
  if (origin) headers.set('Origin', origin);
  return new Request('https://legendmural.com/api/internal/dashboard-invoice', {
    method,
    headers,
    body: method === 'POST' ? JSON.stringify(body) : undefined,
  });
}

function summary() {
  return Object.freeze({
    orderReference: reference,
    invoiceId: 77,
    invoiceNumber: 'LM-INV-2026-000077',
    issuedAt: 1_800_000_100,
    currency: 'EUR',
    amountTotal: 12395,
    schemaVersion: 1,
  });
}

function artifact(overrides = {}) {
  return Object.freeze({
    orderReference: reference,
    invoiceId: 77,
    snapshotSchemaVersion: 1,
    deliveryStatus: 'delivered',
    rendererVersion: 2,
    pdfSha256: hash,
    pdfByteLength: 7,
    attachmentFilename: 'invoice-LM-INV-2026-000077.pdf',
    storageBackend: 'netlify_blobs',
    storageKey,
    storedAt: 1_800_000_101,
    storageBound: true,
    ...overrides,
  });
}

function dependencies({
  artifactState = artifact(),
  pdfBytes = Buffer.from('%PDF-x'),
  auditError = null,
} = {}) {
  const calls = { summary: [], artifact: [], pdf: [], audit: [] };
  return {
    calls,
    invoiceSource: {
      async loadDashboardInvoiceSummary(input) {
        calls.summary.push(input);
        return summary();
      },
    },
    artifactStore: {
      async loadArtifactState(input) {
        calls.artifact.push(input);
        if (artifactState instanceof Error) throw artifactState;
        return artifactState;
      },
    },
    pdfStore: {
      async loadVerifiedArtifact(input) {
        calls.pdf.push(input);
        return { bytes: pdfBytes };
      },
    },
    auditStore: {
      async recordInvoiceAccess(input) {
        calls.audit.push(input);
        if (auditError) throw auditError;
        return input;
      },
    },
  };
}

function enabledOptions(deps = {}, overrides = {}) {
  return {
    apiEnabled: 'true',
    serviceToken: token,
    ...deps,
    ...overrides,
  };
}

test('fails closed while the dedicated dashboard invoice API gate is disabled', async () => {
  const response = await handleDashboardInvoiceAccess(request({ reference, action: 'metadata' }), {
    apiEnabled: 'false',
    serviceToken: token,
  });
  assert.equal(response.status, 503);
  assert.equal((await response.json()).error.code, 'DASHBOARD_INVOICE_API_DISABLED');
});

test('fails closed when the server-side service token is not configured', async () => {
  const response = await handleDashboardInvoiceAccess(request({ reference, action: 'metadata' }), {
    apiEnabled: 'true',
    serviceToken: '',
  });
  assert.equal(response.status, 503);
  assert.equal((await response.json()).error.code, 'DASHBOARD_INVOICE_API_NOT_CONFIGURED');
});

test('requires the exact bearer token and does not disclose invoice data or create audit events on failure', async () => {
  const deps = dependencies();
  const response = await handleDashboardInvoiceAccess(
    request({ reference, action: 'metadata' }, { authorization: 'Bearer wrong-token' }),
    enabledOptions(deps),
  );
  assert.equal(response.status, 401);
  const body = await response.json();
  assert.equal(body.error.code, 'DASHBOARD_INVOICE_UNAUTHORIZED');
  assert.equal(JSON.stringify(body).includes('LM-INV'), false);
  assert.equal(deps.calls.summary.length, 0);
  assert.equal(deps.calls.audit.length, 0);
});

test('rejects direct browser-origin requests even when a bearer token is present', async () => {
  const deps = dependencies();
  const response = await handleDashboardInvoiceAccess(
    request({ reference, action: 'metadata' }, { origin: 'https://chatgpt.com' }),
    enabledOptions(deps),
  );
  assert.equal(response.status, 403);
  assert.equal((await response.json()).error.code, 'BROWSER_ORIGIN_NOT_ALLOWED');
  assert.equal(deps.calls.summary.length, 0);
  assert.equal(deps.calls.audit.length, 0);
});

test('returns only safe read-only invoice metadata and never audits metadata reads or exposes Blob identity', async () => {
  const deps = dependencies();
  const response = await handleDashboardInvoiceAccess(
    request({ reference, action: 'metadata' }),
    enabledOptions(deps, { storageEnabled: 'false' }),
  );
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.deepEqual(body.invoice, {
    orderReference: reference,
    invoiceNumber: 'LM-INV-2026-000077',
    issuedAt: 1_800_000_100,
    currency: 'EUR',
    amountTotal: 12395,
    schemaVersion: 1,
    deliveryStatus: 'delivered',
    attachmentFilename: 'invoice-LM-INV-2026-000077.pdf',
    pdfAvailable: true,
  });
  const raw = JSON.stringify(body);
  assert.equal(raw.includes(hash), false);
  assert.equal(raw.includes(storageKey), false);
  assert.equal(raw.includes('netlify_blobs'), false);
  assert.equal(deps.calls.pdf.length, 0);
  assert.equal(deps.calls.audit.length, 0);
});

test('rejects any caller-supplied Blob key before loading invoice truth', async () => {
  const deps = dependencies();
  const response = await handleDashboardInvoiceAccess(
    request({ reference, action: 'metadata', storageKey }),
    enabledOptions(deps),
  );
  assert.equal(response.status, 400);
  assert.equal((await response.json()).error.code, 'INVALID_DASHBOARD_INVOICE_REQUEST');
  assert.equal(deps.calls.summary.length, 0);
  assert.equal(deps.calls.audit.length, 0);
});

test('keeps metadata available while PDF download remains feature-gated without creating audit rows', async () => {
  const deps = dependencies();
  const response = await handleDashboardInvoiceAccess(
    request({ reference, action: 'download' }),
    enabledOptions(deps, { storageEnabled: 'false' }),
  );
  assert.equal(response.status, 503);
  assert.equal((await response.json()).error.code, 'DASHBOARD_INVOICE_DOWNLOAD_DISABLED');
  assert.equal(deps.calls.pdf.length, 0);
  assert.equal(deps.calls.audit.length, 0);
});

test('downloads only the Neon-bound, storage-verified PDF and persists a minimal dashboard audit event', async () => {
  const deps = dependencies();
  const response = await handleDashboardInvoiceAccess(
    request({ reference, action: 'download' }),
    enabledOptions(deps, { storageEnabled: 'true' }),
  );
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('content-type'), 'application/pdf');
  assert.equal(response.headers.get('cache-control'), 'private, no-store');
  assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
  assert.equal(response.headers.get('referrer-policy'), 'no-referrer');
  assert.equal(
    response.headers.get('content-disposition'),
    'attachment; filename="invoice-LM-INV-2026-000077.pdf"',
  );
  assert.equal(Buffer.from(await response.arrayBuffer()).toString(), '%PDF-x');
  assert.deepEqual(deps.calls.pdf[0], {
    invoiceId: 77,
    orderReference: reference,
    snapshotSchemaVersion: 1,
    rendererVersion: 2,
    pdfSha256: hash,
    pdfByteLength: 7,
    attachmentFilename: 'invoice-LM-INV-2026-000077.pdf',
    storageBackend: 'netlify_blobs',
    storageKey,
  });
  assert.deepEqual(deps.calls.audit, [{
    channel: 'dashboard',
    orderReference: reference,
    invoiceId: 77,
    outcome: 'success',
    reasonCode: 'download_success',
  }]);
  const auditRaw = JSON.stringify(deps.calls.audit[0]);
  assert.equal(auditRaw.includes(hash), false);
  assert.equal(auditRaw.includes(storageKey), false);
  assert.equal(auditRaw.includes(token), false);
});

test('fails closed when no durable PDF storage binding exists and records only an unavailable audit class', async () => {
  const deps = dependencies({ artifactState: artifact({
    storageBackend: null,
    storageKey: null,
    storedAt: null,
    storageBound: false,
  }) });
  const response = await handleDashboardInvoiceAccess(
    request({ reference, action: 'download' }),
    enabledOptions(deps, { storageEnabled: 'true' }),
  );
  assert.equal(response.status, 404);
  assert.equal((await response.json()).error.code, 'DASHBOARD_INVOICE_NOT_AVAILABLE');
  assert.equal(deps.calls.pdf.length, 0);
  assert.deepEqual(deps.calls.audit, [{
    channel: 'dashboard',
    orderReference: reference,
    invoiceId: 77,
    outcome: 'unavailable',
    reasonCode: 'pdf_not_bound',
  }]);
});

test('maps storage integrity failures to a private service-unavailable response and safe audit reason', async () => {
  const deps = dependencies();
  deps.pdfStore.loadVerifiedArtifact = async () => {
    const error = new Error('hash mismatch');
    error.code = 'V3_INVOICE_STORAGE_INTEGRITY_MISMATCH';
    throw error;
  };
  const response = await handleDashboardInvoiceAccess(
    request({ reference, action: 'download' }),
    enabledOptions(deps, { storageEnabled: 'true' }),
  );
  assert.equal(response.status, 503);
  assert.equal((await response.json()).error.code, 'DASHBOARD_INVOICE_UNAVAILABLE');
  assert.deepEqual(deps.calls.audit, [{
    channel: 'dashboard',
    orderReference: reference,
    invoiceId: 77,
    outcome: 'unavailable',
    reasonCode: 'storage_unavailable',
  }]);
});

test('durable dashboard audit failure blocks otherwise successful PDF delivery', async () => {
  const auditError = new Error('audit unavailable');
  auditError.code = 'V3_INVOICE_AUDIT_WRITE_FAILED';
  const deps = dependencies({ auditError });
  const response = await handleDashboardInvoiceAccess(
    request({ reference, action: 'download' }),
    enabledOptions(deps, { storageEnabled: 'true' }),
  );
  assert.equal(response.status, 503);
  assert.equal((await response.json()).error.code, 'DASHBOARD_INVOICE_AUDIT_UNAVAILABLE');
  assert.equal(deps.calls.pdf.length, 1);
  assert.equal(deps.calls.audit.length, 1);
});
