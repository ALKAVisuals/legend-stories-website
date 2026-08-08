import {
  createDefaultNeonClient,
  validateNeonConnectionString,
} from './neon-order-store.mjs';

const REFERENCE_PATTERN = /^[a-f0-9]{64}$/;
const PAYPAL_ORDER_ID_PATTERN = /^[A-Z0-9]{1,36}$/;

export class NeonPayPalCaptureStoreError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = 'NeonPayPalCaptureStoreError';
    this.code = code;
    this.details = details;
  }
}

function fail(code, message, details) {
  throw new NeonPayPalCaptureStoreError(code, message, details);
}

function integer(value, field) {
  const normalized = Number(value);
  if (!Number.isInteger(normalized) || normalized < 0) {
    fail('INVALID_PAYPAL_CAPTURE', `${field} is invalid.`, { field });
  }
  return normalized;
}

function normalizeCapture(input = {}) {
  const reference = String(input.reference || '').trim().toLowerCase();
  const orderId = String(input.orderId || '').trim().toUpperCase();
  const currency = String(input.currency || '').trim().toUpperCase();
  const mode = String(input.mode || '').trim();
  if (!REFERENCE_PATTERN.test(reference)) {
    fail('INVALID_PAYPAL_CAPTURE', 'PayPal capture reference is invalid.');
  }
  if (!PAYPAL_ORDER_ID_PATTERN.test(orderId)) {
    fail('INVALID_PAYPAL_CAPTURE', 'PayPal order ID is invalid.');
  }
  if (currency !== 'EUR') {
    fail('INVALID_PAYPAL_CAPTURE', 'PayPal capture currency is invalid.');
  }
  if (!['test', 'live'].includes(mode)) {
    fail('INVALID_PAYPAL_CAPTURE', 'PayPal capture mode is invalid.');
  }
  return Object.freeze({
    reference,
    orderId,
    amountTotal: integer(input.amountTotal, 'PayPal capture amount'),
    currency,
    mode,
    capturedAt: integer(input.capturedAt, 'PayPal capture timestamp'),
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
  if (error instanceof NeonPayPalCaptureStoreError) return error;
  if (error?.code === '40001' || error?.code === '40P01') {
    return new NeonPayPalCaptureStoreError(
      'PAYPAL_CAPTURE_STORE_RETRYABLE',
      'The PayPal capture transaction must be retried.',
      { sqlState: error.code },
    );
  }
  if (error?.code && String(error.code).length !== 5) return error;
  return new NeonPayPalCaptureStoreError(
    'PAYPAL_CAPTURE_STORE_UNAVAILABLE',
    'The PayPal capture store is unavailable.',
    { sqlState: error?.code || '' },
  );
}

const SELECT_ORDER_FOR_UPDATE = `
  SELECT *
  FROM legend_commerce.orders
  WHERE reference = $1
  FOR UPDATE
`;

const UPDATE_PAYPAL_CAPTURE = `
  UPDATE legend_commerce.orders
  SET status = 'paid',
      updated_at = $3,
      paid_at = COALESCE(paid_at, $3),
      version = version + 1
  WHERE reference = $1 AND version = $2
  RETURNING *
`;

export function createNeonPayPalCaptureStore({
  connectionString = process.env.DATABASE_URL,
  clientFactory = createDefaultNeonClient,
} = {}) {
  const databaseUrl = validateNeonConnectionString(connectionString);
  if (typeof clientFactory !== 'function') {
    fail('INVALID_NEON_CLIENT_FACTORY', 'A Neon client factory is required.');
  }

  return Object.freeze({
    async processPaypalCapture(captureInput) {
      const capture = normalizeCapture(captureInput);
      let lastError;

      for (let attempt = 1; attempt <= 4; attempt += 1) {
        const client = validateClient(await clientFactory(databaseUrl));
        let transactionStarted = false;
        try {
          await client.connect();
          await client.query('BEGIN ISOLATION LEVEL SERIALIZABLE');
          transactionStarted = true;
          const currentResult = await client.query(SELECT_ORDER_FOR_UPDATE, [capture.reference]);
          const current = rowToOrder(currentResult.rows?.[0]);
          if (!current) {
            const notFound = new Error('Referenced order does not exist.');
            notFound.code = 'ORDER_NOT_FOUND';
            throw notFound;
          }
          if (current.paymentSessionId !== capture.orderId
            || current.amountTotal !== capture.amountTotal
            || current.currency !== capture.currency
            || current.mode !== capture.mode) {
            fail('PAYPAL_CAPTURE_ORDER_MISMATCH', 'PayPal capture does not match the reserved order.');
          }

          if (current.status === 'paid') {
            await client.query('COMMIT');
            transactionStarted = false;
            return { duplicate: true, order: structuredClone(current) };
          }

          const updatedAt = Math.max(current.updatedAt, capture.capturedAt);
          const updateResult = await client.query(UPDATE_PAYPAL_CAPTURE, [
            capture.reference,
            current.version,
            updatedAt,
          ]);
          const updated = rowToOrder(updateResult.rows?.[0]);
          if (!updated) {
            fail('PAYPAL_CAPTURE_STORE_RETRYABLE', 'The order version changed during PayPal capture.');
          }
          await client.query('COMMIT');
          transactionStarted = false;
          return { duplicate: false, order: structuredClone(updated) };
        } catch (error) {
          if (transactionStarted) {
            try {
              await client.query('ROLLBACK');
            } catch {
              // Preserve the original error.
            }
          }
          const normalized = normalizeDatabaseError(error);
          lastError = normalized;
          const retryable = normalized instanceof NeonPayPalCaptureStoreError
            && normalized.code === 'PAYPAL_CAPTURE_STORE_RETRYABLE';
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
