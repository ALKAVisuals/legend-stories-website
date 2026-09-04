import {
  createDefaultNeonClient,
  validateNeonConnectionString,
} from './neon-order-store.mjs';

const REFERENCE_PATTERN = /^[a-f0-9]{64}$/;
const DEFAULT_BATCH_SIZE = 25;
const MAX_BATCH_SIZE = 25;
const DEFAULT_LEASE_SECONDS = 300;
const MAX_V3_AUTOMATIC_CLAIMS = 5;

export class NeonV3InvoiceReconciliationSourceError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = 'NeonV3InvoiceReconciliationSourceError';
    this.code = code;
    this.details = details;
  }
}

function fail(code, message, details = {}) {
  throw new NeonV3InvoiceReconciliationSourceError(code, message, details);
}

function timestamp(value, field) {
  const normalized = Number(value);
  if (!Number.isSafeInteger(normalized) || normalized < 0) {
    fail('INVALID_V3_RECONCILIATION_REQUEST', `${field} is invalid.`, { field });
  }
  return normalized;
}

function batchSize(value) {
  const normalized = Number(value);
  if (!Number.isSafeInteger(normalized) || normalized < 1 || normalized > MAX_BATCH_SIZE) {
    fail('INVALID_V3_RECONCILIATION_REQUEST', 'limit is invalid.', { field: 'limit' });
  }
  return normalized;
}

function normalizeReference(value) {
  const reference = String(value || '').trim().toLowerCase();
  if (!REFERENCE_PATTERN.test(reference)) {
    fail('INVALID_V3_RECONCILIATION_RESULT', 'Candidate order reference is invalid.');
  }
  return reference;
}

function positiveInteger(value, field) {
  const normalized = Number(value);
  if (!Number.isSafeInteger(normalized) || normalized <= 0) {
    fail('INVALID_V3_RECONCILIATION_RESULT', `${field} is invalid.`, { field });
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

async function closeClient(client) {
  try {
    await client.end();
  } catch {
    // Closing a failed serverless connection must not mask reconciliation errors.
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

const SELECT_V3_RECONCILIATION_CANDIDATES = `
  SELECT
    o.reference AS order_reference,
    o.invoice_id,
    CASE
      WHEN n.order_reference IS NULL THEN 'missing'
      WHEN n.delivery_status = 'pending' THEN 'pending'
      WHEN n.delivery_status = 'failed' THEN 'failed_due'
      WHEN n.delivery_status = 'sending' THEN 'stale_sending'
      ELSE 'unknown'
    END AS reconciliation_reason,
    CASE
      WHEN n.order_reference IS NULL THEN o.paid_at
      WHEN n.delivery_status = 'pending' THEN n.created_at
      WHEN n.delivery_status = 'failed' THEN n.next_attempt_at
      WHEN n.delivery_status = 'sending' THEN COALESCE(n.lease_expires_at, n.claimed_at + $3)
      ELSE $1
    END AS reconciliation_due_at
  FROM legend_commerce.orders AS o
  INNER JOIN legend_commerce.invoices AS i
    ON i.id = o.invoice_id
   AND i.order_reference = o.reference
  LEFT JOIN legend_commerce.order_notifications AS n
    ON n.order_reference = o.reference
   AND n.notification_type = 'customer_v3_invoice'
  WHERE o.status = 'paid'
    AND o.mode = 'live'
    AND o.document_profile_version = 1
    AND o.invoice_id IS NOT NULL
    AND o.paid_at IS NOT NULL
    AND i.status = 'issued'
    AND i.schema_version = 1
    AND (
      n.order_reference IS NULL
      OR (
        n.delivery_status = 'pending'
        AND n.delivery_attempts < $4
      )
      OR (
        n.delivery_status = 'failed'
        AND n.next_attempt_at IS NOT NULL
        AND n.next_attempt_at <= $1
        AND n.delivery_attempts < $4
      )
      OR (
        n.delivery_status = 'sending'
        AND COALESCE(n.lease_expires_at, n.claimed_at + $3) <= $1
        AND n.delivery_attempts < $4
      )
    )
  ORDER BY reconciliation_due_at ASC, o.reference ASC
  LIMIT $2
`;

function rowToCandidate(row) {
  const reason = String(row?.reconciliation_reason || '');
  if (!['missing', 'pending', 'failed_due', 'stale_sending'].includes(reason)) {
    fail('INVALID_V3_RECONCILIATION_RESULT', 'Candidate reconciliation reason is invalid.');
  }

  return Object.freeze({
    order: Object.freeze({
      reference: normalizeReference(row?.order_reference),
      status: 'paid',
      mode: 'live',
      documentProfileVersion: 1,
      invoiceId: positiveInteger(row?.invoice_id, 'invoiceId'),
    }),
    reason,
    dueAt: timestamp(row?.reconciliation_due_at, 'dueAt'),
  });
}

export function createNeonV3InvoiceReconciliationSource({
  connectionString = process.env.DATABASE_URL,
  clientFactory = createDefaultNeonClient,
} = {}) {
  const databaseUrl = validateNeonConnectionString(connectionString);
  if (typeof clientFactory !== 'function') {
    fail('INVALID_NEON_CLIENT_FACTORY', 'A Neon client factory is required.');
  }

  return Object.freeze({
    async listCandidates({
      dueAt,
      limit = DEFAULT_BATCH_SIZE,
      leaseSeconds = DEFAULT_LEASE_SECONDS,
    } = {}) {
      const due = timestamp(dueAt, 'dueAt');
      const boundedLimit = batchSize(limit);
      const lease = positiveInteger(leaseSeconds, 'leaseSeconds');

      return withClient(clientFactory, databaseUrl, async (client) => {
        const result = await client.query(SELECT_V3_RECONCILIATION_CANDIDATES, [
          due,
          boundedLimit,
          lease,
          MAX_V3_AUTOMATIC_CLAIMS,
        ]);
        return Object.freeze((result.rows || []).map(rowToCandidate));
      });
    },
  });
}

export {
  DEFAULT_BATCH_SIZE,
  DEFAULT_LEASE_SECONDS,
  MAX_BATCH_SIZE,
  MAX_V3_AUTOMATIC_CLAIMS,
};
