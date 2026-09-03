import {
  createDefaultNeonClient,
  validateNeonConnectionString,
} from './neon-order-store.mjs';

const REFERENCE_PATTERN = /^[a-f0-9]{64}$/;
const SNAPSHOT_SCHEMA_VERSION = 1;
const SUPPORTED_CURRENCY = 'EUR';

export class NeonV3InvoiceDeliverySourceError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = 'NeonV3InvoiceDeliverySourceError';
    this.code = code;
    this.details = details;
  }
}

function fail(code, message, details = {}) {
  throw new NeonV3InvoiceDeliverySourceError(code, message, details);
}

function normalizeReference(value) {
  const reference = String(value || '').trim().toLowerCase();
  if (!REFERENCE_PATTERN.test(reference)) {
    fail('INVALID_V3_INVOICE_DELIVERY_REQUEST', 'Order reference is invalid.', {
      field: 'orderReference',
    });
  }
  return reference;
}

function positiveInteger(value, field) {
  const normalized = Number(value);
  if (!Number.isSafeInteger(normalized) || normalized <= 0) {
    fail('INVALID_V3_INVOICE_DELIVERY_REQUEST', `${field} is invalid.`, { field });
  }
  return normalized;
}

function nonnegativeInteger(value, field, mismatchCode) {
  if (value === null
    || value === undefined
    || (typeof value === 'string' && value.trim() === '')) {
    fail(mismatchCode, `${field} is invalid.`, { field });
  }

  const normalized = Number(value);
  if (!Number.isSafeInteger(normalized) || normalized < 0) {
    fail(mismatchCode, `${field} is invalid.`, { field });
  }
  return normalized;
}

function requiredText(value, field, mismatchCode) {
  const normalized = String(value ?? '').trim();
  if (!normalized) {
    fail(mismatchCode, `${field} is invalid.`, { field });
  }
  return normalized;
}

function requireSnapshotObject(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    fail(
      'V3_INVOICE_DELIVERY_SNAPSHOT_MISMATCH',
      'Persisted invoice snapshot is not an object.',
    );
  }
  return value;
}

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}

function clone(value) {
  return structuredClone(value);
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
    // A close failure must not mask delivery-source validation errors.
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

const SELECT_ISSUED_INVOICE_FOR_DELIVERY = `
  SELECT
    o.reference AS order_reference,
    o.status AS order_status,
    o.paid_at AS order_paid_at,
    o.order_number AS durable_order_number,
    o.invoice_id AS durable_invoice_id,
    o.document_profile_version,
    o.currency AS order_currency,
    o.amount_total AS order_amount_total,
    i.id AS invoice_id,
    i.order_reference AS invoice_order_reference,
    i.order_number AS invoice_order_number,
    i.invoice_number,
    i.status AS invoice_status,
    i.issued_at AS invoice_issued_at,
    i.currency AS invoice_currency,
    i.amount_total AS invoice_amount_total,
    i.schema_version AS invoice_schema_version,
    i.snapshot AS invoice_snapshot
  FROM legend_commerce.orders AS o
  LEFT JOIN legend_commerce.invoices AS i
    ON i.id = $2
  WHERE o.reference = $1
`;

function validateDurableInvoiceRow(row, { orderReference, invoiceId }) {
  if (!row) {
    fail('V3_INVOICE_DELIVERY_ORDER_NOT_FOUND', 'Durable order could not be loaded.');
  }

  const storedReference = normalizeReference(row.order_reference);
  if (storedReference !== orderReference) {
    fail(
      'V3_INVOICE_DELIVERY_IDENTITY_MISMATCH',
      'Durable order reference does not match the requested reference.',
    );
  }

  if (String(row.order_status || '') !== 'paid'
    || Number(row.document_profile_version) !== 1) {
    fail(
      'V3_INVOICE_DELIVERY_STATE_MISMATCH',
      'V3 invoice delivery requires a durable paid Profile-1 order.',
    );
  }

  const paidAt = nonnegativeInteger(
    row.order_paid_at,
    'order.paidAt',
    'V3_INVOICE_DELIVERY_STATE_MISMATCH',
  );
  const orderNumber = requiredText(
    row.durable_order_number,
    'order.orderNumber',
    'V3_INVOICE_DELIVERY_IDENTITY_MISMATCH',
  );
  const durableInvoiceId = positiveInteger(row.durable_invoice_id, 'order.invoiceId');
  if (durableInvoiceId !== invoiceId) {
    fail(
      'V3_INVOICE_DELIVERY_IDENTITY_MISMATCH',
      'Durable order is linked to a different invoice.',
    );
  }

  if (row.invoice_id === null || row.invoice_id === undefined) {
    fail('V3_INVOICE_DELIVERY_INVOICE_NOT_FOUND', 'Linked issued invoice could not be loaded.');
  }
  const storedInvoiceId = positiveInteger(row.invoice_id, 'invoice.id');
  if (storedInvoiceId !== invoiceId
    || normalizeReference(row.invoice_order_reference) !== orderReference
    || requiredText(
      row.invoice_order_number,
      'invoice.orderNumber',
      'V3_INVOICE_DELIVERY_IDENTITY_MISMATCH',
    ) !== orderNumber) {
    fail(
      'V3_INVOICE_DELIVERY_IDENTITY_MISMATCH',
      'Persisted invoice identity does not match the durable order.',
    );
  }

  if (String(row.invoice_status || '') !== 'issued') {
    fail(
      'V3_INVOICE_DELIVERY_STATE_MISMATCH',
      'Only an issued invoice may be loaded for V3 delivery.',
    );
  }

  const invoiceNumber = requiredText(
    row.invoice_number,
    'invoice.invoiceNumber',
    'V3_INVOICE_DELIVERY_IDENTITY_MISMATCH',
  );
  const issuedAt = nonnegativeInteger(
    row.invoice_issued_at,
    'invoice.issuedAt',
    'V3_INVOICE_DELIVERY_STATE_MISMATCH',
  );
  if (issuedAt < paidAt) {
    fail(
      'V3_INVOICE_DELIVERY_STATE_MISMATCH',
      'Issued invoice timestamp precedes the durable paid timestamp.',
    );
  }

  const orderCurrency = String(row.order_currency || '').trim().toUpperCase();
  const invoiceCurrency = String(row.invoice_currency || '').trim().toUpperCase();
  if (orderCurrency !== SUPPORTED_CURRENCY || invoiceCurrency !== orderCurrency) {
    fail(
      'V3_INVOICE_DELIVERY_IDENTITY_MISMATCH',
      'Persisted invoice currency does not match the durable order.',
    );
  }

  const orderAmountTotal = nonnegativeInteger(
    row.order_amount_total,
    'order.amountTotal',
    'V3_INVOICE_DELIVERY_IDENTITY_MISMATCH',
  );
  const invoiceAmountTotal = nonnegativeInteger(
    row.invoice_amount_total,
    'invoice.amountTotal',
    'V3_INVOICE_DELIVERY_IDENTITY_MISMATCH',
  );
  if (invoiceAmountTotal !== orderAmountTotal) {
    fail(
      'V3_INVOICE_DELIVERY_IDENTITY_MISMATCH',
      'Persisted invoice total does not match the durable order.',
    );
  }

  if (Number(row.invoice_schema_version) !== SNAPSHOT_SCHEMA_VERSION) {
    fail(
      'V3_INVOICE_DELIVERY_SNAPSHOT_MISMATCH',
      'Persisted invoice schema version is unsupported.',
    );
  }

  const snapshot = requireSnapshotObject(row.invoice_snapshot);
  if (Number(snapshot.schemaVersion) !== SNAPSHOT_SCHEMA_VERSION
    || snapshot.document?.orderNumber !== orderNumber
    || snapshot.document?.invoiceNumber !== invoiceNumber
    || Number(snapshot.document?.issuedAt) !== issuedAt
    || String(snapshot.document?.currency || '').trim().toUpperCase() !== orderCurrency
    || snapshot.order?.reference !== orderReference
    || Number(snapshot.order?.paidAt) !== paidAt
    || Number(snapshot.totals?.grandTotalCents) !== orderAmountTotal) {
    fail(
      'V3_INVOICE_DELIVERY_SNAPSHOT_MISMATCH',
      'Immutable invoice snapshot identity does not match durable order/invoice state.',
    );
  }

  return deepFreeze({
    orderReference,
    invoiceId,
    orderNumber,
    invoiceNumber,
    issuedAt,
    currency: orderCurrency,
    amountTotal: orderAmountTotal,
    snapshotSchemaVersion: SNAPSHOT_SCHEMA_VERSION,
    snapshot: clone(snapshot),
  });
}

export function createNeonV3InvoiceDeliverySource({
  connectionString = process.env.DATABASE_URL,
  clientFactory = createDefaultNeonClient,
} = {}) {
  const databaseUrl = validateNeonConnectionString(connectionString);
  if (typeof clientFactory !== 'function') {
    fail('INVALID_NEON_CLIENT_FACTORY', 'A Neon client factory is required.');
  }

  return Object.freeze({
    async loadIssuedInvoiceForDelivery({ orderReference, invoiceId } = {}) {
      const reference = normalizeReference(orderReference);
      const normalizedInvoiceId = positiveInteger(invoiceId, 'invoiceId');

      return withClient(clientFactory, databaseUrl, async (client) => {
        const result = await client.query(SELECT_ISSUED_INVOICE_FOR_DELIVERY, [
          reference,
          normalizedInvoiceId,
        ]);
        return validateDurableInvoiceRow(result.rows?.[0], {
          orderReference: reference,
          invoiceId: normalizedInvoiceId,
        });
      });
    },
  });
}

export { SNAPSHOT_SCHEMA_VERSION };