import {
  createDefaultNeonClient,
  validateNeonConnectionString,
} from './neon-order-store.mjs';

const REFERENCE_PATTERN = /^[a-f0-9]{64}$/;

export class NeonV3InvoiceDownloadSourceError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = 'NeonV3InvoiceDownloadSourceError';
    this.code = code;
    this.details = details;
  }
}

function fail(code, message, details = {}) {
  throw new NeonV3InvoiceDownloadSourceError(code, message, details);
}

function normalizeReference(value) {
  const reference = String(value || '').trim().toLowerCase();
  if (!REFERENCE_PATTERN.test(reference)) {
    fail('INVALID_V3_INVOICE_DOWNLOAD_REQUEST', 'Order reference is invalid.');
  }
  return reference;
}

function positiveInteger(value, field) {
  const normalized = Number(value);
  if (!Number.isSafeInteger(normalized) || normalized <= 0) {
    fail('V3_INVOICE_DOWNLOAD_IDENTITY_MISMATCH', `${field} is invalid.`, { field });
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

const SELECT_DOWNLOAD_IDENTITY = `
  SELECT reference, status, document_profile_version, invoice_id
  FROM legend_commerce.orders
  WHERE reference = $1
`;

export function createNeonV3InvoiceDownloadSource({
  connectionString = process.env.DATABASE_URL,
  clientFactory = createDefaultNeonClient,
} = {}) {
  const databaseUrl = validateNeonConnectionString(connectionString);
  if (typeof clientFactory !== 'function') {
    fail('INVALID_NEON_CLIENT_FACTORY', 'A Neon client factory is required.');
  }

  return Object.freeze({
    async loadInvoiceIdentityForDownload({ orderReference } = {}) {
      const reference = normalizeReference(orderReference);
      return withClient(clientFactory, databaseUrl, async (client) => {
        const result = await client.query(SELECT_DOWNLOAD_IDENTITY, [reference]);
        const row = result.rows?.[0];
        if (!row) {
          fail('V3_INVOICE_DOWNLOAD_ORDER_NOT_FOUND', 'Durable order could not be loaded.');
        }
        if (normalizeReference(row.reference) !== reference
          || String(row.status || '') !== 'paid'
          || Number(row.document_profile_version) !== 1) {
          fail(
            'V3_INVOICE_DOWNLOAD_IDENTITY_MISMATCH',
            'Invoice download requires a durable paid Profile-1 order.',
          );
        }
        return Object.freeze({
          orderReference: reference,
          invoiceId: positiveInteger(row.invoice_id, 'invoiceId'),
          documentProfileVersion: 1,
        });
      });
    },
  });
}
