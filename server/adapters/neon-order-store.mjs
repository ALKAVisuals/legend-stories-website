const REFERENCE_PATTERN = /^[a-f0-9]{64}$/;
const ORDER_STATUSES = new Set([
  'payment_pending',
  'payment_processing',
  'payment_failed',
  'expired',
  'paid',
]);

export class NeonOrderStoreError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = 'NeonOrderStoreError';
    this.code = code;
    this.details = details;
  }
}

function fail(code, message, details) {
  throw new NeonOrderStoreError(code, message, details);
}

function clone(value) {
  return structuredClone(value);
}

function serializeJsonb(value, field) {
  const serialized = JSON.stringify(clone(value));
  if (serialized === undefined) {
    fail('INVALID_ORDER_STORE_RECORD', `Stored ${field} is not JSON serializable.`, { field });
  }
  return serialized;
}

function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [key, canonicalize(value[key])]),
    );
  }
  return value;
}

function sameValue(left, right) {
  return JSON.stringify(canonicalize(left)) === JSON.stringify(canonicalize(right));
}

function integer(value, field, { nullable = false } = {}) {
  if (nullable && (value === null || value === undefined)) return null;
  const normalized = Number(value);
  if (!Number.isInteger(normalized) || normalized < 0) {
    fail('INVALID_ORDER_STORE_RECORD', `Stored ${field} is invalid.`, { field });
  }
  return normalized;
}

function validateReference(reference) {
  const normalized = String(reference || '').trim().toLowerCase();
  if (!REFERENCE_PATTERN.test(normalized)) {
    fail('INVALID_ORDER_REFERENCE', 'Order reference is invalid.');
  }
  return normalized;
}

function validateClient(client) {
  for (const method of ['connect', 'query', 'end']) {
    if (typeof client?.[method] !== 'function') {
      fail('INVALID_NEON_CLIENT', `Neon client is missing ${method}().`, { method });
    }
  }
  return client;
}

export function validateNeonConnectionString(value) {
  const source = String(value || '').trim();
  if (!source) {
    fail('DATABASE_URL_NOT_CONFIGURED', 'DATABASE_URL is not configured.');
  }

  let url;
  try {
    url = new URL(source);
  } catch {
    fail('INVALID_DATABASE_URL', 'DATABASE_URL must be a valid PostgreSQL URL.');
  }

  if (!['postgres:', 'postgresql:'].includes(url.protocol)) {
    fail('INVALID_DATABASE_URL', 'DATABASE_URL must use the PostgreSQL protocol.');
  }
  if (!url.hostname.endsWith('.neon.tech')) {
    fail('INVALID_DATABASE_URL', 'DATABASE_URL must target a Neon Postgres host.');
  }
  if (!url.username || !url.password || !url.pathname || url.pathname === '/') {
    fail('INVALID_DATABASE_URL', 'DATABASE_URL is missing database credentials or a database name.');
  }
  const sslMode = url.searchParams.get('sslmode');
  if (!['require', 'verify-full'].includes(sslMode)) {
    fail('INVALID_DATABASE_URL', 'DATABASE_URL must require TLS.', { sslMode });
  }

  return source;
}

export async function createDefaultNeonClient(connectionString) {
  let neonModule;
  let websocketModule;
  try {
    [neonModule, websocketModule] = await Promise.all([
      import('@neondatabase/serverless'),
      import('ws'),
    ]);
  } catch {
    fail(
      'NEON_DRIVER_NOT_INSTALLED',
      'The Neon runtime driver is not installed. Install the pinned driver during the activation sprint.',
    );
  }

  const WebSocket = websocketModule.default || websocketModule.WebSocket;
  if (!neonModule.Client || !neonModule.neonConfig || !WebSocket) {
    fail('INVALID_NEON_DRIVER', 'The installed Neon driver does not expose the required Client API.');
  }
  neonModule.neonConfig.webSocketConstructor = WebSocket;
  return new neonModule.Client({ connectionString });
}

function normalizePendingOrder(orderInput) {
  const source = clone(orderInput || {});
  const status = String(source.status || '');
  if (!ORDER_STATUSES.has(status)) {
    fail('INVALID_ORDER_STORE_RECORD', 'Pending order status is invalid.', { status });
  }

  const order = {
    reference: validateReference(source.reference),
    status,
    amountTotal: integer(source.amountTotal, 'amount total'),
    currency: String(source.currency || '').toUpperCase(),
    mode: String(source.mode || ''),
    paymentSessionId: String(source.paymentSessionId || ''),
    createdAt: integer(source.createdAt, 'created timestamp'),
    updatedAt: integer(source.updatedAt, 'updated timestamp'),
    paidAt: integer(source.paidAt, 'paid timestamp', { nullable: true }),
    lastStripeEventCreated: integer(
      source.lastStripeEventCreated ?? 0,
      'last Stripe event timestamp',
    ),
    version: integer(source.version, 'version'),
    customer: clone(source.customer),
    items: clone(source.items),
    discount: clone(source.discount),
    shipping: clone(source.shipping),
    totals: clone(source.totals),
    documentProfileVersion: integer(source.documentProfileVersion ?? 0, 'document profile version'),
  };
  if (source.lastStripeEventId) order.lastStripeEventId = String(source.lastStripeEventId);
  if (source.lastStripeEventType) order.lastStripeEventType = String(source.lastStripeEventType);
  return order;
}

function rowToOrder(row) {
  if (!row || typeof row !== 'object') return null;
  return normalizePendingOrder({
    reference: row.reference,
    status: row.status,
    amountTotal: row.amount_total,
    currency: row.currency,
    mode: row.mode,
    paymentSessionId: row.payment_session_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    paidAt: row.paid_at,
    lastStripeEventId: row.last_stripe_event_id || undefined,
    lastStripeEventType: row.last_stripe_event_type || undefined,
    lastStripeEventCreated: row.last_stripe_event_created ?? 0,
    version: row.version,
    customer: row.customer,
    items: row.items,
    discount: row.discount,
    shipping: row.shipping,
    totals: row.totals,
    documentProfileVersion: row.document_profile_version ?? 0,
  });
}

function pendingOrderValues(order) {
  return [
    order.reference,
    order.status,
    order.amountTotal,
    order.currency,
    order.mode,
    order.paymentSessionId,
    order.createdAt,
    order.updatedAt,
    order.paidAt,
    order.lastStripeEventId || null,
    order.lastStripeEventType || null,
    order.lastStripeEventCreated,
    order.version,
    serializeJsonb(order.customer, 'customer'),
    serializeJsonb(order.items, 'items'),
    serializeJsonb(order.discount, 'discount'),
    serializeJsonb(order.shipping, 'shipping'),
    serializeJsonb(order.totals, 'totals'),
  ];
}

function assertSamePendingOrder(actual, expected) {
  if (!sameValue(actual, expected)) {
    fail(
      'ORDER_STORE_CONFLICT',
      'A different order already exists for this checkout reference.',
      { reference: expected.reference },
    );
  }
}

function normalizeDatabaseError(error) {
  if (error instanceof NeonOrderStoreError) return error;
  if (error?.code && String(error.code).length !== 5) return error;
  if (error?.code === '40001' || error?.code === '40P01') {
    return new NeonOrderStoreError(
      'ORDER_STORE_RETRYABLE',
      'The database transaction must be retried.',
      { sqlState: error.code },
    );
  }
  if (error?.code === '23505') {
    return new NeonOrderStoreError(
      'ORDER_STORE_CONFLICT',
      'A conflicting unique order value already exists.',
      { constraint: error.constraint || '' },
    );
  }
  return new NeonOrderStoreError(
    'ORDER_STORE_UNAVAILABLE',
    'The durable order store is unavailable.',
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

const MAX_SERIALIZABLE_ATTEMPTS = 4;
const SERIALIZABLE_RETRY_BASE_DELAY_MS = 15;

function isRetryableTransactionError(error) {
  return error instanceof NeonOrderStoreError
    && error.code === 'ORDER_STORE_RETRYABLE';
}

function transactionRetryDelay(attempt) {
  return SERIALIZABLE_RETRY_BASE_DELAY_MS * (2 ** (attempt - 1));
}

async function waitForTransactionRetry(attempt) {
  await new Promise((resolve) => {
    setTimeout(resolve, transactionRetryDelay(attempt));
  });
}

async function withSerializableTransaction(clientFactory, connectionString, action) {
  let lastError;

  for (let attempt = 1; attempt <= MAX_SERIALIZABLE_ATTEMPTS; attempt += 1) {
    const client = validateClient(await clientFactory(connectionString));
    let transactionStarted = false;
    try {
      await client.connect();
      await client.query('BEGIN ISOLATION LEVEL SERIALIZABLE');
      transactionStarted = true;
      const result = await action(client);
      await client.query('COMMIT');
      transactionStarted = false;
      return result;
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
      if (!isRetryableTransactionError(normalized)
        || attempt === MAX_SERIALIZABLE_ATTEMPTS) {
        throw normalized;
      }
    } finally {
      await closeClient(client);
    }

    await waitForTransactionRetry(attempt);
  }

  throw lastError;
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

const INSERT_PENDING_ORDER = `
  INSERT INTO legend_commerce.orders (
    reference, status, amount_total, currency, mode, payment_session_id,
    created_at, updated_at, paid_at, last_stripe_event_id,
    last_stripe_event_type, last_stripe_event_created, version,
    customer, items, discount, shipping, totals
  ) VALUES (
    $1, $2, $3, $4, $5, $6,
    $7, $8, $9, $10,
    $11, $12, $13,
    $14::jsonb, $15::jsonb, $16::jsonb, $17::jsonb, $18::jsonb
  )
  ON CONFLICT (reference) DO NOTHING
  RETURNING *
`;

const SELECT_ORDER = `
  SELECT *
  FROM legend_commerce.orders
  WHERE reference = $1
`;

const SELECT_ORDER_FOR_UPDATE = `${SELECT_ORDER} FOR UPDATE`;

export function createNeonOrderStore({
  connectionString = process.env.DATABASE_URL,
  clientFactory = createDefaultNeonClient,
} = {}) {
  const databaseUrl = validateNeonConnectionString(connectionString);
  if (typeof clientFactory !== 'function') {
    fail('INVALID_NEON_CLIENT_FACTORY', 'A Neon client factory is required.');
  }

  return Object.freeze({
    async persistPendingCheckout(orderInput) {
      const expected = normalizePendingOrder(orderInput);
      return withSerializableTransaction(clientFactory, databaseUrl, async (client) => {
        const inserted = await client.query(INSERT_PENDING_ORDER, pendingOrderValues(expected));
        if (inserted.rows?.length === 1) {
          const order = rowToOrder(inserted.rows[0]);
          assertSamePendingOrder(order, expected);
          return { created: true, order: clone(order) };
        }

        const existingResult = await client.query(
          SELECT_ORDER_FOR_UPDATE,
          [expected.reference],
        );
        const existing = rowToOrder(existingResult.rows?.[0]);
        if (!existing) {
          fail('ORDER_STORE_CONFLICT', 'The existing checkout order could not be loaded.');
        }
        assertSamePendingOrder(existing, expected);
        return { created: false, order: clone(existing) };
      });
    },

    async getOrderByReference(referenceInput) {
      const reference = validateReference(referenceInput);
      return withClient(clientFactory, databaseUrl, async (client) => {
        const result = await client.query(SELECT_ORDER, [reference]);
        const order = rowToOrder(result.rows?.[0]);
        return order ? clone(order) : null;
      });
    },
  });
}
