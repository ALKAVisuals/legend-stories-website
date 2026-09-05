import assert from 'node:assert/strict';
import test from 'node:test';

import {
  createNeonV3InvoiceArtifactStore,
  NeonV3InvoiceArtifactStoreError,
} from '../server/adapters/neon-v3-invoice-artifact-store.mjs';

const connectionString = 'postgresql://runtime:secret@ep-test.neon.tech/legend?sslmode=require';
const reference = 'f'.repeat(64);
const hash = 'a'.repeat(64);
const storageKey = `v1/invoices/77/${hash}.pdf`;

function row(overrides = {}) {
  return {
    order_reference: reference,
    notification_type: 'customer_v3_invoice',
    delivery_status: 'sending',
    invoice_id: 77,
    snapshot_schema_version: 1,
    renderer_version: 1,
    pdf_sha256: hash,
    pdf_byte_length: 1234,
    attachment_filename: 'invoice-LM-77.pdf',
    pdf_storage_backend: 'netlify_blobs',
    pdf_storage_key: storageKey,
    pdf_stored_at: 1_800_000_100,
    claim_token: 'claim-77',
    claimed_at: 1_800_000_000,
    lease_expires_at: 1_800_000_300,
    updated_at: 1_800_000_100,
    ...overrides,
  };
}

function clientFactory(handler) {
  return async () => ({
    async connect() {},
    async query(sql, values) { return handler(sql, values); },
    async end() {},
  });
}

test('loads a complete immutable artifact plus deterministic private storage binding', async () => {
  const queries = [];
  const store = createNeonV3InvoiceArtifactStore({
    connectionString,
    clientFactory: clientFactory((sql, values) => {
      queries.push({ sql, values });
      return { rows: [row()] };
    }),
  });

  const state = await store.loadArtifactState({ orderReference: reference, invoiceId: 77 });
  assert.equal(state.storageBound, true);
  assert.equal(state.storageBackend, 'netlify_blobs');
  assert.equal(state.storageKey, storageKey);
  assert.equal(state.pdfSha256, hash);
  assert.deepEqual(queries[0].values, [reference]);
});

test('bind is claim-owned and writes only the exact immutable artifact/storage identity', async () => {
  const queries = [];
  const store = createNeonV3InvoiceArtifactStore({
    connectionString,
    clientFactory: clientFactory((sql, values) => {
      queries.push({ sql, values });
      return { rows: [row()] };
    }),
  });

  const state = await store.bindStoredArtifact({
    orderReference: reference,
    invoiceId: 77,
    claimToken: 'claim-77',
    rendererVersion: 1,
    pdfSha256: hash,
    pdfByteLength: 1234,
    attachmentFilename: 'invoice-LM-77.pdf',
    storageBackend: 'netlify_blobs',
    storageKey,
    storedAt: 1_800_000_100,
  });

  assert.equal(state.storageBound, true);
  assert.ok(queries[0].sql.includes("delivery_status = 'sending'"));
  assert.ok(queries[0].sql.includes('claim_token = $3'));
  assert.deepEqual(queries[0].values, [
    reference,
    77,
    'claim-77',
    1,
    hash,
    1234,
    'invoice-LM-77.pdf',
    'netlify_blobs',
    storageKey,
    1_800_000_100,
  ]);
});

test('rejects a partial persisted storage binding instead of guessing missing identity', async () => {
  const store = createNeonV3InvoiceArtifactStore({
    connectionString,
    clientFactory: clientFactory(() => ({
      rows: [row({ pdf_storage_key: null })],
    })),
  });

  await assert.rejects(
    store.loadArtifactState({ orderReference: reference, invoiceId: 77 }),
    (error) => error instanceof NeonV3InvoiceArtifactStoreError
      && error.code === 'V3_INVOICE_STORAGE_BINDING_MISMATCH',
  );
});

test('rejects any non-deterministic storage key before touching Neon', async () => {
  let queried = false;
  const store = createNeonV3InvoiceArtifactStore({
    connectionString,
    clientFactory: clientFactory(() => {
      queried = true;
      return { rows: [] };
    }),
  });

  await assert.rejects(
    store.bindStoredArtifact({
      orderReference: reference,
      invoiceId: 77,
      claimToken: 'claim-77',
      rendererVersion: 1,
      pdfSha256: hash,
      pdfByteLength: 1234,
      attachmentFilename: 'invoice-LM-77.pdf',
      storageBackend: 'netlify_blobs',
      storageKey: `v1/invoices/78/${hash}.pdf`,
      storedAt: 1_800_000_100,
    }),
    (error) => error.code === 'INVALID_V3_INVOICE_ARTIFACT_REQUEST',
  );
  assert.equal(queried, false);
});
