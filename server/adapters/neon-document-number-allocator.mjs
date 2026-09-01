import {
  createDefaultNeonClient,
  validateNeonConnectionString,
} from './neon-order-store.mjs';

const DOCUMENT_TYPES = new Set(['order', 'invoice']);
const SERIES_KEY_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{0,31}$/;
const MAX_ATTEMPTS = 4;
const RETRY_BASE_DELAY_MS = 15;

export class NeonDocumentNumberAllocatorError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = 'NeonDocumentNumberAllocatorError';
    this.code = code;
    this.details = details;
  }
}

function fail(code, message, details) {
  throw new NeonDocumentNumberAllocatorError(code, message, details);
}

function nonnegativeSafeInteger(value, field) {
  const normalized = Number(value);
  if (!Number.isSafeInteger(normalized) || normalized < 0) {
    fail('INVALID_DOCUMENT_NUMBER_REQUEST', `${field} is invalid.`, { field });
  }
  return normalized;
}

function normalizeAllocationInput(input = {}) {
  const documentType = String(input.documentType || '').trim().toLowerCase();
  const seriesKey = String(input.seriesKey || '').trim();

  if (!DOCUMENT_TYPES.has(documentType)) {
    fail('INVALID_DOCUMENT_TYPE', 'Document number type is invalid.', { documentType });
  }
  if (!SERIES_KEY_PATTERN.test(seriesKey)) {
    fail('INVALID_DOCUMENT_SERIES_KEY', 'Document number series key is invalid.', { seriesKey });
  }

  return Object.freeze({
    documentType,
    seriesKey,
    updatedAt: nonnegativeSafeInteger(input.updatedAt, 'updatedAt'),
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

function normalizeDatabaseError(error) {
  if (error instanceof NeonDocumentNumberAllocatorError) return error;
  if (error?.code === '40001' || error?.code === '40P01') {
    return new NeonDocumentNumberAllocatorError(
      'DOCUMENT_NUMBER_TRANSACTION_RETRYABLE',
      'The document number transaction must be retried.',
      { sqlState: error.code },
    );
  }
  if (error?.code && String(error.code).length === 5) {
    return new NeonDocumentNumberAllocatorError(
      'DOCUMENT_NUMBER_ALLOCATOR_UNAVAILABLE',
      'The document number allocator is unavailable.',
      { sqlState: error.code },
    );
  }
  return error;
}

const ENSURE_SERIES = `
  INSERT INTO legend_commerce.document_number_series (
    document_type,
    series_key,
    next_value,
    updated_at
  )
  VALUES ($1, $2, 1, $3)
  ON CONFLICT (document_type, series_key) DO NOTHING
`;

const SELECT_SERIES_FOR_UPDATE = `
  SELECT next_value, updated_at
  FROM legend_commerce.document_number_series
  WHERE document_type = $1 AND series_key = $2
  FOR UPDATE
`;

const ADVANCE_SERIES = `
  UPDATE legend_commerce.document_number_series
  SET next_value = next_value + 1,
      updated_at = GREATEST(updated_at, $3)
  WHERE document_type = $1 AND series_key = $2
  RETURNING next_value, updated_at
`;

export async function allocateDocumentNumberInTransaction(clientInput, allocationInput) {
  const client = validateClient(clientInput);
  const allocation = normalizeAllocationInput(allocationInput);

  await client.query(ENSURE_SERIES, [
    allocation.documentType,
    allocation.seriesKey,
    allocation.updatedAt,
  ]);

  const currentResult = await client.query(SELECT_SERIES_FOR_UPDATE, [
    allocation.documentType,
    allocation.seriesKey,
  ]);
  const current = currentResult.rows?.[0];
  const value = Number(current?.next_value);

  if (!Number.isSafeInteger(value) || value < 1) {
    fail('DOCUMENT_NUMBER_SERIES_CORRUPT', 'Document number series has an invalid next value.', {
      documentType: allocation.documentType,
      seriesKey: allocation.seriesKey,
    });
  }
  if (value >= Number.MAX_SAFE_INTEGER) {
    fail('DOCUMENT_NUMBER_SERIES_EXHAUSTED', 'Document number series exceeded the safe allocation range.', {
      documentType: allocation.documentType,
      seriesKey: allocation.seriesKey,
    });
  }

  const advanceResult = await client.query(ADVANCE_SERIES, [
    allocation.documentType,
    allocation.seriesKey,
    allocation.updatedAt,
  ]);
  const nextValue = Number(advanceResult.rows?.[0]?.next_value);
  if (!Number.isSafeInteger(nextValue) || nextValue !== value + 1) {
    fail('DOCUMENT_NUMBER_SERIES_CORRUPT', 'Document number series did not advance exactly once.', {
      documentType: allocation.documentType,
      seriesKey: allocation.seriesKey,
      value,
      nextValue,
    });
  }

  return Object.freeze({
    documentType: allocation.documentType,
    seriesKey: allocation.seriesKey,
    value,
    nextValue,
  });
}

export function createNeonDocumentNumberAllocator({
  connectionString = process.env.DATABASE_URL,
  clientFactory = createDefaultNeonClient,
} = {}) {
  const databaseUrl = validateNeonConnectionString(connectionString);
  if (typeof clientFactory !== 'function') {
    fail('INVALID_NEON_CLIENT_FACTORY', 'A Neon client factory is required.');
  }

  return Object.freeze({
    async transact(work) {
      if (typeof work !== 'function') {
        fail('INVALID_DOCUMENT_NUMBER_WORK', 'Document number transaction work must be a function.');
      }

      let lastError;
      for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
        const client = validateClient(await clientFactory(databaseUrl));
        let transactionStarted = false;

        try {
          await client.connect();
          await client.query('BEGIN ISOLATION LEVEL SERIALIZABLE');
          transactionStarted = true;

          // The callback must contain database-only, retry-safe work. Provider calls,
          // email, PDF rendering, and other external side effects belong after commit.
          const result = await work(Object.freeze({
            client,
            allocate: (input) => allocateDocumentNumberInTransaction(client, input),
          }));

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
          const retryable = normalized instanceof NeonDocumentNumberAllocatorError
            && normalized.code === 'DOCUMENT_NUMBER_TRANSACTION_RETRYABLE';
          if (!retryable || attempt === MAX_ATTEMPTS) throw normalized;
        } finally {
          try {
            await client.end();
          } catch {
            // Closing a failed serverless connection must not mask the original error.
          }
        }

        await new Promise((resolve) => setTimeout(
          resolve,
          RETRY_BASE_DELAY_MS * (2 ** (attempt - 1)),
        ));
      }

      throw lastError;
    },
  });
}
