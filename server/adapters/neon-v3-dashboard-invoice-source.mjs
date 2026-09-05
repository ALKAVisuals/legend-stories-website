import {
  createDefaultNeonClient,
  validateNeonConnectionString,
} from './neon-order-store.mjs';

const REFERENCE_PATTERN = /^[a-f0-9]{64}$/;
const CURRENCY_PATTERN = /^[A-Z]{3}$/;

export class NeonV3DashboardInvoiceSourceError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = 'NeonV3DashboardInvoiceSourceError';
    this.code = code;
    this.details = details;
  }
}

function fail(code, message, details = {}) {
  throw new NeonV3DashboardInvoiceSourceError(code, message, details);
}

function normalizeReference(value) {
  const reference = String(value || '').trim().toLowerCase();
  if (!REFERENCE_PATTERN.test(reference)) {
    fail('INVALID_V3_DASHBOARD_INVOICE_REQUEST', 'Order reference is invalid.');
  }
  return reference;
}

function positiveInteger(value, field) {
  const normalized = Number(value);
  if (!Number.isSafeInteger(normalized) || normalized <= 0) {
    fail('V3_DASHBOARD_INVOICE_IDENTITY_MISMATCH', `${field} is invalid.`, { field });
  }
  return normalized;
}

function nonnegativeInteger(value, field) {
  const normalized = Number(value);
  if (!Number.isSafeInteger(normalized) || normalized < 0) {
    fail('V3_DASHBOARD_INVOICE_IDENTITY_MISMATCH', `${field} is invalid.`, { field });
  }
  return normalized;
}

function safeText(value, field, maxLength = 160) {
  const normalized = String(value ?? '');
  if (!normalized
    || normalized !== normalized.trim()
    || normalized.length > maxLength
    || /[\u0000-\u001f\u007f]/.test(normalized)) {
    fail('V3_DASHBOARD_INVOICE_IDENTITY_MISMATCH', `${field} is invalid.`, { field });
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

const SELECT_DASHBOARD_INVOICE = `
  SELECT
    o.reference,
    o.status AS order_status,
    o.document_profile_version,
    o.invoice_id AS order_invoice_id,
    i.id AS invoice_id,
    i.invoice_number,
    i.status AS invoice_status,
    i.issued_at,
    i.currency,
    i.amount_total,
    i.schema_version
  FROM legend_commerce.orders o
  JOIN legend_commerce.invoices i
    ON i.id = o.invoice_id
   AND i.order_reference = o.reference
   AND i.order_number = o.order_number
  WHERE o.reference = $1
`;

function rowToSummary(row, expectedReference) {
  if (!row) {
    fail('V3_DASHBOARD_INVOICE_NOT_FOUND', 'Issued V3 invoice could not be loaded.');
  }
  const orderReference = normalizeReference(row.reference);
  const orderInvoiceId = positiveInteger(row.order_invoice_id, 'orderInvoiceId');
  const invoiceId = positiveInteger(row.invoice_id, 'invoiceId');
  if (orderReference !== expectedReference
    || String(row.order_status || '') !== 'paid'
    || Number(row.document_profile_version) !== 1
    || orderInvoiceId !== invoiceId
    || String(row.invoice_status || '') !== 'issued') {
    fail('V3_DASHBOARD_INVOICE_IDENTITY_MISMATCH', 'Dashboard invoice requires a durable paid Profile-1 issued invoice.');
  }

  const currency = safeText(row.currency, 'currency', 3).toUpperCase();
  if (!CURRENCY_PATTERN.test(currency)) {
    fail('V3_DASHBOARD_INVOICE_IDENTITY_MISMATCH', 'currency is invalid.', { field: 'currency' });
  }

  return Object.freeze({
    orderReference,
    invoiceId,
    invoiceNumber: safeText(row.invoice_number, 'invoiceNumber', 120),
    issuedAt: nonnegativeInteger(row.issued_at, 'issuedAt'),
    currency,
    amountTotal: nonnegativeInteger(row.amount_total, 'amountTotal'),
    schemaVersion: positiveInteger(row.schema_version, 'schemaVersion'),
  });
}

export function createNeonV3DashboardInvoiceSource({
  connectionString = process.env.DATABASE_URL,
  clientFactory = createDefaultNeonClient,
} = {}) {
  const databaseUrl = validateNeonConnectionString(connectionString);
  if (typeof clientFactory !== 'function') {
    fail('INVALID_NEON_CLIENT_FACTORY', 'A Neon client factory is required.');
  }

  return Object.freeze({
    async loadDashboardInvoiceSummary({ orderReference } = {}) {
      const reference = normalizeReference(orderReference);
      return withClient(clientFactory, databaseUrl, async (client) => {
        const result = await client.query(SELECT_DASHBOARD_INVOICE, [reference]);
        return rowToSummary(result.rows?.[0], reference);
      });
    },
  });
}
