import { createHash } from 'node:crypto';

import { buildPdfKitProbeSnapshot } from './cloudflare-pdfkit-probe-worker.mjs';
import {
  renderV3InvoicePdf,
  V3_INVOICE_PDF_RENDERER_VERSION,
} from '../../server/invoices/v3-invoice-pdf.mjs';

const RUN_ID_PATTERN = /^\d{1,20}-\d{1,4}$/;
const PROOF_PREFIX = 'proofs/cloudflare-preview-pdf-r2';

function sha256(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

function json(status, payload) {
  return Response.json(payload, {
    status,
    headers: {
      'cache-control': 'no-store',
    },
  });
}

function proofRunId(env) {
  const value = String(env?.LEGENDMURAL_PROOF_RUN_ID || '').trim();
  if (!RUN_ID_PATTERN.test(value)) {
    throw new Error('LEGENDMURAL_PROOF_RUN_ID is missing or invalid.');
  }
  return value;
}

function assertPreviewBucket(bucket) {
  if (typeof bucket?.put !== 'function' || typeof bucket?.get !== 'function') {
    throw new Error('Preview R2 binding V3_INVOICE_PDFS is unavailable.');
  }
  return bucket;
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname !== '/probe' || request.method !== 'POST') {
      return json(404, { error: 'not_found' });
    }

    try {
      const runId = proofRunId(env);
      const bucket = assertPreviewBucket(env?.V3_INVOICE_PDFS);
      const snapshot = buildPdfKitProbeSnapshot();
      const first = await renderV3InvoicePdf({ snapshot });
      const second = await renderV3InvoicePdf({ snapshot: buildPdfKitProbeSnapshot() });

      const deterministic = first.sha256 === second.sha256
        && first.byteLength === second.byteLength
        && Buffer.compare(first.bytes, second.bytes) === 0;
      if (!deterministic) {
        throw new Error('Worker PDF rendering is not deterministic.');
      }

      const storageKey = `${PROOF_PREFIX}/${runId}/${first.sha256}.pdf`;
      const putOptions = {
        onlyIf: { etagDoesNotMatch: '*' },
        sha256: first.sha256,
        httpMetadata: {
          contentType: 'application/pdf',
          cacheControl: 'private, no-store',
        },
        customMetadata: {
          purpose: 'cloudflare-preview-pdf-r2-proof',
          runId,
          rendererVersion: String(first.rendererVersion),
          pdfSha256: first.sha256,
          pdfByteLength: String(first.byteLength),
        },
      };

      const firstWrite = await bucket.put(storageKey, first.bytes, putOptions);
      const secondWrite = await bucket.put(storageKey, first.bytes, putOptions);
      const stored = await bucket.get(storageKey);
      if (!stored || typeof stored.arrayBuffer !== 'function') {
        throw new Error('Preview R2 proof object could not be read back.');
      }

      const storedBytes = Buffer.from(await stored.arrayBuffer());
      const readSha256 = sha256(storedBytes);
      const readByteLength = storedBytes.byteLength;
      const bytesEqual = Buffer.compare(first.bytes, storedBytes) === 0;

      if (readSha256 !== first.sha256 || readByteLength !== first.byteLength || !bytesEqual) {
        throw new Error('Preview R2 read-back integrity verification failed.');
      }

      return json(200, {
        context: 'preview-pdf-r2-proof',
        runId,
        rendererVersion: first.rendererVersion,
        expectedRendererVersion: V3_INVOICE_PDF_RENDERER_VERSION,
        filename: first.filename,
        pdfHeader: Buffer.from(first.bytes).subarray(0, 8).toString('ascii'),
        pdfSha256: first.sha256,
        pdfByteLength: first.byteLength,
        deterministic,
        storageKey,
        firstDuplicate: firstWrite === null,
        secondDuplicate: secondWrite === null,
        readSha256,
        readByteLength,
        bytesEqual,
      });
    } catch (error) {
      return json(500, {
        error: {
          name: String(error?.name || 'Error').slice(0, 120),
          message: String(error?.message || 'Remote PDF/R2 proof failed.').slice(0, 500),
        },
      });
    }
  },
};
