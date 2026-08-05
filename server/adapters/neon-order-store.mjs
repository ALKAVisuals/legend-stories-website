const REFERENCE_PATTERN = /^[a-f0-9]{64}$/;
const STRIPE_EVENT_PATTERN = /^evt_[A-Za-z0-9_-]+$/;
const ORDER_STATUSES = new Set([
  'payment_pending',
  'payment_processing',
  'payment_failed',
  'expired',
  'paid',
]);
const IMMUTABLE_ORDER_FIELDS = Object.freeze([
  'reference',
  'amountTotal',
  'currency',
  'mode',
  'paymentSessionId',
  'createdAt',
  'customer',
  'items',
  'discount',
  'shipping',
  'totals',
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

function assertSafeUpdate(current, updated) {
  if (!updated || typeof updated !== 'object') {
    fail('INVALID_ORDER_UPDATE', 'The order update callback returned no order.');
  }
  for (const field of IMMUTABLE_ORDER_FIELDS) {
    if (!sameValue(updated[field], current[field])) {
      fail('INVALID_ORDER_UPDATE', `The order update changed immutable ${field}.`, { field });
    }
  }
  if (!ORDER_STATUSES.has(updated.status)) {
    fail('INVALID_ORDER_UPDATE', 'The order update status is invalid.');
  }
  if (updated.version !== current.version + 1) {
    fail('INVALID_ORDER_UPDATE', 'The order update must increment version exactly once.');
  }
  if (!Number.isInteger(updated.updatedAt) || updated.updatedAt < current.updatedAt) {
    fail('INVALID_ORDER_UPDATE', 'The order update timestamp is invalid.');
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

async function withSerializableTransaction(clientFactory, connectionString, action) {
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
    throw normalizeDatabaseError(error);
  } finally {
    await closeClient(client);
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

const INSERT_STRIPE_EVENT = `
  INSERT INTO legend_commerce.stripe_events (
    event_id, event_type, order_reference, stripe_created_at, processed_at
  ) VALUES ($1, $2, $3, $4, $5)
  ON CONFLICT (event_id) DO NOTHING
  RETURNING event_id
`;

const SELECT_STRIPE_EVENT = `
  SELECT event_id, event_type, order_reference, stripe_created_at
  FROM legend_commerce.stripe_events
  WHERE event_id = $1
  FOR SHARE
`;

const UPDATE_ORDER_STATUS = `
  UPDATE legend_commerce.orders
  SET status = $3,
      payment_session_id = $4,
      updated_at = $5,
      paid_at = $6,
      last_stripe_event_id = $7,
      last_stripe_event_type = $8,
      last_stripe_event_created = $9,
      version = $10
  WHERE reference = $1 AND version = $2
  RETURNING *
`;

export function createNeonOrderStore({
  connectionString = process.env.DATABASE_URL,
  clientFactory = createDefaultNeonClient,
  now = () => Math.floor(Date.now() / 1000),
} = {}) {
  const databaseUrl = validateNeonConnectionString(connectionString);
  if (typeof clientFactory !== 'function') {
    fail('INVALID_NEON_CLIENT_FACTORY', 'A Neon client factory is required.');
  }
  if (typeof now !== 'function') {
    fail('INVALID_CLOCK', 'An order-store clock function is required.');
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

    async processStripeEvent(paymentEventInput, createUpdate) {
      if (typeof createUpdate !== 'function') {
        fail('INVALID_ORDER_UPDATE', 'A synchronous order update callback is required.');
      }
      const paymentEvent = clone(paymentEventInput);
      const eventId = String(paymentEvent.eventId || '').trim();
      if (!STRIPE_EVENT_PATTERN.test(eventId)) {
        fail('INVALID_STRIPE_EVENT', 'Stripe event ID is invalid.');
      }
      const reference = validateReference(paymentEvent.reference);
      const eventCreated = integer(paymentEvent.created, 'Stripe event timestamp');

      return withSerializableTransaction(clientFactory, databaseUrl, async (client) => {
        const reserved = await client.query(INSERT_STRIPE_EVENT, [
          eventId,
          String(paymentEvent.eventType || ''),
          reference,
          eventCreated,
          integer(now(), 'processed timestamp'),
        ]);

        if (reserved.rows?.length === 0) {
          const existingEventResult = await client.query(SELECT_STRIPE_EVENT, [eventId]);
          const existingEvent = existingEventResult.rows?.[0];
          if (!existingEvent
            || existingEvent.event_type !== paymentEvent.eventType
            || existingEvent.order_reference !== reference
            || Number(existingEvent.stripe_created_at) !== eventCreated) {
            fail('ORDER_STORE_CONFLICT', 'Stripe event ID exists with different event data.');
          }
          const currentResult = await client.query(SELECT_ORDER_FOR_UPDATE, [reference]);
          const current = rowToOrder(currentResult.rows?.[0]);
          if (!current) {
            const notFound = new Error('Referenced order does not exist.');
            notFound.code = 'ORDER_NOT_FOUND';
            throw notFound;
          }
          return { duplicate: true, order: clone(current) };
        }

        const currentResult = await client.query(SELECT_ORDER_FOR_UPDATE, [reference]);
        const current = rowToOrder(currentResult.rows?.[0]);
        if (!current) {
          const notFound = new Error('Referenced order does not exist.');
          notFound.code = 'ORDER_NOT_FOUND';
          throw notFound;
        }

        const updated = createUpdate(clone(current));
        if (updated && typeof updated.then === 'function') {
          fail('INVALID_ORDER_UPDATE', 'The order update callback must be synchronous.');
        }
        assertSafeUpdate(current, updated);

        const updateResult = await client.query(UPDATE_ORDER_STATUS, [
          current.reference,
          current.version,
          updated.status,
          updated.paymentSessionId,
          updated.updatedAt,
          updated.paidAt ?? null,
          updated.lastStripeEventId || null,
          updated.lastStripeEventType || null,
          updated.lastStripeEventCreated ?? 0,
          updated.version,
        ]);
        const persisted = rowToOrder(updateResult.rows?.[0]);
        if (!persisted) {
          fail('ORDER_STORE_RETRYABLE', 'The order version changed during payment processing.');
        }
        return { duplicate: false, order: clone(persisted) };
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
