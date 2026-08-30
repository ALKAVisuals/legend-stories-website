const DOCUMENT_TYPES = new Set(['order', 'invoice']);
const MAX_ALLOCATABLE_VALUE = Number.MAX_SAFE_INTEGER - 1;

export class DocumentNumberAllocatorError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = 'DocumentNumberAllocatorError';
    this.code = code;
    this.details = details;
  }
}

function fail(code, message, details) {
  throw new DocumentNumberAllocatorError(code, message, details);
}

function validateClient(client) {
  if (typeof client?.query !== 'function') {
    fail('INVALID_DOCUMENT_NUMBER_CLIENT', 'A transaction-scoped database client is required.');
  }
  return client;
}

function normalizeDocumentType(value) {
  const documentType = String(value || '').trim().toLowerCase();
  if (!DOCUMENT_TYPES.has(documentType)) {
    fail('INVALID_DOCUMENT_TYPE', 'Document type must be order or invoice.', { documentType });
  }
  return documentType;
}

function normalizeSeriesKey(value) {
  if (typeof value !== 'string') {
    fail('INVALID_DOCUMENT_SERIES_KEY', 'Document series key must be a string.');
  }
  const seriesKey = value.trim();
  if (!seriesKey || seriesKey.length > 64 || seriesKey !== value) {
    fail(
      'INVALID_DOCUMENT_SERIES_KEY',
      'Document series key must contain 1-64 characters with no surrounding whitespace.',
    );
  }
  return seriesKey;
}

function nonNegativeInteger(value, field) {
  const normalized = Number(value);
  if (!Number.isSafeInteger(normalized) || normalized < 0) {
    fail('INVALID_DOCUMENT_NUMBER_TIMESTAMP', `${field} must be a non-negative safe integer.`, { field });
  }
  return normalized;
}

function storedPositiveInteger(value, field) {
  const normalized = Number(value);
  if (!Number.isSafeInteger(normalized) || normalized < 1 || normalized > MAX_ALLOCATABLE_VALUE) {
    fail(
      'DOCUMENT_NUMBER_SERIES_INVARIANT_BROKEN',
      `${field} is outside the supported allocation range.`,
      { field, value: String(value ?? '') },
    );
  }
  return normalized;
}

const ENSURE_SERIES = `
  INSERT INTO legend_commerce.document_number_series (
    document_type, series_key, next_value, updated_at
  ) VALUES ($1, $2, 1, $3)
  ON CONFLICT (document_type, series_key) DO NOTHING
`;

const LOCK_SERIES = `
  SELECT next_value, updated_at
  FROM legend_commerce.document_number_series
  WHERE document_type = $1 AND series_key = $2
  FOR UPDATE
`;

const ADVANCE_SERIES = `
  UPDATE legend_commerce.document_number_series
  SET next_value = $3,
      updated_at = GREATEST(updated_at, $4)
  WHERE document_type = $1
    AND series_key = $2
    AND next_value = $5
  RETURNING next_value, updated_at
`;

/**
 * Reserve one raw numeric document value using the caller's open transaction.
 *
 * This function deliberately does not BEGIN, COMMIT, retry, or format a public
 * LegendMural document number. The paid finalizer owns the SERIALIZABLE
 * transaction and must check durable order idempotency before calling here.
 */
export async function reserveDocumentNumberValue(clientInput, input = {}) {
  const client = validateClient(clientInput);
  const documentType = normalizeDocumentType(input.documentType);
  const seriesKey = normalizeSeriesKey(input.seriesKey);
  const updatedAt = nonNegativeInteger(input.updatedAt, 'updatedAt');

  await client.query(ENSURE_SERIES, [documentType, seriesKey, updatedAt]);

  const lockedResult = await client.query(LOCK_SERIES, [documentType, seriesKey]);
  const lockedRow = lockedResult.rows?.[0];
  if (!lockedRow) {
    fail(
      'DOCUMENT_NUMBER_SERIES_INVARIANT_BROKEN',
      'Document number series could not be locked after creation/resolution.',
      { documentType, seriesKey },
    );
  }

  const value = storedPositiveInteger(lockedRow.next_value, 'next_value');
  const nextValue = value + 1;
  const advanceResult = await client.query(ADVANCE_SERIES, [
    documentType,
    seriesKey,
    nextValue,
    updatedAt,
    value,
  ]);
  const advancedRow = advanceResult.rows?.[0];
  if (!advancedRow || storedPositiveInteger(advancedRow.next_value, 'advanced next_value') !== nextValue) {
    fail(
      'DOCUMENT_NUMBER_SERIES_INVARIANT_BROKEN',
      'Document number series did not advance exactly once while locked.',
      { documentType, seriesKey, value },
    );
  }

  return Object.freeze({
    documentType,
    seriesKey,
    value,
    nextValue,
    updatedAt: nonNegativeInteger(advancedRow.updated_at, 'stored updated_at'),
  });
}

/**
 * Reserve both values in the one permitted lock order: order, then invoice.
 * Keeping this order fixed prevents two paid-finalization transactions from
 * taking the document-series locks in opposite order.
 */
export async function reserveOrderAndInvoiceNumberValues(client, input = {}) {
  const updatedAt = nonNegativeInteger(input.updatedAt, 'updatedAt');
  const orderSeriesKey = normalizeSeriesKey(input.orderSeriesKey);
  const invoiceSeriesKey = normalizeSeriesKey(input.invoiceSeriesKey);

  const order = await reserveDocumentNumberValue(client, {
    documentType: 'order',
    seriesKey: orderSeriesKey,
    updatedAt,
  });
  const invoice = await reserveDocumentNumberValue(client, {
    documentType: 'invoice',
    seriesKey: invoiceSeriesKey,
    updatedAt,
  });

  return Object.freeze({ order, invoice });
}
