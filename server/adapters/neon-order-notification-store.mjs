import { randomUUID } from 'node:crypto';

import {
  createDefaultNeonClient,
  validateNeonConnectionString,
} from './neon-order-store.mjs';

const REFERENCE_PATTERN = /^[a-f0-9]{64}$/;
const SHA256_PATTERN = /^[a-f0-9]{64}$/;
const NOTIFICATION_TYPES = new Set([
  'merchant_paid_order',
  'customer_paid_order',
  'customer_v3_invoice',
]);
const DELIVERY_STATUSES = new Set(['pending', 'sending', 'sent', 'failed']);
const DEFAULT_LEASE_SECONDS = 300;

export class NeonOrderNotificationStoreError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = 'NeonOrderNotificationStoreError';
    this.code = code;
    this.details = details;
  }
}

function fail(code, message, details) {
  throw new NeonOrderNotificationStoreError(code, message, details);
}

function normalizeReference(value) {
  const reference = String(value || '').trim().toLowerCase();
  if (!REFERENCE_PATTERN.test(reference)) {
    fail('INVALID_ORDER_NOTIFICATION_REFERENCE', 'Order notification reference is invalid.');
  }
  return reference;
}

function normalizeType(value) {
  const type = String(value || '').trim();
  if (!NOTIFICATION_TYPES.has(type)) {
    fail('INVALID_ORDER_NOTIFICATION_TYPE', 'Order notification type is invalid.');
  }
  return type;
}

function timestamp(value, field) {
  const normalized = Number(value);
  if (!Number.isInteger(normalized) || normalized < 0) {
    fail('INVALID_ORDER_NOTIFICATION_TIMESTAMP', `${field} is invalid.`, { field });
  }
  return normalized;
}

function positiveInteger(value, field, { nullable = false } = {}) {
  if (nullable && (value === null || value === undefined || value === '')) return null;
  const normalized = Number(value);
  if (!Number.isSafeInteger(normalized) || normalized <= 0) {
    fail('INVALID_ORDER_NOTIFICATION_DELIVERY', `${field} is invalid.`, { field });
  }
  return normalized;
}

function optionalTimestamp(value, field) {
  if (value === null || value === undefined || value === '') return null;
  return timestamp(value, field);
}

function optionalText(value, field, maxLength) {
  if (value === null || value === undefined || value === '') return null;
  const normalized = String(value).trim();
  if (!normalized || normalized.length > maxLength || /[\u0000-\u001F\u007F]/.test(normalized)) {
    fail('INVALID_ORDER_NOTIFICATION_DELIVERY', `${field} is invalid.`, { field });
  }
  return normalized;
}

function exactText(value, field, maxLength, code = 'INVALID_ORDER_NOTIFICATION_DELIVERY') {
  const normalized = String(value ?? '');
  if (!normalized
    || normalized.length > maxLength
    || normalized !== normalized.trim()
    || /[\u0000-\u001F\u007F]/.test(normalized)) {
    fail(code, `${field} is invalid.`, { field });
  }
  return normalized;
}

function normalizeV3Artifact({
  claimToken,
  rendererVersion,
  pdfSha256,
  pdfByteLength,
  attachmentFilename,
}) {
  const normalizedClaimToken = exactText(
    claimToken,
    'claimToken',
    120,
    'INVALID_ORDER_NOTIFICATION_CLAIM_TOKEN',
  );
  const renderer = positiveInteger(rendererVersion, 'rendererVersion');
  const sha256 = exactText(pdfSha256, 'pdfSha256', 64, 'INVALID_ORDER_NOTIFICATION_ARTIFACT');
  if (!SHA256_PATTERN.test(sha256)) {
    fail('INVALID_ORDER_NOTIFICATION_ARTIFACT', 'pdfSha256 is invalid.', { field: 'pdfSha256' });
  }
  const byteLength = positiveInteger(pdfByteLength, 'pdfByteLength');
  const filename = exactText(
    attachmentFilename,
    'attachmentFilename',
    200,
    'INVALID_ORDER_NOTIFICATION_ARTIFACT',
  );
  if (filename.includes('/') || filename.includes('\\') || !filename.toLowerCase().endsWith('.pdf')) {
    fail(
      'INVALID_ORDER_NOTIFICATION_ARTIFACT',
      'attachmentFilename is invalid.',
      { field: 'attachmentFilename' },
    );
  }
  return Object.freeze({
    claimToken: normalizedClaimToken,
    rendererVersion: renderer,
    pdfSha256: sha256,
    pdfByteLength: byteLength,
    attachmentFilename: filename,
  });
}

function normalizeV3Binding(type, invoiceId, snapshotSchemaVersion) {
  if (type !== 'customer_v3_invoice') {
    if (invoiceId != null || snapshotSchemaVersion != null) {
      fail(
        'INVALID_ORDER_NOTIFICATION_DELIVERY',
        'Invoice binding is only valid for customer_v3_invoice.',
      );
    }
    return Object.freeze({ invoiceId: null, snapshotSchemaVersion: null });
  }
  return Object.freeze({
    invoiceId: positiveInteger(invoiceId, 'invoiceId'),
    snapshotSchemaVersion: positiveInteger(snapshotSchemaVersion, 'snapshotSchemaVersion'),
  });
}

function validateClient(client) {
  for (const method of ['connect', 'query', 'end']) {
    if (typeof client?.[method] !== 'function') {
      fail('INVALID_NEON_CLIENT', `Neon client is missing ${method}().`);
    }
  }
  return client;
}

function nullableNumber(value) {
  return value == null ? null : Number(value);
}

function rowToNotification(row) {
  if (!row || typeof row !== 'object') return null;
  const status = String(row.delivery_status || '');
  if (!DELIVERY_STATUSES.has(status)) {
    fail('INVALID_ORDER_NOTIFICATION_STORE_RESULT', 'Stored delivery status is invalid.');
  }
  return Object.freeze({
    orderReference: normalizeReference(row.order_reference),
    notificationType: normalizeType(row.notification_type),
    deliveryStatus: status,
    deliveryAttempts: Number(row.delivery_attempts),
    claimedAt: nullableNumber(row.claimed_at),
    lastAttemptAt: nullableNumber(row.last_attempt_at),
    sentAt: nullableNumber(row.sent_at),
    providerMessageId: row.provider_message_id ? String(row.provider_message_id) : null,
    lastErrorCode: row.last_error_code ? String(row.last_error_code) : null,
    invoiceId: nullableNumber(row.invoice_id),
    snapshotSchemaVersion: nullableNumber(row.snapshot_schema_version),
    rendererVersion: nullableNumber(row.renderer_version),
    pdfSha256: row.pdf_sha256 ? String(row.pdf_sha256) : null,
    pdfByteLength: nullableNumber(row.pdf_byte_length),
    attachmentFilename: row.attachment_filename ? String(row.attachment_filename) : null,
    claimToken: row.claim_token ? String(row.claim_token) : null,
    leaseExpiresAt: nullableNumber(row.lease_expires_at),
    nextAttemptAt: nullableNumber(row.next_attempt_at),
    createdAt: Number(row.created_at),
    updatedAt: Number(row.updated_at),
  });
}

async function closeClient(client) {
  try {
    await client.end();
  } catch {
    // Closing a failed serverless connection must not mask the original error.
  }
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
  order_reference, notification_type, delivery_status, delivery_attempts,
  claimed_at, last_attempt_at, sent_at, provider_message_id, last_error_code,
  invoice_id, snapshot_schema_version, renderer_version, pdf_sha256,
  pdf_byte_length, attachment_filename, claim_token, lease_expires_at, next_attempt_at,
  created_at, updated_at
`;

const INSERT_NOTIFICATION = `
  INSERT INTO legend_commerce.order_notifications (
    order_reference, notification_type, delivery_status, delivery_attempts,
    invoice_id, snapshot_schema_version, created_at, updated_at
  ) VALUES ($1, $2, 'pending', 0, $4, $5, $3, $3)
  ON CONFLICT (order_reference, notification_type) DO NOTHING
  RETURNING ${COLUMNS}
`;

const SELECT_NOTIFICATION = `
  SELECT ${COLUMNS}
  FROM legend_commerce.order_notifications
  WHERE order_reference = $1 AND notification_type = $2
`;

const CLAIM_NOTIFICATION = `
  UPDATE legend_commerce.order_notifications
  SET delivery_status = 'sending',
      delivery_attempts = delivery_attempts + 1,
      claimed_at = $3,
      last_attempt_at = $3,
      claim_token = $4,
      lease_expires_at = $5,
      next_attempt_at = NULL,
      last_error_code = NULL,
      updated_at = $3
  WHERE order_reference = $1
    AND notification_type = $2
    AND (
      delivery_status = 'pending'
      OR (
        delivery_status = 'failed'
        AND (next_attempt_at IS NULL OR next_attempt_at <= $3)
      )
      OR (
        delivery_status = 'sending'
        AND COALESCE(lease_expires_at, claimed_at + $6) <= $3
      )
    )
  RETURNING ${COLUMNS}
`;

const PREPARE_V3_INVOICE_ARTIFACT = `
  UPDATE legend_commerce.order_notifications
  SET renderer_version = COALESCE(renderer_version, $4),
      pdf_sha256 = COALESCE(pdf_sha256, $5),
      pdf_byte_length = COALESCE(pdf_byte_length, $6),
      attachment_filename = COALESCE(attachment_filename, $7),
      updated_at = CASE WHEN renderer_version IS NULL THEN $8 ELSE updated_at END
  WHERE order_reference = $1
    AND notification_type = 'customer_v3_invoice'
    AND invoice_id = $2
    AND snapshot_schema_version = 1
    AND delivery_status = 'sending'
    AND claim_token = $3
    AND claimed_at IS NOT NULL
    AND claimed_at <= $8
    AND lease_expires_at IS NOT NULL
    AND lease_expires_at > $8
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
  RETURNING ${COLUMNS}
`;

const RECORD_SENT = `
  UPDATE legend_commerce.order_notifications
  SET delivery_status = 'sent',
      sent_at = COALESCE(sent_at, $3),
      provider_message_id = COALESCE(provider_message_id, $4),
      claim_token = NULL,
      lease_expires_at = NULL,
      next_attempt_at = NULL,
      last_error_code = NULL,
      updated_at = $3
  WHERE order_reference = $1
    AND notification_type = $2
    AND delivery_status = 'sending'
    AND ($5::text IS NULL OR claim_token = $5)
  RETURNING ${COLUMNS}
`;

const RECORD_FAILED = `
  UPDATE legend_commerce.order_notifications
  SET delivery_status = 'failed',
      last_error_code = $4,
      claim_token = NULL,
      lease_expires_at = NULL,
      next_attempt_at = $5,
      updated_at = $3
  WHERE order_reference = $1
    AND notification_type = $2
    AND delivery_status = 'sending'
    AND ($6::text IS NULL OR claim_token = $6)
  RETURNING ${COLUMNS}
`;

function artifactMatches(notification, artifact) {
  return notification.rendererVersion === artifact.rendererVersion
    && notification.pdfSha256 === artifact.pdfSha256
    && notification.pdfByteLength === artifact.pdfByteLength
    && notification.attachmentFilename === artifact.attachmentFilename;
}

function artifactAbsent(notification) {
  return notification.rendererVersion === null
    && notification.pdfSha256 === null
    && notification.pdfByteLength === null
    && notification.attachmentFilename === null;
}

export function createNeonOrderNotificationStore({
  connectionString = process.env.DATABASE_URL,
  clientFactory = createDefaultNeonClient,
  claimTokenFactory = randomUUID,
} = {}) {
  const databaseUrl = validateNeonConnectionString(connectionString);
  if (typeof clientFactory !== 'function') {
    fail('INVALID_NEON_CLIENT_FACTORY', 'A Neon client factory is required.');
  }
  if (typeof claimTokenFactory !== 'function') {
    fail('INVALID_ORDER_NOTIFICATION_CLAIM_TOKEN', 'A claim token factory is required.');
  }

  return Object.freeze({
    async ensureNotification({
      orderReference,
      notificationType,
      createdAt,
      invoiceId = null,
      snapshotSchemaVersion = null,
    }) {
      const reference = normalizeReference(orderReference);
      const type = normalizeType(notificationType);
      const created = timestamp(createdAt, 'createdAt');
      const binding = normalizeV3Binding(type, invoiceId, snapshotSchemaVersion);
      return withClient(clientFactory, databaseUrl, async (client) => {
        const inserted = await client.query(INSERT_NOTIFICATION, [
          reference,
          type,
          created,
          binding.invoiceId,
          binding.snapshotSchemaVersion,
        ]);
        const insertedNotification = rowToNotification(inserted.rows?.[0]);
        if (insertedNotification) {
          return Object.freeze({ created: true, notification: insertedNotification });
        }
        const existing = await client.query(SELECT_NOTIFICATION, [reference, type]);
        const notification = rowToNotification(existing.rows?.[0]);
        if (!notification) {
          fail('ORDER_NOTIFICATION_NOT_FOUND', 'Order notification could not be loaded.');
        }
        if (
          type === 'customer_v3_invoice'
          && (
            notification.invoiceId !== binding.invoiceId
            || notification.snapshotSchemaVersion !== binding.snapshotSchemaVersion
          )
        ) {
          fail(
            'ORDER_NOTIFICATION_IDENTITY_MISMATCH',
            'Existing V3 invoice notification is bound to different immutable invoice identity.',
          );
        }
        return Object.freeze({ created: false, notification });
      });
    },

    async claimNotification({
      orderReference,
      notificationType,
      attemptedAt,
      leaseSeconds = DEFAULT_LEASE_SECONDS,
    }) {
      const reference = normalizeReference(orderReference);
      const type = normalizeType(notificationType);
      const attempted = timestamp(attemptedAt, 'attemptedAt');
      const lease = positiveInteger(leaseSeconds, 'leaseSeconds');
      const leaseExpiresAt = attempted + lease;
      if (!Number.isSafeInteger(leaseExpiresAt)) {
        fail('INVALID_ORDER_NOTIFICATION_TIMESTAMP', 'leaseExpiresAt is invalid.', { field: 'leaseExpiresAt' });
      }
      const claimToken = optionalText(claimTokenFactory(), 'claimToken', 120);
      if (!claimToken) {
        fail('INVALID_ORDER_NOTIFICATION_CLAIM_TOKEN', 'claimToken is invalid.');
      }

      return withClient(clientFactory, databaseUrl, async (client) => {
        const claimed = await client.query(CLAIM_NOTIFICATION, [
          reference,
          type,
          attempted,
          claimToken,
          leaseExpiresAt,
          lease,
        ]);
        const notification = rowToNotification(claimed.rows?.[0]);
        if (notification) return Object.freeze({ claimed: true, notification });
        const existing = await client.query(SELECT_NOTIFICATION, [reference, type]);
        const current = rowToNotification(existing.rows?.[0]);
        if (!current) fail('ORDER_NOTIFICATION_NOT_FOUND', 'Order notification could not be loaded.');
        return Object.freeze({ claimed: false, notification: current });
      });
    },

    async prepareV3InvoiceArtifact({
      orderReference,
      invoiceId,
      claimToken,
      rendererVersion,
      pdfSha256,
      pdfByteLength,
      attachmentFilename,
      updatedAt,
    }) {
      const reference = normalizeReference(orderReference);
      const normalizedInvoiceId = positiveInteger(invoiceId, 'invoiceId');
      const artifact = normalizeV3Artifact({
        claimToken,
        rendererVersion,
        pdfSha256,
        pdfByteLength,
        attachmentFilename,
      });
      const updated = timestamp(updatedAt, 'updatedAt');

      return withClient(clientFactory, databaseUrl, async (client) => {
        const result = await client.query(PREPARE_V3_INVOICE_ARTIFACT, [
          reference,
          normalizedInvoiceId,
          artifact.claimToken,
          artifact.rendererVersion,
          artifact.pdfSha256,
          artifact.pdfByteLength,
          artifact.attachmentFilename,
          updated,
        ]);
        const prepared = rowToNotification(result.rows?.[0]);
        if (prepared) return prepared;

        const existing = await client.query(SELECT_NOTIFICATION, [
          reference,
          'customer_v3_invoice',
        ]);
        const current = rowToNotification(existing.rows?.[0]);
        if (!current) {
          fail('ORDER_NOTIFICATION_NOT_FOUND', 'V3 invoice notification could not be loaded.');
        }
        if (current.invoiceId !== normalizedInvoiceId || current.snapshotSchemaVersion !== 1) {
          fail(
            'ORDER_NOTIFICATION_IDENTITY_MISMATCH',
            'V3 invoice notification is bound to different immutable invoice identity.',
          );
        }
        if (current.deliveryStatus !== 'sending') {
          fail(
            'ORDER_NOTIFICATION_STATE_CONFLICT',
            'V3 invoice notification is not in an active sending state.',
          );
        }
        if (current.claimToken !== artifact.claimToken
          || current.claimedAt === null
          || current.claimedAt > updated
          || current.leaseExpiresAt === null
          || current.leaseExpiresAt <= updated) {
          fail(
            'ORDER_NOTIFICATION_CLAIM_CONFLICT',
            'V3 invoice notification claim is stale or no longer owned by this delivery attempt.',
          );
        }
        if (artifactMatches(current, artifact)) return current;
        if (!artifactAbsent(current)) {
          fail(
            'ORDER_NOTIFICATION_ARTIFACT_MISMATCH',
            'V3 invoice artifact metadata differs from the immutable prepared identity.',
          );
        }
        fail(
          'ORDER_NOTIFICATION_STATE_CONFLICT',
          'V3 invoice artifact preparation state changed unexpectedly.',
        );
      });
    },

    async recordDelivery({
      orderReference,
      notificationType,
      status,
      attemptedAt,
      providerMessageId = null,
      errorCode = null,
      nextAttemptAt = null,
      claimToken = null,
    }) {
      const reference = normalizeReference(orderReference);
      const type = normalizeType(notificationType);
      const attempted = timestamp(attemptedAt, 'attemptedAt');
      const normalizedStatus = String(status || '').trim().toLowerCase();
      if (!['sent', 'failed'].includes(normalizedStatus)) {
        fail('INVALID_ORDER_NOTIFICATION_DELIVERY', 'Delivery status must be sent or failed.');
      }
      const providerId = normalizedStatus === 'sent'
        ? optionalText(providerMessageId, 'providerMessageId', 200)
        : null;
      const failureCode = normalizedStatus === 'failed'
        ? optionalText(errorCode || 'UNKNOWN', 'errorCode', 120)
        : null;
      const retryAt = normalizedStatus === 'failed'
        ? optionalTimestamp(nextAttemptAt, 'nextAttemptAt')
        : null;
      const normalizedClaimToken = optionalText(claimToken, 'claimToken', 120);
      if (normalizedStatus === 'sent' && !providerId) {
        fail('INVALID_ORDER_NOTIFICATION_DELIVERY', 'providerMessageId is required for sent delivery.');
      }
      if (type === 'customer_v3_invoice' && !normalizedClaimToken) {
        fail(
          'INVALID_ORDER_NOTIFICATION_CLAIM_TOKEN',
          'claimToken is required to complete a customer_v3_invoice delivery.',
        );
      }

      return withClient(clientFactory, databaseUrl, async (client) => {
        const statement = normalizedStatus === 'sent' ? RECORD_SENT : RECORD_FAILED;
        const values = normalizedStatus === 'sent'
          ? [reference, type, attempted, providerId, normalizedClaimToken]
          : [reference, type, attempted, failureCode, retryAt, normalizedClaimToken];
        const result = await client.query(statement, values);
        const notification = rowToNotification(result.rows?.[0]);
        if (!notification) {
          fail('ORDER_NOTIFICATION_STATE_CONFLICT', 'Order notification delivery state changed unexpectedly.');
        }
        return notification;
      });
    },
  });
}

export { DEFAULT_LEASE_SECONDS, NOTIFICATION_TYPES };
