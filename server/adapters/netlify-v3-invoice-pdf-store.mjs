import { createHash } from 'node:crypto';

import { getStore } from '@netlify/blobs';

const SHA256_PATTERN = /^[a-f0-9]{64}$/;
const REFERENCE_PATTERN = /^[a-f0-9]{64}$/;
const STORAGE_BACKEND = 'netlify_blobs';
const PRODUCTION_STORE = 'legendmural-v3-invoice-pdfs-prod';
const RETRIABLE_STATUSES = new Set([408, 425, 429]);
const RETRIABLE_CODES = new Set([
  'ETIMEDOUT',
  'ECONNRESET',
  'ECONNREFUSED',
  'EHOSTUNREACH',
  'ENETUNREACH',
  'EAI_AGAIN',
  'ENOTFOUND',
  'UND_ERR_CONNECT_TIMEOUT',
  'UND_ERR_HEADERS_TIMEOUT',
  'UND_ERR_BODY_TIMEOUT',
]);

export class NetlifyV3InvoicePdfStoreError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = 'NetlifyV3InvoicePdfStoreError';
    this.code = code;
    this.details = details;
  }
}

function fail(code, message, details = {}) {
  throw new NetlifyV3InvoicePdfStoreError(code, message, details);
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

function nonnegativeInteger(value, field) {
  const normalized = Number(value);
  if (!Number.isSafeInteger(normalized) || normalized < 0) {
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

export function v3InvoicePdfStorageKey({ invoiceId, pdfSha256 } = {}) {
  const id = positiveInteger(invoiceId, 'invoiceId');
  const hash = normalizeSha(pdfSha256);
  return `v1/invoices/${id}/${hash}.pdf`;
}

function normalizeIdentity(input = {}) {
  const invoiceId = positiveInteger(input.invoiceId, 'invoiceId');
  const orderReference = normalizeReference(input.orderReference);
  const snapshotSchemaVersion = positiveInteger(
    input.snapshotSchemaVersion,
    'snapshotSchemaVersion',
  );
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
    storageKey: v3InvoicePdfStorageKey({ invoiceId, pdfSha256 }),
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

function statusFrom(error) {
  const candidates = [error?.status, error?.statusCode, error?.response?.status];
  for (const value of candidates) {
    const status = Number(value);
    if (Number.isInteger(status) && status >= 100 && status <= 599) return status;
  }
  return null;
}

function transportFailure(error) {
  if (error?.name === 'AbortError' || error?.name === 'TimeoutError' || error instanceof TypeError) {
    return true;
  }
  return [error?.code, error?.cause?.code]
    .map((value) => String(value || '').trim().toUpperCase())
    .some((code) => RETRIABLE_CODES.has(code));
}

function wrapStoreFailure(stage, error) {
  if (error instanceof NetlifyV3InvoicePdfStoreError) throw error;
  const status = statusFrom(error);
  if (transportFailure(error)
    || RETRIABLE_STATUSES.has(status)
    || (status !== null && status >= 500)) {
    fail('V3_INVOICE_STORAGE_UNAVAILABLE', 'Private V3 invoice storage is temporarily unavailable.', {
      stage,
      ...(status === null ? {} : { status }),
    });
  }
  fail('V3_INVOICE_STORAGE_CONFIGURATION', 'Private V3 invoice storage could not be used.', {
    stage,
    ...(status === null ? {} : { status }),
  });
}

function assertProductionBoundary(env) {
  if (!enabled(env?.V3_INVOICE_STORAGE_ENABLED)) {
    fail('V3_INVOICE_STORAGE_DISABLED', 'V3 invoice storage is disabled.');
  }
  if (String(env?.CONTEXT || '').trim().toLowerCase() !== 'production') {
    fail(
      'V3_INVOICE_STORAGE_CONTEXT_FORBIDDEN',
      'The Production V3 invoice Blob store is forbidden outside the Production deploy context.',
    );
  }
}

function assertStore(store) {
  if (typeof store?.set !== 'function' || typeof store?.get !== 'function') {
    fail('V3_INVOICE_STORAGE_CONFIGURATION', 'Netlify Blobs store API is unavailable.');
  }
  return store;
}

export function createNetlifyV3InvoicePdfStore({
  env = process.env,
  getStoreFactory = getStore,
  storeName = PRODUCTION_STORE,
} = {}) {
  assertProductionBoundary(env);
  if (typeof getStoreFactory !== 'function') {
    fail('V3_INVOICE_STORAGE_CONFIGURATION', 'Netlify Blobs store factory is unavailable.');
  }
  if (storeName !== PRODUCTION_STORE) {
    fail('V3_INVOICE_STORAGE_CONFIGURATION', 'Unexpected Production V3 invoice store name.');
  }

  let store = null;
  function resolveStore() {
    if (!store) {
      try {
        store = assertStore(getStoreFactory({ name: storeName, consistency: 'strong' }));
      } catch (error) {
        wrapStoreFailure('open_store', error);
      }
    }
    return store;
  }

  async function readVerified(identity) {
    let stored;
    try {
      stored = await resolveStore().get(identity.storageKey, {
        consistency: 'strong',
        type: 'arrayBuffer',
      });
    } catch (error) {
      wrapStoreFailure('strong_read', error);
    }
    if (stored === null || stored === undefined) {
      fail('V3_INVOICE_STORAGE_MISSING', 'The bound V3 invoice PDF blob is missing.', {
        storageKey: identity.storageKey,
      });
    }
    return verifyBytes(stored, identity);
  }

  return Object.freeze({
    async persistVerifiedArtifact(input = {}) {
      const identity = normalizeIdentity(input);
      const sourceBytes = verifyBytes(input.bytes, identity);
      let write;
      try {
        write = await resolveStore().set(
          identity.storageKey,
          toArrayBuffer(sourceBytes),
          {
            onlyIfNew: true,
            metadata: {
              invoiceId: identity.invoiceId,
              orderReference: identity.orderReference,
              snapshotSchemaVersion: identity.snapshotSchemaVersion,
              rendererVersion: identity.rendererVersion,
              pdfSha256: identity.pdfSha256,
              pdfByteLength: identity.pdfByteLength,
              attachmentFilename: identity.attachmentFilename,
            },
          },
        );
      } catch (error) {
        wrapStoreFailure('create_only_write', error);
      }
      const bytes = await readVerified(identity);
      return Object.freeze({
        storageBackend: STORAGE_BACKEND,
        storageKey: identity.storageKey,
        duplicate: write?.modified === false,
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
  PRODUCTION_STORE as V3_INVOICE_PDF_PRODUCTION_STORE,
  STORAGE_BACKEND as V3_INVOICE_PDF_STORAGE_BACKEND,
};
