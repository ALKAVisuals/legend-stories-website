import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import test from 'node:test';

import {
  createNetlifyV3InvoicePdfStore,
  NetlifyV3InvoicePdfStoreError,
  V3_INVOICE_PDF_PRODUCTION_STORE,
  V3_INVOICE_PDF_STORAGE_BACKEND,
  v3InvoicePdfStorageKey,
} from '../server/adapters/netlify-v3-invoice-pdf-store.mjs';

const reference = 'a'.repeat(64);
const bytes = Buffer.from('%PDF-1.4\nLegendMural storage proof\n', 'utf8');
const digest = createHash('sha256').update(bytes).digest('hex');

function identity(overrides = {}) {
  return {
    invoiceId: 77,
    orderReference: reference,
    snapshotSchemaVersion: 1,
    rendererVersion: 1,
    pdfSha256: digest,
    pdfByteLength: bytes.byteLength,
    attachmentFilename: 'invoice-LM-77.pdf',
    ...overrides,
  };
}

function productionEnv(overrides = {}) {
  return {
    CONTEXT: 'production',
    V3_INVOICE_STORAGE_ENABLED: 'true',
    ...overrides,
  };
}

function memoryBlobStore() {
  const objects = new Map();
  const calls = [];
  return {
    calls,
    set: async (key, value, options) => {
      calls.push(['set', key, options]);
      if (objects.has(key)) return { modified: false };
      objects.set(key, Buffer.from(value));
      return { modified: true };
    },
    get: async (key, options) => {
      calls.push(['get', key, options]);
      const value = objects.get(key);
      return value ? value.buffer.slice(value.byteOffset, value.byteOffset + value.byteLength) : null;
    },
  };
}

test('uses a deterministic SHA-bound private key and create-only writes', async () => {
  const blob = memoryBlobStore();
  const factoryCalls = [];
  const store = createNetlifyV3InvoicePdfStore({
    env: productionEnv(),
    getStoreFactory(options) {
      factoryCalls.push(options);
      return blob;
    },
  });

  const expectedKey = `v1/invoices/77/${digest}.pdf`;
  assert.equal(v3InvoicePdfStorageKey(identity()), expectedKey);

  const first = await store.persistVerifiedArtifact({ ...identity(), bytes });
  const second = await store.persistVerifiedArtifact({ ...identity(), bytes });

  assert.deepEqual(factoryCalls, [{
    name: V3_INVOICE_PDF_PRODUCTION_STORE,
    consistency: 'strong',
  }]);
  assert.equal(first.storageBackend, V3_INVOICE_PDF_STORAGE_BACKEND);
  assert.equal(first.storageKey, expectedKey);
  assert.equal(first.duplicate, false);
  assert.equal(second.duplicate, true);
  assert.deepEqual(first.bytes, bytes);
  assert.deepEqual(second.bytes, bytes);

  const writes = blob.calls.filter(([name]) => name === 'set');
  assert.equal(writes.length, 2);
  assert.equal(writes[0][1], expectedKey);
  assert.equal(writes[0][2].onlyIfNew, true);
  assert.equal(writes[0][2].metadata.pdfSha256, digest);
  assert.equal(writes[0][2].metadata.pdfByteLength, bytes.byteLength);
  assert.ok(blob.calls.some(([name, key, options]) => (
    name === 'get'
    && key === expectedKey
    && options.consistency === 'strong'
    && options.type === 'arrayBuffer'
  )));
});

test('loads only the exact durable storage binding and re-verifies bytes', async () => {
  const blob = memoryBlobStore();
  const store = createNetlifyV3InvoicePdfStore({
    env: productionEnv(),
    getStoreFactory: () => blob,
  });
  const stored = await store.persistVerifiedArtifact({ ...identity(), bytes });
  const loaded = await store.loadVerifiedArtifact({
    ...identity(),
    storageBackend: stored.storageBackend,
    storageKey: stored.storageKey,
  });
  assert.deepEqual(loaded.bytes, bytes);

  await assert.rejects(
    store.loadVerifiedArtifact({
      ...identity(),
      storageBackend: stored.storageBackend,
      storageKey: `v1/invoices/77/${'b'.repeat(64)}.pdf`,
    }),
    (error) => error instanceof NetlifyV3InvoicePdfStoreError
      && error.code === 'V3_INVOICE_STORAGE_BINDING_MISMATCH',
  );
});

test('fails closed before writing when rendered bytes do not match durable SHA identity', async () => {
  const blob = memoryBlobStore();
  const store = createNetlifyV3InvoicePdfStore({
    env: productionEnv(),
    getStoreFactory: () => blob,
  });

  await assert.rejects(
    store.persistVerifiedArtifact({ ...identity({ pdfSha256: 'b'.repeat(64) }), bytes }),
    (error) => error instanceof NetlifyV3InvoicePdfStoreError
      && error.code === 'V3_INVOICE_STORAGE_INTEGRITY_MISMATCH',
  );
  assert.equal(blob.calls.some(([name]) => name === 'set'), false);
});

test('Production Blob store cannot initialize while disabled or outside Production context', () => {
  assert.throws(
    () => createNetlifyV3InvoicePdfStore({ env: productionEnv({ V3_INVOICE_STORAGE_ENABLED: 'false' }) }),
    (error) => error.code === 'V3_INVOICE_STORAGE_DISABLED',
  );
  assert.throws(
    () => createNetlifyV3InvoicePdfStore({ env: productionEnv({ CONTEXT: 'deploy-preview' }) }),
    (error) => error.code === 'V3_INVOICE_STORAGE_CONTEXT_FORBIDDEN',
  );
});
