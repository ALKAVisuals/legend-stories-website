import {
  createDefaultNeonClient,
  validateNeonConnectionString,
} from './neon-order-store.mjs';

const REFERENCE_PATTERN = /^[a-f0-9]{64}$/;
const PAYPAL_ORDER_ID_PATTERN = /^[A-Z0-9]{1,36}$/;
const PAYPAL_CAPTURE_ID_PATTERN = /^[A-Z0-9]{1,128}$/;
const EVENT_ID_PATTERN = /^[A-Za-z0-9_-]{1,128}$/;
const EVENT_TYPE_PATTERN = /^[A-Z0-9._-]{1,128}$/;
const ORDER_STATUSES = new Set([
  'payment_pending',
  'payment_processing',
  'payment_failed',
  'expired',
  'paid',
]);

export class NeonPayPalWebhookStoreError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = 'NeonPayPalWebhookStoreError';
    this.code = code;
    this.details = details;
  }
}

function fail(code, message, details) {
  throw new NeonPayPalWebhookStoreError(code, message, details);
}

function integer(value, field) {
  const normalized = Number(value);
  if (!Number.isInteger(normalized) || normalized < 0) {
    fail('INVALID_PAYPAL_WEBHOOK_EVENT', `${field} is invalid.`, { field });
  }
  return normalized;
}

function optionalInteger(value, field) {
  if (value === null || value === undefined) return null;
  return integer(value, field);
}

function normalizeEvent(input = {}) {
  const eventId = String(input.eventId || '').trim();
  const eventType = String(input.eventType || '').trim().toUpperCase();
  const reference = String(input.reference || '').trim().toLowerCase();
  const orderId = String(input.orderId || '').trim().toUpperCase();
  const captureId = input.captureId == null
    ? null
    : String(input.captureId || '').trim().toUpperCase();
  const mode = String(input.mode || '').trim();
  const currency = input.currency == null
    ? null
    : String(input.currency || '').trim().toUpperCase();
  const targetStatus = input.targetStatus == null
    ? null
    : String(input.targetStatus || '').trim();

  if (!EVENT_ID_PATTERN.test(eventId)) {
    fail('INVALID_PAYPAL_WEBHOOK_EVENT', 'PayPal webhook event ID is invalid.');
  }
  if (!EVENT_TYPE_PATTERN.test(eventType)) {
    fail('INVALID_PAYPAL_WEBHOOK_EVENT', 'PayPal webhook event type is invalid.');
  }
  if (!REFERENCE_PATTERN.test(reference)) {
    fail('INVALID_PAYPAL_WEBHOOK_EVENT', 'PayPal webhook order reference is invalid.');
  }
  if (!PAYPAL_ORDER_ID_PATTERN.test(orderId)) {
    fail('INVALID_PAYPAL_WEBHOOK_EVENT', 'PayPal webhook order ID is invalid.');
  }
  if (captureId !== null && !PAYPAL_CAPTURE_ID_PATTERN.test(captureId)) {
    fail('INVALID_PAYPAL_WEBHOOK_EVENT', 'PayPal webhook capture ID is invalid.');
  }
  if (!['test', 'live'].includes(mode)) {
    fail('INVALID_PAYPAL_WEBHOOK_EVENT', 'PayPal webhook mode is invalid.');
  }
  if (currency !== null && currency !== 'EUR') {
    fail('INVALID_PAYPAL_WEBHOOK_EVENT', 'PayPal webhook currency is invalid.');
  }
  if (targetStatus !== null && !ORDER_STATUSES.has(targetStatus)) {
    fail('INVALID_PAYPAL_WEBHOOK_EVENT', 'PayPal webhook target status is invalid.');
  }

  const createdAt = integer(input.createdAt, 'PayPal webhook event timestamp');
  return Object.freeze({
    eventId,
    eventType,
    reference,
    orderId,
    captureId,
    mode,
    createdAt,
    mutationAt: integer(input.mutationAt ?? createdAt, 'PayPal webhook mutation timestamp'),
    amountTotal: optionalInteger(input.amountTotal, 'PayPal webhook amount'),
    currency,
    targetStatus,
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

function rowToOrder(row) {
  if (!row || typeof row !== 'object') return null;
  return {
    reference: String(row.reference || ''),
    status: String(row.status || ''),
    amountTotal: Number(row.amount_total),
    currency: String(row.currency || '').toUpperCase(),
    mode: String(row.mode || ''),
    paymentSessionId: String(row.payment_session_id || ''),
    createdAt: Number(row.created_at),
    updatedAt: Number(row.updated_at),
    paidAt: row.paid_at === null ? null : Number(row.paid_at),
    lastStripeEventId: row.last_stripe_event_id || undefined,
    lastStripeEventType: row.last_stripe_event_type || undefined,
    lastStripeEventCreated: Number(row.last_stripe_event_created || 0),
    version: Number(row.version),
    customer: structuredClone(row.customer),
    items: structuredClone(row.items),
    discount: structuredClone(row.discount),
    shipping: structuredClone(row.shipping),
    totals: structuredClone(row.totals),
  };
}

function normalizeDatabaseError(error) {
  if (error instanceof NeonPayPalWebhookStoreError) return error;
  if (error?.code === '40001' || error?.code === '40P01') {
    return new NeonPayPalWebhookStoreError(
      'PAYPAL_WEBHOOK_STORE_RETRYABLE',
      'The PayPal webhook transaction must be retried.',
      { sqlState: error.code },
    );
  }
  if (error?.code && String(error.code).length !== 5) return error;
  return new NeonPayPalWebhookStoreError(
    'PAYPAL_WEBHOOK_STORE_UNAVAILABLE',
    'The PayPal webhook store is unavailable.',
    { sqlState: error?.code || '' },
  );
}

function sameNullable(left, right) {
  return (left ?? null) === (right ?? null);
}

function assertStoredEventMatches(row, event) {
  if (!row
    || String(row.event_type || '') !== event.eventType
    || String(row.order_reference || '') !== event.reference
    || String(row.paypal_order_id || '') !== event.orderId
    || !sameNullable(row.paypal_capture_id, event.captureId)
    || String(row.mode || '') !== event.mode
    || Number(row.paypal_created_at) !== event.createdAt) {
    fail(
      'PAYPAL_WEBHOOK_EVENT_CONFLICT',
      'PayPal webhook event ID already exists with different identity data.',
    );
  }
}

function assertEventMatchesOrder(row, event) {
  if (String(row.payment_provider || '') !== 'paypal'
    || String(row.payment_session_id || '') !== event.orderId
    || String(row.mode || '') !== event.mode
    || (event.amountTotal !== null && Number(row.amount_total) !== event.amountTotal)
    || (event.currency !== null && String(row.currency || '').toUpperCase() !== event.currency)) {
    fail(
      'PAYPAL_WEBHOOK_ORDER_MISMATCH',
      'PayPal webhook event does not match the reserved order.',
    );
  }
}

function resolveNextStatus(current, event) {
  if (current.status === 'paid') return 'paid';
  if (event.targetStatus === null) return current.status;
  if (event.targetStatus === 'paid') return 'paid';
  if (event.createdAt < current.updatedAt) return current.status;
  if (current.status === 'expired') return 'expired';

  const allowed = {
    payment_pending: new Set(['payment_processing', 'payment_failed']),
    payment_processing: new Set(['payment_failed']),
    payment_failed: new Set(),
  };
  return allowed[current.status]?.has(event.targetStatus)
    ? event.targetStatus
    : current.status;
}

const SELECT_ORDER_FOR_UPDATE = `
  SELECT *
  FROM legend_commerce.orders
  WHERE reference = $1
  FOR UPDATE
`;

const INSERT_PAYPAL_EVENT = `
  INSERT INTO legend_commerce.paypal_webhook_events (
    event_id, event_type, order_reference, paypal_order_id,
    paypal_capture_id, mode, paypal_created_at, processed_at
  ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
  ON CONFLICT (event_id) DO NOTHING
  RETURNING event_id
`;

const SELECT_PAYPAL_EVENT = `
  SELECT event_id, event_type, order_reference, paypal_order_id,
         paypal_capture_id, mode, paypal_created_at
  FROM legend_commerce.paypal_webhook_events
  WHERE event_id = $1
  FOR SHARE
`;

const UPDATE_ORDER_STATUS = `
  UPDATE legend_commerce.orders
  SET status = $3,
      updated_at = $4,
      paid_at = $5,
      version = version + 1
  WHERE reference = $1 AND version = $2
  RETURNING *
`;

export function createNeonPayPalWebhookStore({
  connectionString = process.env.DATABASE_URL,
  clientFactory = createDefaultNeonClient,
  now = () => Math.floor(Date.now() / 1000),
} = {}) {
  const databaseUrl = validateNeonConnectionString(connectionString);
  if (typeof clientFactory !== 'function') {
    fail('INVALID_NEON_CLIENT_FACTORY', 'A Neon client factory is required.');
  }
  if (typeof now !== 'function') {
    fail('INVALID_CLOCK', 'A PayPal webhook store clock is required.');
  }

  return Object.freeze({
    async processPaypalWebhookEvent(eventInput) {
      const event = normalizeEvent(eventInput);
      let lastError;

      for (let attempt = 1; attempt <= 4; attempt += 1) {
        const client = validateClient(await clientFactory(databaseUrl));
        let transactionStarted = false;
        try {
          await client.connect();
          await client.query('BEGIN ISOLATION LEVEL SERIALIZABLE');
          transactionStarted = true;

          const currentResult = await client.query(SELECT_ORDER_FOR_UPDATE, [event.reference]);
          const currentRow = currentResult.rows?.[0];
          const current = rowToOrder(currentRow);
          if (!current) {
            const notFound = new Error('Referenced order does not exist.');
            notFound.code = 'ORDER_NOT_FOUND';
            throw notFound;
          }
          assertEventMatchesOrder(currentRow, event);

          const reserved = await client.query(INSERT_PAYPAL_EVENT, [
            event.eventId,
            event.eventType,
            event.reference,
            event.orderId,
            event.captureId,
            event.mode,
            event.createdAt,
            integer(now(), 'PayPal webhook processed timestamp'),
          ]);

          if (reserved.rows?.length === 0) {
            const existingResult = await client.query(SELECT_PAYPAL_EVENT, [event.eventId]);
            assertStoredEventMatches(existingResult.rows?.[0], event);
            await client.query('COMMIT');
            transactionStarted = false;
            return { duplicate: true, order: structuredClone(current) };
          }

          const nextStatus = resolveNextStatus(current, event);
          if (nextStatus === current.status) {
            await client.query('COMMIT');
            transactionStarted = false;
            return { duplicate: false, order: structuredClone(current) };
          }

          const updatedAt = Math.max(current.updatedAt, event.mutationAt);
          const paidAt = nextStatus === 'paid'
            ? (current.paidAt ?? event.mutationAt)
            : current.paidAt;
          const updateResult = await client.query(UPDATE_ORDER_STATUS, [
            current.reference,
            current.version,
            nextStatus,
            updatedAt,
            paidAt,
          ]);
          const updated = rowToOrder(updateResult.rows?.[0]);
          if (!updated) {
            fail(
              'PAYPAL_WEBHOOK_STORE_RETRYABLE',
              'The order version changed during PayPal webhook processing.',
            );
          }

          await client.query('COMMIT');
          transactionStarted = false;
          return { duplicate: false, order: structuredClone(updated) };
        } catch (error) {
          if (transactionStarted) {
            try {
              await client.query('ROLLBACK');
            } catch {
              // Preserve the original transaction error.
            }
          }
          const normalized = normalizeDatabaseError(error);
          lastError = normalized;
          const retryable = normalized instanceof NeonPayPalWebhookStoreError
            && normalized.code === 'PAYPAL_WEBHOOK_STORE_RETRYABLE';
          if (!retryable || attempt === 4) throw normalized;
        } finally {
          try {
            await client.end();
          } catch {
            // Closing a failed serverless connection must not mask the original error.
          }
        }

        await new Promise((resolve) => setTimeout(resolve, 15 * (2 ** (attempt - 1))));
      }

      throw lastError;
    },
  });
}
