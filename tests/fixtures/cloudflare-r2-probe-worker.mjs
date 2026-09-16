import { createHash } from 'node:crypto';

import {
  createCloudflareR2V3InvoicePdfStore,
} from '../../server/adapters/cloudflare-r2-v3-invoice-pdf-store.mjs';

function sha256(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

function json(status, payload) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
    },
  });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname !== '/probe' || request.method !== 'POST') {
      return json(404, { error: 'not_found' });
    }

    const bytes = Buffer.from('%PDF-1.7\nLegendMural workerd R2 probe\n%%EOF\n');
    const input = Object.freeze({
      invoiceId: 900001,
      orderReference: 'b'.repeat(64),
      snapshotSchemaVersion: 1,
      rendererVersion: 2,
      pdfSha256: sha256(bytes),
      pdfByteLength: bytes.byteLength,
      attachmentFilename: 'LM-INV-2026-900001.pdf',
      bytes,
    });

    try {
      const store = createCloudflareR2V3InvoicePdfStore({ env });
      const first = await store.persistVerifiedArtifact(input);
      const second = await store.persistVerifiedArtifact(input);
      const loaded = await store.loadVerifiedArtifact({
        ...input,
        storageBackend: second.storageBackend,
        storageKey: second.storageKey,
      });

      return json(200, {
        storageBackend: first.storageBackend,
        storageKey: first.storageKey,
        firstDuplicate: first.duplicate,
        secondDuplicate: second.duplicate,
        loadedDuplicate: loaded.duplicate,
        firstByteLength: first.bytes.byteLength,
        secondByteLength: second.bytes.byteLength,
        loadedByteLength: loaded.bytes.byteLength,
        expectedByteLength: input.pdfByteLength,
        bytesEqual: Buffer.compare(first.bytes, loaded.bytes) === 0,
      });
    } catch (error) {
      return json(500, {
        error: {
          name: String(error?.name || 'Error'),
          code: String(error?.code || 'UNKNOWN'),
          message: String(error?.message || 'Probe failed.'),
        },
      });
    }
  },
};
