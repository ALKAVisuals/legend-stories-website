import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import test from 'node:test';

import {
  createCloudflareR2V3InvoicePdfStore,
} from '../server/adapters/cloudflare-r2-v3-invoice-pdf-store.mjs';
import {
  createNeonV3InvoiceArtifactStore,
} from '../server/adapters/neon-v3-invoice-artifact-store.mjs';

const connectionString = 'postgresql://runtime:secret@ep-test.neon.tech/legend?sslmode=require';

function createFakeR2Bucket() {
  const objects = new Map();
  return {
    async put(key, value, options = {}) {
      if (options?.onlyIf?.etagDoesNotMatch === '*' && objects.has(key)) return null;
      const bytes = Buffer.from(value);
      objects.set(key, Buffer.from(bytes));
      return { key, etag: 'fake-etag' };
    },
    async get(key) {
      if (!objects.has(key)) return null;
      const stored = Buffer.from(objects.get(key));
      return {
        async arrayBuffer() {
          return stored.buffer.slice(stored.byteOffset, stored.byteOffset + stored.byteLength);
        },
      };
    },
  };
}

function createNeonClientFactory(seen) {
  return async () => ({
    async connect() {},
    async end() {},
    async query(sql, values) {
      seen.push({ sql, values });
      if (sql.includes('UPDATE legend_commerce.order_notifications')) {
        return {
          rows: [{
            order_reference: values[0],
            notification_type: 'customer_v3_invoice',
            delivery_status: 'sending',
            invoice_id: values[1],
            snapshot_schema_version: 1,
            renderer_version: values[3],
            pdf_sha256: values[4],
            pdf_byte_length: values[5],
            attachment_filename: values[6],
            pdf_storage_backend: values[7],
            pdf_storage_key: values[8],
            pdf_stored_at: values[9],
            claim_token: values[2],
            claimed_at: values[9] - 10,
            lease_expires_at: values[9] + 100,
            updated_at: values[9],
          }],
        };
      }
      return { rows: [] };
    },
  });
}

test('Cloudflare R2 artifact binding is accepted and persisted by the Neon V3 artifact store', async () => {
  const bytes = Buffer.from('%PDF-1.7\nCloudflare R2 to Neon contract\n%%EOF\n');
  const pdfSha256 = createHash('sha256').update(bytes).digest('hex');
  const orderReference = 'b'.repeat(64);
  const invoiceId = 77;
  const bucket = createFakeR2Bucket();

  const pdfStore = createCloudflareR2V3InvoicePdfStore({
    env: {
      LEGENDMURAL_DEPLOY_CONTEXT: 'production',
      V3_INVOICE_STORAGE_ENABLED: 'true',
      V3_INVOICE_PDFS: bucket,
    },
  });

  const persisted = await pdfStore.persistVerifiedArtifact({
    invoiceId,
    orderReference,
    snapshotSchemaVersion: 1,
    rendererVersion: 1,
    pdfSha256,
    pdfByteLength: bytes.byteLength,
    attachmentFilename: 'invoice-LS2026-0077.pdf',
    bytes,
  });

  assert.equal(persisted.storageBackend, 'cloudflare_r2');

  const seen = [];
  const artifactStore = createNeonV3InvoiceArtifactStore({
    connectionString,
    clientFactory: createNeonClientFactory(seen),
  });

  const bound = await artifactStore.bindStoredArtifact({
    orderReference,
    invoiceId,
    claimToken: 'claim-77',
    rendererVersion: 1,
    pdfSha256,
    pdfByteLength: bytes.byteLength,
    attachmentFilename: 'invoice-LS2026-0077.pdf',
    storageBackend: persisted.storageBackend,
    storageKey: persisted.storageKey,
    storedAt: 1_800_500_000,
  });

  assert.equal(bound.storageBound, true);
  assert.equal(bound.storageBackend, 'cloudflare_r2');
  assert.equal(bound.storageKey, persisted.storageKey);
  assert.equal(seen[0].values[7], 'cloudflare_r2');
});
