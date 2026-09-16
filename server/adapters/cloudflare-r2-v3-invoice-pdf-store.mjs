import { createHash } from 'node:crypto';

const SHA256_PATTERN = /^[a-f0-9]{64}$/;
const REFERENCE_PATTERN = /^[a-f0-9]{64}$/;
const STORAGE_BACKEND = 'cloudflare_r2';
const R2_BINDING = 'V3_INVOICE_PDFS';
const PRODUCTION_CONTEXT = 'production';

export class CloudflareR2V3InvoicePdfStoreError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = 'CloudflareR2V3InvoicePdfStoreError';
    this.code = code;
    this.details = details;
  }
}

function fail(code, message, details = {}) {
  throw new CloudflareR2V3InvoicePdfStoreError(code, message, details);
}

function enabled(value) {
  return String(value || '').trim().toLowerCase() === 'true';
}

function positiveInteger(value, field) {
  const normalized = Number(value);
  if (!Number.isSafeInteger(normalized) || normalized <= 0) {
    fail('V3_INVOICE_STORAGE_IDENTITY_INVALID', `${field} is invalid.`, { field });
  }
  return normalized;
}

function exactText(value, field, maxLength) {
  const normalized = String(value ?? '');
  if (!normalized
    || normalized !== normalized.trim()
    || normalized.length > maxLength
    || /[\u0000-\u001f\u007f]/.test(normalized)) {
    fail('V3_INVOICE_STORAGE_IDENTITY_INVALID', `${field} is invalid.`, { field });
  }
  return normalized;
}

function normalizeReference(value) {
  const reference = String(value || '').trim().toLowerCase();
  if (!REFERENCE_PATTERN.test(reference)) {
    fail('V3_INVOICE_STORAGE_IDENTITY_INVALID', 'orderReference is invalid.', {
      field: 'orderReference',
    });
  }
  return reference;
}

function normalizeSha(value) {
  const sha256 = String(value || '').trim().toLowerCase();
  if (!SHA256_PATTERN.test(sha256)) {
    fail('V3_INVOICE_STORAGE_IDENTITY_INVALID', 'pdfSha256 is invalid.', {
      field: 'pdfSha256',
    });
  }
  return sha256;
}

function normalizeFilename(value) {
  const filename = exactText(value, 'attachmentFilename', 200);
  if (filename.includes('/') || filename.includes('\\') || !filename.toLowerCase().endsWith('.pdf')) {
    fail('V3_INVOICE_STORAGE_IDENTITY_INVALID', 'attachmentFilename is invalid.', {
      field: 'attachmentFilename',
    });
  }
  return filename;
}

function asBuffer(value, field = 'bytes') {
  if (Buffer.isBuffer(value)) return Buffer.from(value);
  if (value instanceof ArrayBuffer) return Buffer.from(value);
  if (ArrayBuffer.isView(value)) {
    return Buffer.from(value.buffer, value.byteOffset, value.byteLength);
  }
  fail('V3_INVOICE_STORAGE_IDENTITY_INVALID', `${field} must be binary data.`, { field });
}

function toArrayBuffer(bytes) {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
}

function sha256(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

export function v3InvoicePdfR2StorageKey({ invoiceId, pdfSha256 } = {}) {
  const id = positiveInteger(invoiceId, 'invoiceId');
  const hash = normalizeSha(pdfSha256);
  return `v1/invoices/${id}/${hash}.pdf`;
}

function normalizeIdentity(input = {}) {
  const invoiceId = positiveInteger(input.invoiceId, 'invoiceId');
  const orderReference = normalizeReference(input.orderReference);
  const snapshotSchemaVersion = positiveInteger(input.snapshotSchemaVersion, 'snapshotSchemaVersion');
  const rendererVersion = positiveInteger(input.rendererVersion, 'rendererVersion');
  const pdfSha256 = normalizeSha(input.pdfSha256);
  const pdfByteLength = positiveInteger(input.pdfByteLength, 'pdfByteLength');
  const attachmentFilename = normalizeFilename(input.attachmentFilename);
  return Object.freeze({
    invoiceId,
    orderReference,
    snapshotSchemaVersion,
    rendererVersion,
    pdfSha256,
    pdfByteLength,
    attachmentFilename,
    storageKey: v3InvoicePdfR2StorageKey({ invoiceId, pdfSha256 }),
  });
}

function verifyBytes(bytesInput, identity) {
  const bytes = asBuffer(bytesInput);
  const actualSha256 = sha256(bytes);
  if (bytes.byteLength !== identity.pdfByteLength || actualSha256 !== identity.pdfSha256) {
    fail(
      'V3_INVOICE_STORAGE_INTEGRITY_MISMATCH',
      'Stored V3 invoice PDF bytes do not match the durable artifact identity.',
      {
        expectedSha256: identity.pdfSha256,
        actualSha256,
        expectedByteLength: identity.pdfByteLength,
        actualByteLength: bytes.byteLength,
      },
    );
  }
  return bytes;
}

function assertProductionBoundary(env) {
  if (!enabled(env?.V3_INVOICE_STORAGE_ENABLED)) {
    fail('V3_INVOICE_STORAGE_DISABLED', 'V3 invoice storage is disabled.');
  }
  if (String(env?.LEGENDMURAL_DEPLOY_CONTEXT || '').trim().toLowerCase() !== PRODUCTION_CONTEXT) {
    fail(
      'V3_INVOICE_STORAGE_CONTEXT_FORBIDDEN',
      'The Production V3 invoice R2 bucket is forbidden outside the Production Cloudflare context.',
    );
  }
}

function assertBucket(bucket) {
  if (typeof bucket?.put !== 'function' || typeof bucket?.get !== 'function') {
    fail('V3_INVOICE_STORAGE_CONFIGURATION', 'Cloudflare R2 bucket binding is unavailable.');
  }
  return bucket;
}

function wrapBucketFailure(stage, error) {
  if (error instanceof CloudflareR2V3InvoicePdfStoreError) throw error;
  fail('V3_INVOICE_STORAGE_UNAVAILABLE', 'Private V3 invoice storage is temporarily unavailable.', {
    stage,
    name: String(error?.name || 'Error').slice(0, 120),
  });
}

export function createCloudflareR2V3InvoicePdfStore({ env = process.env } = {}) {
  assertProductionBoundary(env);
  const bucket = assertBucket(env?.[R2_BINDING]);

  async function readVerified(identity) {
    let object;
    try {
      object = await bucket.get(identity.storageKey);
    } catch (error) {
      wrapBucketFailure('strong_read', error);
    }
    if (!object || typeof object.arrayBuffer !== 'function') {
      fail('V3_INVOICE_STORAGE_MISSING', 'The bound V3 invoice PDF object is missing.', {
        storageKey: identity.storageKey,
      });
    }

    let stored;
    try {
      stored = await object.arrayBuffer();
    } catch (error) {
      wrapBucketFailure('read_body', error);
    }
    return verifyBytes(stored, identity);
  }

  return Object.freeze({
    async persistVerifiedArtifact(input = {}) {
      const identity = normalizeIdentity(input);
      const sourceBytes = verifyBytes(input.bytes, identity);
      let write;
      try {
        write = await bucket.put(identity.storageKey, toArrayBuffer(sourceBytes), {
          onlyIf: { etagDoesNotMatch: '*' },
          sha256: identity.pdfSha256,
          httpMetadata: {
            contentType: 'application/pdf',
            cacheControl: 'private, no-store',
          },
          customMetadata: {
            invoiceId: String(identity.invoiceId),
            orderReference: identity.orderReference,
            snapshotSchemaVersion: String(identity.snapshotSchemaVersion),
            rendererVersion: String(identity.rendererVersion),
            pdfSha256: identity.pdfSha256,
            pdfByteLength: String(identity.pdfByteLength),
            attachmentFilename: identity.attachmentFilename,
          },
        });
      } catch (error) {
        wrapBucketFailure('create_only_write', error);
      }

      const bytes = await readVerified(identity);
      return Object.freeze({
        storageBackend: STORAGE_BACKEND,
        storageKey: identity.storageKey,
        duplicate: write === null,
        bytes,
      });
    },

    async loadVerifiedArtifact(input = {}) {
      const identity = normalizeIdentity(input);
      const storageBackend = exactText(input.storageBackend, 'storageBackend', 40);
      const storageKey = exactText(input.storageKey, 'storageKey', 240);
      if (storageBackend !== STORAGE_BACKEND || storageKey !== identity.storageKey) {
        fail(
          'V3_INVOICE_STORAGE_BINDING_MISMATCH',
          'Durable V3 invoice storage binding does not match the artifact identity.',
        );
      }
      const bytes = await readVerified(identity);
      return Object.freeze({
        storageBackend,
        storageKey,
        duplicate: true,
        bytes,
      });
    },
  });
}

export {
  R2_BINDING as V3_INVOICE_PDF_R2_BINDING,
  STORAGE_BACKEND as V3_INVOICE_PDF_R2_STORAGE_BACKEND,
};
