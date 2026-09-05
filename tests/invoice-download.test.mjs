import assert from 'node:assert/strict';
import test from 'node:test';

import { handleInvoiceDownload } from '../server/api/invoice-download.mjs';

const reference = 'e'.repeat(64);
const sessionId = 'PAYPALORDER123';
const pdfBytes = Buffer.from('%PDF-1.4\nsecure-download-proof\n', 'utf8');
const storageKey = `v1/invoices/77/${'a'.repeat(64)}.pdf`;

function request(payload, options = {}) {
  return new Request('https://legendmural.com/api/invoice-download', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...(options.origin ? { origin: options.origin } : {}),
    },
    body: JSON.stringify(payload),
  });
}

function harness({ orderOverrides = {}, storageBound = true } = {}) {
  const calls = [];
  const orderStore = {
    async getOrderByReference(value) {
      calls.push(['order', value]);
      return {
        reference,
        paymentSessionId: sessionId,
        status: 'paid',
        mode: 'live',
        documentProfileVersion: 1,
        ...orderOverrides,
      };
    },
  };
  const identitySource = {
    async loadInvoiceIdentityForDownload(args) {
      calls.push(['identity', args]);
      return { orderReference: reference, invoiceId: 77, documentProfileVersion: 1 };
    },
  };
  const artifactStore = {
    async loadArtifactState(args) {
      calls.push(['artifact', args]);
      return {
        invoiceId: 77,
        orderReference: reference,
        snapshotSchemaVersion: 1,
        rendererVersion: 1,
        pdfSha256: 'a'.repeat(64),
        pdfByteLength: pdfBytes.byteLength,
        attachmentFilename: 'invoice-LM-77.pdf',
        storageBackend: storageBound ? 'netlify_blobs' : null,
        storageKey: storageBound ? storageKey : null,
        storageBound,
      };
    },
  };
  const pdfStore = {
    async loadVerifiedArtifact(args) {
      calls.push(['pdf', args]);
      return { bytes: pdfBytes };
    },
  };
  return { calls, orderStore, identitySource, artifactStore, pdfStore };
}

function options(h) {
  return {
    ...h,
    storageEnabled: 'true',
    allowedOrigins: 'https://legendmural.com',
  };
}

test('returns only the SHA-verified persisted PDF after order and payment-session authorization', async () => {
  const h = harness();
  const response = await handleInvoiceDownload(
    request({ reference, sessionId }),
    options(h),
  );

  assert.equal(response.status, 200);
  assert.equal(response.headers.get('content-type'), 'application/pdf');
  assert.equal(response.headers.get('cache-control'), 'private, no-store');
  assert.equal(response.headers.get('content-disposition'), 'attachment; filename="invoice-LM-77.pdf"');
  assert.deepEqual(Buffer.from(await response.arrayBuffer()), pdfBytes);
  assert.deepEqual(h.calls.map(([name]) => name), ['order', 'identity', 'artifact', 'pdf']);
  assert.equal(h.calls.find(([name]) => name === 'pdf')[1].storageKey, storageKey);
});

test('wrong payment session is indistinguishable from unavailable invoice and never reaches storage', async () => {
  const h = harness();
  const response = await handleInvoiceDownload(
    request({ reference, sessionId: 'WRONGPAYPAL123' }),
    options(h),
  );

  assert.equal(response.status, 404);
  assert.deepEqual(await response.json(), {
    error: {
      code: 'INVOICE_NOT_AVAILABLE',
      message: 'Invoice PDF is not available.',
    },
  });
  assert.deepEqual(h.calls.map(([name]) => name), ['order']);
});

test('browser-supplied storage keys are ignored; only the durable server-side binding is used', async () => {
  const h = harness();
  const response = await handleInvoiceDownload(
    request({
      reference,
      sessionId,
      storageKey: 'v1/invoices/999/attacker-controlled.pdf',
      pdfSha256: 'b'.repeat(64),
    }),
    options(h),
  );

  assert.equal(response.status, 200);
  const load = h.calls.find(([name]) => name === 'pdf')[1];
  assert.equal(load.storageKey, storageKey);
  assert.equal(load.pdfSha256, 'a'.repeat(64));
});

test('disabled storage fails before any order, Neon artifact or Blob dependency is used', async () => {
  const h = harness();
  const response = await handleInvoiceDownload(
    request({ reference, sessionId }),
    { ...options(h), storageEnabled: 'false' },
  );
  assert.equal(response.status, 503);
  assert.equal(h.calls.length, 0);
});

test('a paid order without a durable storage binding is not downloadable', async () => {
  const h = harness({ storageBound: false });
  const response = await handleInvoiceDownload(
    request({ reference, sessionId }),
    options(h),
  );
  assert.equal(response.status, 404);
  assert.deepEqual(h.calls.map(([name]) => name), ['order', 'identity', 'artifact']);
});

test('cross-origin download is denied before authorization dependencies run', async () => {
  const h = harness();
  const response = await handleInvoiceDownload(
    request({ reference, sessionId }, { origin: 'https://attacker.example' }),
    options(h),
  );
  assert.equal(response.status, 403);
  assert.equal(h.calls.length, 0);
});
