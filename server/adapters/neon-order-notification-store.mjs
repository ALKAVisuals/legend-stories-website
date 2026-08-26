import {
  createDefaultNeonClient,
  validateNeonConnectionString,
} from './neon-order-store.mjs';

const REFERENCE_PATTERN = /^[a-f0-9]{64}$/;
const NOTIFICATION_TYPES = new Set(['merchant_paid_order', 'customer_paid_order']);
const DELIVERY_STATUSES = new Set(['pending', 'sending', 'sent', 'failed']);

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

function optionalText(value, field, maxLength) {
  if (value === null || value === undefined || value === '') return null;
  const normalized = String(value).trim();
  if (!normalized || normalized.length > maxLength || /[\u0000-\u001F\u007F]/.test(normalized)) {
    fail('INVALID_ORDER_NOTIFICATION_DELIVERY', `${field} is invalid.`, { field });
  }
  return normalized;
}

function validateClient(client) {
  for (const method of ['connect', 'query', 'end']) {
    if (typeof client?.[method] !== 'function') {
      fail('INVALID_NEON_CLIENT', `Neon client is missing ${method}().`);
    }
  }
  return client;
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
    claimedAt: row.claimed_at == null ? null : Number(row.claimed_at),
    lastAttemptAt: row.last_attempt_at == null ? null : Number(row.last_attempt_at),
    sentAt: row.sent_at == null ? null : Number(row.sent_at),
    providerMessageId: row.provider_message_id ? String(row.provider_message_id) : null,
    lastErrorCode: row.last_error_code ? String(row.last_error_code) : null,
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
  created_at, updated_at
`;

const INSERT_NOTIFICATION = `
  INSERT INTO legend_commerce.order_notifications (
    order_reference, notification_type, delivery_status, delivery_attempts,
    created_at, updated_at
  ) VALUES ($1, $2, 'pending', 0, $3, $3)
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
      last_error_code = NULL,
      updated_at = $3
  WHERE order_reference = $1
    AND notification_type = $2
    AND delivery_status IN ('pending', 'failed')
  RETURNING ${COLUMNS}
`;

const RECORD_SENT = `
  UPDATE legend_commerce.order_notifications
  SET delivery_status = 'sent',
      sent_at = COALESCE(sent_at, $3),
      provider_message_id = COALESCE(provider_message_id, $4),
      last_error_code = NULL,
      updated_at = $3
  WHERE order_reference = $1
    AND notification_type = $2
    AND delivery_status IN ('sending', 'sent')
  RETURNING ${COLUMNS}
`;

const RECORD_FAILED = `
  UPDATE legend_commerce.order_notifications
  SET delivery_status = 'failed',
      last_error_code = $4,
      updated_at = $3
  WHERE order_reference = $1
    AND notification_type = $2
    AND delivery_status = 'sending'
  RETURNING ${COLUMNS}
`;

export function createNeonOrderNotificationStore({
  connectionString = process.env.DATABASE_URL,
  clientFactory = createDefaultNeonClient,
} = {}) {
  const databaseUrl = validateNeonConnectionString(connectionString);
  if (typeof clientFactory !== 'function') {
    fail('INVALID_NEON_CLIENT_FACTORY', 'A Neon client factory is required.');
  }

  return Object.freeze({
    async ensureNotification({ orderReference, notificationType, createdAt }) {
      const reference = normalizeReference(orderReference);
      const type = normalizeType(notificationType);
      const created = timestamp(createdAt, 'createdAt');
      return withClient(clientFactory, databaseUrl, async (client) => {
        const inserted = await client.query(INSERT_NOTIFICATION, [reference, type, created]);
        const insertedNotification = rowToNotification(inserted.rows?.[0]);
        if (insertedNotification) return Object.freeze({ created: true, notification: insertedNotification });
        const existing = await client.query(SELECT_NOTIFICATION, [reference, type]);
        const notification = rowToNotification(existing.rows?.[0]);
        if (!notification) {
          fail('ORDER_NOTIFICATION_NOT_FOUND', 'Order notification could not be loaded.');
        }
        return Object.freeze({ created: false, notification });
      });
    },

    async claimNotification({ orderReference, notificationType, attemptedAt }) {
      const reference = normalizeReference(orderReference);
      const type = normalizeType(notificationType);
      const attempted = timestamp(attemptedAt, 'attemptedAt');
      return withClient(clientFactory, databaseUrl, async (client) => {
        const claimed = await client.query(CLAIM_NOTIFICATION, [reference, type, attempted]);
        const notification = rowToNotification(claimed.rows?.[0]);
        if (notification) return Object.freeze({ claimed: true, notification });
        const existing = await client.query(SELECT_NOTIFICATION, [reference, type]);
        const current = rowToNotification(existing.rows?.[0]);
        if (!current) fail('ORDER_NOTIFICATION_NOT_FOUND', 'Order notification could not be loaded.');
        return Object.freeze({ claimed: false, notification: current });
      });
    },

    async recordDelivery({
      orderReference,
      notificationType,
      status,
      attemptedAt,
      providerMessageId = null,
      errorCode = null,
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
      if (normalizedStatus === 'sent' && !providerId) {
        fail('INVALID_ORDER_NOTIFICATION_DELIVERY', 'providerMessageId is required for sent delivery.');
      }

      return withClient(clientFactory, databaseUrl, async (client) => {
        const statement = normalizedStatus === 'sent' ? RECORD_SENT : RECORD_FAILED;
        const value = normalizedStatus === 'sent' ? providerId : failureCode;
        const result = await client.query(statement, [reference, type, attempted, value]);
        const notification = rowToNotification(result.rows?.[0]);
        if (!notification) {
          fail('ORDER_NOTIFICATION_STATE_CONFLICT', 'Order notification delivery state changed unexpectedly.');
        }
        return notification;
      });
    },
  });
}

export { NOTIFICATION_TYPES };
