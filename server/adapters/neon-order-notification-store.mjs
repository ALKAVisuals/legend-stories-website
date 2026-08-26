import {
  createDefaultNeonClient,
  validateNeonConnectionString,
} from './neon-order-store.mjs';

const REFERENCE_PATTERN = /^[a-f0-9]{64}$/;
const NOTIFICATION_TYPES = new Set(['merchant_paid_order', 'customer_paid_order']);
const DELIVERY_STATUSES = new Set(['pending', 'sent', 'failed']);

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

function integer(value, field) {
  const normalized = Number(value);
  if (!Number.isInteger(normalized) || normalized < 0) {
    fail('INVALID_ORDER_NOTIFICATION', `${field} is invalid.`, { field });
  }
  return normalized;
}

function optionalText(value, field, maxLength) {
  if (value === null || value === undefined || value === '') return null;
  const normalized = String(value).trim();
  if (!normalized || normalized.length > maxLength || /[\u0000-\u001F\u007F]/.test(normalized)) {
    fail('INVALID_ORDER_NOTIFICATION', `${field} is invalid.`, { field });
  }
  return normalized;
}

function normalizeReference(value) {
  const reference = String(value || '').trim().toLowerCase();
  if (!REFERENCE_PATTERN.test(reference)) {
    fail('INVALID_ORDER_NOTIFICATION', 'Order reference is invalid.', { field: 'orderReference' });
  }
  return reference;
}

function normalizeType(value) {
  const notificationType = String(value || '').trim();
  if (!NOTIFICATION_TYPES.has(notificationType)) {
    fail('INVALID_ORDER_NOTIFICATION', 'Notification type is invalid.', { field: 'notificationType' });
  }
  return notificationType;
}

function validateClient(client) {
  for (const method of ['connect', 'query', 'end']) {
    if (typeof client?.[method] !== 'function') {
      fail('INVALID_NEON_CLIENT', `Neon client is missing ${method}().`, { method });
    }
  }
  return client;
}

function rowToNotification(row) {
  if (!row || typeof row !== 'object') return null;
  const status = String(row.delivery_status || '');
  if (!DELIVERY_STATUSES.has(status)) {
    fail('INVALID_ORDER_NOTIFICATION_STORE_RESULT', 'Stored notification status is invalid.');
  }
  return Object.freeze({
    orderReference: normalizeReference(row.order_reference),
    notificationType: normalizeType(row.notification_type),
    deliveryStatus: status,
    deliveryAttempts: integer(row.delivery_attempts, 'Delivery attempts'),
    reservedAt: integer(row.reserved_at, 'Reserved timestamp'),
    lastAttemptAt: row.last_attempt_at === null ? null : integer(row.last_attempt_at, 'Last attempt timestamp'),
    sentAt: row.sent_at === null ? null : integer(row.sent_at, 'Sent timestamp'),
    providerMessageId: row.provider_message_id ? String(row.provider_message_id) : null,
    lastErrorCode: row.last_error_code ? String(row.last_error_code) : null,
    createdAt: integer(row.created_at, 'Created timestamp'),
    updatedAt: integer(row.updated_at, 'Updated timestamp'),
  });
}

function normalizeDatabaseError(error) {
  if (error instanceof NeonOrderNotificationStoreError) return error;
  if (error?.code === '23503') {
    return new NeonOrderNotificationStoreError(
      'ORDER_NOTIFICATION_ORDER_NOT_FOUND',
      'The referenced order does not exist.',
    );
  }
  if (error?.code && String(error.code).length !== 5) return error;
  return new NeonOrderNotificationStoreError(
    'ORDER_NOTIFICATION_STORE_UNAVAILABLE',
    'The order notification store is unavailable.',
    { sqlState: error?.code || '' },
  );
}

async function closeClient(client) {
  try {
    await client.end();
  } catch {
    // Closing a failed serverless connection must not replace the original error.
  }
}

async function withClient(clientFactory, connectionString, action) {
  const client = validateClient(await clientFactory(connectionString));
  try {
    await client.connect();
    return await action(client);
  } catch (error) {
    throw normalizeDatabaseError(error);
  } finally {
    await closeClient(client);
  }
}

const NOTIFICATION_COLUMNS = `
  order_reference, notification_type, delivery_status, delivery_attempts,
  reserved_at, last_attempt_at, sent_at, provider_message_id, last_error_code,
  created_at, updated_at
`;

const INSERT_NOTIFICATION = `
  INSERT INTO legend_commerce.order_notifications (
    order_reference, notification_type, delivery_status, delivery_attempts,
    reserved_at, created_at, updated_at
  ) VALUES ($1, $2, 'pending', 0, $3, $3, $3)
  ON CONFLICT (order_reference, notification_type) DO NOTHING
  RETURNING ${NOTIFICATION_COLUMNS}
`;

const SELECT_NOTIFICATION = `
  SELECT ${NOTIFICATION_COLUMNS}
  FROM legend_commerce.order_notifications
  WHERE order_reference = $1 AND notification_type = $2
`;

const UPDATE_DELIVERY = `
  UPDATE legend_commerce.order_notifications
  SET
    delivery_status = $3,
    delivery_attempts = delivery_attempts + 1,
    last_attempt_at = $4,
    sent_at = CASE WHEN $3 = 'sent' THEN COALESCE(sent_at, $4) ELSE sent_at END,
    provider_message_id = CASE WHEN $3 = 'sent' THEN COALESCE(provider_message_id, $5) ELSE provider_message_id END,
    last_error_code = CASE WHEN $3 = 'failed' THEN $6 ELSE NULL END,
    updated_at = $4
  WHERE order_reference = $1
    AND notification_type = $2
    AND delivery_status <> 'sent'
  RETURNING ${NOTIFICATION_COLUMNS}
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
    async reserveOrderNotification({ orderReference, notificationType, reservedAt }) {
      const reference = normalizeReference(orderReference);
      const type = normalizeType(notificationType);
      const timestamp = integer(reservedAt, 'Reserved timestamp');

      return withClient(clientFactory, databaseUrl, async (client) => {
        const inserted = await client.query(INSERT_NOTIFICATION, [reference, type, timestamp]);
        if (inserted.rows?.length === 1) {
          return Object.freeze({ created: true, notification: rowToNotification(inserted.rows[0]) });
        }

        const existing = await client.query(SELECT_NOTIFICATION, [reference, type]);
        const notification = rowToNotification(existing.rows?.[0]);
        if (!notification) {
          fail('ORDER_NOTIFICATION_STORE_CONFLICT', 'Existing notification reservation could not be loaded.');
        }
        return Object.freeze({ created: false, notification });
      });
    },

    async getOrderNotification({ orderReference, notificationType }) {
      const reference = normalizeReference(orderReference);
      const type = normalizeType(notificationType);
      return withClient(clientFactory, databaseUrl, async (client) => {
        const result = await client.query(SELECT_NOTIFICATION, [reference, type]);
        return rowToNotification(result.rows?.[0]);
      });
    },

    async recordOrderNotificationDelivery({
      orderReference,
      notificationType,
      status,
      attemptedAt,
      providerMessageId = null,
      errorCode = null,
    }) {
      const reference = normalizeReference(orderReference);
      const type = normalizeType(notificationType);
      const normalizedStatus = String(status || '').trim().toLowerCase();
      if (!['sent', 'failed'].includes(normalizedStatus)) {
        fail('INVALID_ORDER_NOTIFICATION', 'Delivery status is invalid.', { field: 'status' });
      }
      const timestamp = integer(attemptedAt, 'Attempt timestamp');
      const normalizedProviderMessageId = normalizedStatus === 'sent'
        ? optionalText(providerMessageId, 'providerMessageId', 200)
        : null;
      if (normalizedStatus === 'sent' && !normalizedProviderMessageId) {
        fail('INVALID_ORDER_NOTIFICATION', 'providerMessageId is required for sent delivery.', {
          field: 'providerMessageId',
        });
      }
      const normalizedErrorCode = normalizedStatus === 'failed'
        ? (optionalText(errorCode || 'UNKNOWN', 'errorCode', 120) || 'UNKNOWN')
        : null;

      return withClient(clientFactory, databaseUrl, async (client) => {
        const updated = await client.query(UPDATE_DELIVERY, [
          reference,
          type,
          normalizedStatus,
          timestamp,
          normalizedProviderMessageId,
          normalizedErrorCode,
        ]);
        if (updated.rows?.length === 1) {
          return Object.freeze({ changed: true, notification: rowToNotification(updated.rows[0]) });
        }

        const existing = await client.query(SELECT_NOTIFICATION, [reference, type]);
        const notification = rowToNotification(existing.rows?.[0]);
        if (!notification) {
          fail('ORDER_NOTIFICATION_NOT_FOUND', 'Order notification reservation was not found.');
        }
        if (notification.deliveryStatus === 'sent') {
          return Object.freeze({ changed: false, notification });
        }
        fail('ORDER_NOTIFICATION_STORE_CONFLICT', 'Order notification delivery state could not be updated.');
      });
    },
  });
}
