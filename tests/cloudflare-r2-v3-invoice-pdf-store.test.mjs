import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import test from 'node:test';

import {
  CloudflareR2V3InvoicePdfStoreError,
  V3_INVOICE_PDF_R2_BINDING,
  V3_INVOICE_PDF_R2_STORAGE_BACKEND,
  createCloudflareR2V3InvoicePdfStore,
  v3InvoicePdfR2StorageKey,
} from '../server/adapters/cloudflare-r2-v3-invoice-pdf-store.mjs';

function sha256(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

function artifact(bytes = Buffer.from('%PDF-1.7\nLegendMural test invoice\n%%EOF\n')) {
  const pdfSha256 = sha256(bytes);
  return Object.freeze({
    invoiceId: 42,
    orderReference: 'a'.repeat(64),
    snapshotSchemaVersion: 1,
    rendererVersion: 2,
    pdfSha256,
    pdfByteLength: bytes.byteLength,
    attachmentFilename: 'LM-INV-2026-000042.pdf',
    bytes,
  });
}

function cloneArrayBuffer(value) {
  if (value instanceof ArrayBuffer) return value.slice(0);
  if (ArrayBuffer.isView(value)) {
    return value.buffer.slice(value.byteOffset, value.byteOffset + value.byteLength);
  }
  return Buffer.from(value).buffer.slice(0);
}

function createFakeR2Bucket() {
  const objects = new Map();
  const puts = [];

  return Object.freeze({
    objects,
    puts,
    async put(key, value, options = {}) {
      puts.push({ key, options });
      if (options?.onlyIf?.etagDoesNotMatch === '*' && objects.has(key)) return null;
      const bytes = Buffer.from(cloneArrayBuffer(value));
      objects.set(key, Buffer.from(bytes));
      return Object.freeze({ key, etag: 'fake-etag' });
    },
    async get(key) {
      if (!objects.has(key)) return null;
      const stored = Buffer.from(objects.get(key));
      return Object.freeze({
        async arrayBuffer() {
          return stored.buffer.slice(stored.byteOffset, stored.byteOffset + stored.byteLength);
        },
      });
    },
  });
}

function productionEnv(bucket, overrides = {}) {
  return {
    LEGENDMURAL_DEPLOY_CONTEXT: 'production',
    V3_INVOICE_STORAGE_ENABLED: 'true',
    [V3_INVOICE_PDF_R2_BINDING]: bucket,
    ...overrides,
  };
}

function errorCode(error) {
  assert.ok(error instanceof CloudflareR2V3InvoicePdfStoreError);
  return error.code;
}

test('R2 invoice store is disabled unless storage is explicitly enabled', () => {
  const bucket = createFakeR2Bucket();
  assert.throws(
    () => createCloudflareR2V3InvoicePdfStore({
      env: productionEnv(bucket, { V3_INVOICE_STORAGE_ENABLED: 'false' }),
    }),
    (error) => errorCode(error) === 'V3_INVOICE_STORAGE_DISABLED',
  );
});

test('R2 invoice store forbids preview context even when storage flag is true', () => {
  const bucket = createFakeR2Bucket();
  assert.throws(
    () => createCloudflareR2V3InvoicePdfStore({
      env: productionEnv(bucket, { LEGENDMURAL_DEPLOY_CONTEXT: 'preview' }),
    }),
    (error) => errorCode(error) === 'V3_INVOICE_STORAGE_CONTEXT_FORBIDDEN',
  );
});

test('R2 invoice store requires the private bucket binding', () => {
  assert.throws(
    () => createCloudflareR2V3InvoicePdfStore({
      env: productionEnv(undefined),
    }),
    (error) => errorCode(error) === 'V3_INVOICE_STORAGE_CONFIGURATION',
  );
});

test('R2 invoice store performs create-only write, strong read and integrity verification', async () => {
  const bucket = createFakeR2Bucket();
  const input = artifact();
  const store = createCloudflareR2V3InvoicePdfStore({ env: productionEnv(bucket) });

  const result = await store.persistVerifiedArtifact(input);
  const expectedKey = v3InvoicePdfR2StorageKey(input);

  assert.equal(result.storageBackend, 'cloudflare_r2');
  assert.equal(result.storageBackend, V3_INVOICE_PDF_R2_STORAGE_BACKEND);
  assert.equal(result.storageKey, expectedKey);
  assert.equal(result.duplicate, false);
  assert.deepEqual(result.bytes, input.bytes);
  assert.equal(bucket.puts.length, 1);
  assert.equal(bucket.puts[0].key, expectedKey);
  assert.equal(bucket.puts[0].options.onlyIf.etagDoesNotMatch, '*');
  assert.equal(bucket.puts[0].options.sha256, input.pdfSha256);
  assert.equal(bucket.puts[0].options.httpMetadata.contentType, 'application/pdf');
  assert.equal(bucket.puts[0].options.httpMetadata.cacheControl, 'private, no-store');
  assert.equal(bucket.puts[0].options.customMetadata.pdfSha256, input.pdfSha256);
});

test('R2 invoice store treats an identical pre-existing object as an idempotent duplicate', async () => {
  const bucket = createFakeR2Bucket();
  const input = artifact();
  const store = createCloudflareR2V3InvoicePdfStore({ env: productionEnv(bucket) });

  const first = await store.persistVerifiedArtifact(input);
  const second = await store.persistVerifiedArtifact(input);

  assert.equal(first.duplicate, false);
  assert.equal(second.duplicate, true);
  assert.deepEqual(second.bytes, input.bytes);
  assert.equal(bucket.puts.length, 2);
});

test('R2 invoice store never overwrites a conflicting pre-existing object', async () => {
  const bucket = createFakeR2Bucket();
  const input = artifact();
  const key = v3InvoicePdfR2StorageKey(input);
  bucket.objects.set(key, Buffer.from('conflicting bytes'));
  const store = createCloudflareR2V3InvoicePdfStore({ env: productionEnv(bucket) });

  await assert.rejects(
    () => store.persistVerifiedArtifact(input),
    (error) => errorCode(error) === 'V3_INVOICE_STORAGE_INTEGRITY_MISMATCH',
  );
  assert.deepEqual(bucket.objects.get(key), Buffer.from('conflicting bytes'));
});

test('R2 invoice store validates durable backend/key binding before read', async () => {
  const bucket = createFakeR2Bucket();
  const input = artifact();
  const store = createCloudflareR2V3InvoicePdfStore({ env: productionEnv(bucket) });
  const persisted = await store.persistVerifiedArtifact(input);

  await assert.rejects(
    () => store.loadVerifiedArtifact({
      ...input,
      storageBackend: 'netlify_blobs',
      storageKey: persisted.storageKey,
    }),
    (error) => errorCode(error) === 'V3_INVOICE_STORAGE_BINDING_MISMATCH',
  );
});

test('R2 invoice store rejects source bytes that do not match immutable artifact identity', async () => {
  const bucket = createFakeR2Bucket();
  const correct = artifact();
  const store = createCloudflareR2V3InvoicePdfStore({ env: productionEnv(bucket) });

  await assert.rejects(
    () => store.persistVerifiedArtifact({
      ...correct,
      bytes: Buffer.from('different PDF bytes'),
    }),
    (error) => errorCode(error) === 'V3_INVOICE_STORAGE_INTEGRITY_MISMATCH',
  );
  assert.equal(bucket.puts.length, 0);
});
