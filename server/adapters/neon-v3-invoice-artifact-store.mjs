import {
  createDefaultNeonClient,
  validateNeonConnectionString,
} from './neon-order-store.mjs';

const REFERENCE_PATTERN = /^[a-f0-9]{64}$/;
const SHA256_PATTERN = /^[a-f0-9]{64}$/;
const STORAGE_BACKEND = 'netlify_blobs';

export class NeonV3InvoiceArtifactStoreError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = 'NeonV3InvoiceArtifactStoreError';
    this.code = code;
    this.details = details;
  }
}

function fail(code, message, details = {}) {
  throw new NeonV3InvoiceArtifactStoreError(code, message, details);
}

function reference(value) {
  const normalized = String(value || '').trim().toLowerCase();
  if (!REFERENCE_PATTERN.test(normalized)) {
    fail('INVALID_V3_INVOICE_ARTIFACT_REQUEST', 'orderReference is invalid.');
  }
  return normalized;
}

function positiveInteger(value, field) {
  const normalized = Number(value);
  if (!Number.isSafeInteger(normalized) || normalized <= 0) {
    fail('INVALID_V3_INVOICE_ARTIFACT_REQUEST', `${field} is invalid.`, { field });
  }
  return normalized;
}

function timestamp(value, field) {
  const normalized = Number(value);
  if (!Number.isSafeInteger(normalized) || normalized < 0) {
    fail('INVALID_V3_INVOICE_ARTIFACT_REQUEST', `${field} is invalid.`, { field });
  }
  return normalized;
}

function exactText(value, field, maxLength) {
  const normalized = String(value ?? '');
  if (!normalized
    || normalized !== normalized.trim()
    || normalized.length > maxLength
    || /[\u0000-\u001f\u007f]/.test(normalized)) {
    fail('INVALID_V3_INVOICE_ARTIFACT_REQUEST', `${field} is invalid.`, { field });
  }
  return normalized;
}

function sha(value) {
  const normalized = exactText(value, 'pdfSha256', 64).toLowerCase();
  if (!SHA256_PATTERN.test(normalized)) {
    fail('INVALID_V3_INVOICE_ARTIFACT_REQUEST', 'pdfSha256 is invalid.');
  }
  return normalized;
}

function filename(value) {
  const normalized = exactText(value, 'attachmentFilename', 200);
  if (normalized.includes('/') || normalized.includes('\\') || !normalized.toLowerCase().endsWith('.pdf')) {
    fail('INVALID_V3_INVOICE_ARTIFACT_REQUEST', 'attachmentFilename is invalid.');
  }
  return normalized;
}

function storageKey(invoiceId, pdfSha256) {
  return `v1/invoices/${invoiceId}/${pdfSha256}.pdf`;
}

function validateClient(client) {
  for (const method of ['connect', 'query', 'end']) {
    if (typeof client?.[method] !== 'function') {
      fail('INVALID_NEON_CLIENT', `Neon client is missing ${method}().`);
    }
  }
  return client;
}

async function closeClient(client) {
  try { await client.end(); } catch {}
}

async function withClient(clientFactory, connectionString, action) {
  const client = validateClient(await clientFactory(connectionString));
  try {
    await client.connect();
    return await action(client);
  } finally {
    await closeClient(client);
  }
}

const COLUMNS = `
  order_reference, notification_type, delivery_status,
  invoice_id, snapshot_schema_version,
  renderer_version, pdf_sha256, pdf_byte_length, attachment_filename,
  pdf_storage_backend, pdf_storage_key, pdf_stored_at,
  claim_token, claimed_at, lease_expires_at, updated_at
`;

const SELECT_ARTIFACT = `
  SELECT ${COLUMNS}
  FROM legend_commerce.order_notifications
  WHERE order_reference = $1
    AND notification_type = 'customer_v3_invoice'
`;

const BIND_STORED_ARTIFACT = `
  UPDATE legend_commerce.order_notifications
  SET renderer_version = COALESCE(renderer_version, $4),
      pdf_sha256 = COALESCE(pdf_sha256, $5),
      pdf_byte_length = COALESCE(pdf_byte_length, $6),
      attachment_filename = COALESCE(attachment_filename, $7),
      pdf_storage_backend = COALESCE(pdf_storage_backend, $8),
      pdf_storage_key = COALESCE(pdf_storage_key, $9),
      pdf_stored_at = COALESCE(pdf_stored_at, $10),
      updated_at = CASE WHEN pdf_storage_backend IS NULL THEN $10 ELSE updated_at END
  WHERE order_reference = $1
    AND notification_type = 'customer_v3_invoice'
    AND invoice_id = $2
    AND snapshot_schema_version = 1
    AND delivery_status = 'sending'
    AND claim_token = $3
    AND claimed_at IS NOT NULL
    AND claimed_at <= $10
    AND lease_expires_at IS NOT NULL
    AND lease_expires_at > $10
    AND (
      (
        renderer_version IS NULL
        AND pdf_sha256 IS NULL
        AND pdf_byte_length IS NULL
        AND attachment_filename IS NULL
      )
      OR (
        renderer_version = $4
        AND pdf_sha256 = $5
        AND pdf_byte_length = $6
        AND attachment_filename = $7
      )
    )
    AND (
      (
        pdf_storage_backend IS NULL
        AND pdf_storage_key IS NULL
        AND pdf_stored_at IS NULL
      )
      OR (
        pdf_storage_backend = $8
        AND pdf_storage_key = $9
      )
    )
  RETURNING ${COLUMNS}
`;

function nullableNumber(value) {
  return value === null || value === undefined ? null : Number(value);
}

function textOrNull(value) {
  return value === null || value === undefined ? null : String(value);
}

function rowToState(row, expected = {}) {
  if (!row) return null;
  const orderReference = reference(row.order_reference);
  const invoiceId = positiveInteger(row.invoice_id, 'invoiceId');
  if (String(row.notification_type || '') !== 'customer_v3_invoice'
    || Number(row.snapshot_schema_version) !== 1) {
    fail('V3_INVOICE_ARTIFACT_IDENTITY_MISMATCH', 'Stored invoice artifact binding is invalid.');
  }
  if (expected.orderReference && orderReference !== expected.orderReference) {
    fail('V3_INVOICE_ARTIFACT_IDENTITY_MISMATCH', 'Stored order reference does not match.');
  }
  if (expected.invoiceId && invoiceId !== expected.invoiceId) {
    fail('V3_INVOICE_ARTIFACT_IDENTITY_MISMATCH', 'Stored invoice identity does not match.');
  }

  const rendererVersion = nullableNumber(row.renderer_version);
  const pdfSha256 = textOrNull(row.pdf_sha256);
  const pdfByteLength = nullableNumber(row.pdf_byte_length);
  const attachmentFilename = textOrNull(row.attachment_filename);
  const artifactValues = [rendererVersion, pdfSha256, pdfByteLength, attachmentFilename];
  const artifactAbsent = artifactValues.every((value) => value === null);
  const artifactComplete = artifactValues.every((value) => value !== null);
  if (!artifactAbsent && !artifactComplete) {
    fail('V3_INVOICE_ARTIFACT_IDENTITY_MISMATCH', 'Stored invoice artifact identity is partial.');
  }
  if (artifactComplete) {
    positiveInteger(rendererVersion, 'rendererVersion');
    sha(pdfSha256);
    positiveInteger(pdfByteLength, 'pdfByteLength');
    filename(attachmentFilename);
  }

  const storageBackend = textOrNull(row.pdf_storage_backend);
  const storedKey = textOrNull(row.pdf_storage_key);
  const storedAt = nullableNumber(row.pdf_stored_at);
  const storageValues = [storageBackend, storedKey, storedAt];
  const storageAbsent = storageValues.every((value) => value === null);
  const storageComplete = storageValues.every((value) => value !== null);
  if (!storageAbsent && !storageComplete) {
    fail('V3_INVOICE_STORAGE_BINDING_MISMATCH', 'Stored invoice PDF storage binding is partial.');
  }
  if (storageComplete) {
    if (!artifactComplete
      || storageBackend !== STORAGE_BACKEND
      || storedKey !== storageKey(invoiceId, pdfSha256)
      || !Number.isSafeInteger(storedAt)
      || storedAt < 0) {
      fail('V3_INVOICE_STORAGE_BINDING_MISMATCH', 'Stored invoice PDF storage binding is invalid.');
    }
  }

  return Object.freeze({
    orderReference,
    invoiceId,
    snapshotSchemaVersion: 1,
    deliveryStatus: String(row.delivery_status || ''),
    rendererVersion,
    pdfSha256,
    pdfByteLength,
    attachmentFilename,
    storageBackend,
    storageKey: storedKey,
    storedAt,
    storageBound: storageComplete,
    claimToken: textOrNull(row.claim_token),
    claimedAt: nullableNumber(row.claimed_at),
    leaseExpiresAt: nullableNumber(row.lease_expires_at),
    updatedAt: Number(row.updated_at),
  });
}

function expectedArtifact(input) {
  const invoiceId = positiveInteger(input.invoiceId, 'invoiceId');
  const pdfSha256 = sha(input.pdfSha256);
  const backend = exactText(input.storageBackend, 'storageBackend', 40);
  const key = exactText(input.storageKey, 'storageKey', 240);
  if (backend !== STORAGE_BACKEND || key !== storageKey(invoiceId, pdfSha256)) {
    fail('INVALID_V3_INVOICE_ARTIFACT_REQUEST', 'Storage binding does not match deterministic identity.');
  }
  return Object.freeze({
    orderReference: reference(input.orderReference),
    invoiceId,
    claimToken: exactText(input.claimToken, 'claimToken', 120),
    rendererVersion: positiveInteger(input.rendererVersion, 'rendererVersion'),
    pdfSha256,
    pdfByteLength: positiveInteger(input.pdfByteLength, 'pdfByteLength'),
    attachmentFilename: filename(input.attachmentFilename),
    storageBackend: backend,
    storageKey: key,
    storedAt: timestamp(input.storedAt, 'storedAt'),
  });
}

function stateMatches(state, expected) {
  return state.rendererVersion === expected.rendererVersion
    && state.pdfSha256 === expected.pdfSha256
    && state.pdfByteLength === expected.pdfByteLength
    && state.attachmentFilename === expected.attachmentFilename
    && state.storageBackend === expected.storageBackend
    && state.storageKey === expected.storageKey;
}

export function createNeonV3InvoiceArtifactStore({
  connectionString = process.env.DATABASE_URL,
  clientFactory = createDefaultNeonClient,
} = {}) {
  const databaseUrl = validateNeonConnectionString(connectionString);
  if (typeof clientFactory !== 'function') {
    fail('INVALID_NEON_CLIENT_FACTORY', 'A Neon client factory is required.');
  }

  return Object.freeze({
    async loadArtifactState({ orderReference, invoiceId } = {}) {
      const expected = {
        orderReference: reference(orderReference),
        invoiceId: positiveInteger(invoiceId, 'invoiceId'),
      };
      return withClient(clientFactory, databaseUrl, async (client) => {
        const result = await client.query(SELECT_ARTIFACT, [expected.orderReference]);
        const state = rowToState(result.rows?.[0], expected);
        if (!state) {
          fail('V3_INVOICE_ARTIFACT_NOT_FOUND', 'V3 invoice artifact row could not be loaded.');
        }
        return state;
      });
    },

    async bindStoredArtifact(input = {}) {
      const expected = expectedArtifact(input);
      return withClient(clientFactory, databaseUrl, async (client) => {
        const result = await client.query(BIND_STORED_ARTIFACT, [
          expected.orderReference,
          expected.invoiceId,
          expected.claimToken,
          expected.rendererVersion,
          expected.pdfSha256,
          expected.pdfByteLength,
          expected.attachmentFilename,
          expected.storageBackend,
          expected.storageKey,
          expected.storedAt,
        ]);
        const bound = rowToState(result.rows?.[0], expected);
        if (bound) return bound;

        const currentResult = await client.query(SELECT_ARTIFACT, [expected.orderReference]);
        const current = rowToState(currentResult.rows?.[0], expected);
        if (!current) {
          fail('V3_INVOICE_ARTIFACT_NOT_FOUND', 'V3 invoice artifact row could not be loaded.');
        }
        if (current.deliveryStatus !== 'sending') {
          fail('V3_INVOICE_ARTIFACT_STATE_CONFLICT', 'V3 invoice delivery is not actively sending.');
        }
        if (current.claimToken !== expected.claimToken
          || current.claimedAt === null
          || current.claimedAt > expected.storedAt
          || current.leaseExpiresAt === null
          || current.leaseExpiresAt <= expected.storedAt) {
          fail('V3_INVOICE_ARTIFACT_CLAIM_CONFLICT', 'V3 invoice artifact claim is stale or not owned.');
        }
        if (current.storageBound && stateMatches(current, expected)) return current;
        if (current.storageBound) {
          fail('V3_INVOICE_STORAGE_BINDING_MISMATCH', 'V3 invoice storage binding differs from immutable identity.');
        }
        if (current.rendererVersion !== null && (
          current.rendererVersion !== expected.rendererVersion
          || current.pdfSha256 !== expected.pdfSha256
          || current.pdfByteLength !== expected.pdfByteLength
          || current.attachmentFilename !== expected.attachmentFilename
        )) {
          fail('V3_INVOICE_ARTIFACT_IDENTITY_MISMATCH', 'V3 invoice artifact metadata differs from immutable identity.');
        }
        fail('V3_INVOICE_ARTIFACT_STATE_CONFLICT', 'V3 invoice artifact binding changed unexpectedly.');
      });
    },
  });
}

export { STORAGE_BACKEND as V3_INVOICE_STORAGE_BACKEND };
