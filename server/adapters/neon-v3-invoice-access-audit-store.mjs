import { randomUUID } from 'node:crypto';

import {
  createDefaultNeonClient,
  validateNeonConnectionString,
} from './neon-order-store.mjs';

const REFERENCE_PATTERN = /^[a-f0-9]{64}$/;
const REASON_PATTERN = /^[a-z][a-z0-9_]{0,63}$/;
const CHANNELS = new Set(['customer', 'dashboard']);
const OUTCOMES = new Set(['success', 'denied', 'unavailable', 'error']);
const NORMAL_RETENTION_SECONDS = 90 * 24 * 60 * 60;

export class NeonV3InvoiceAccessAuditStoreError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = 'NeonV3InvoiceAccessAuditStoreError';
    this.code = code;
    this.details = details;
  }
}

function fail(code, message, details = {}) {
  throw new NeonV3InvoiceAccessAuditStoreError(code, message, details);
}

function normalizeReference(value) {
  const reference = String(value || '').trim().toLowerCase();
  if (!REFERENCE_PATTERN.test(reference)) {
    fail('INVALID_V3_INVOICE_AUDIT_EVENT', 'Order reference is invalid.');
  }
  return reference;
}

function normalizeInvoiceId(value) {
  if (value === null || value === undefined || value === '') return null;
  const invoiceId = Number(value);
  if (!Number.isSafeInteger(invoiceId) || invoiceId <= 0) {
    fail('INVALID_V3_INVOICE_AUDIT_EVENT', 'Invoice id is invalid.');
  }
  return invoiceId;
}

function normalizeEnum(value, allowed, field) {
  const normalized = String(value || '').trim().toLowerCase();
  if (!allowed.has(normalized)) {
    fail('INVALID_V3_INVOICE_AUDIT_EVENT', `${field} is invalid.`, { field });
  }
  return normalized;
}

function normalizeReasonCode(value) {
  const reasonCode = String(value || '').trim().toLowerCase();
  if (!REASON_PATTERN.test(reasonCode)) {
    fail('INVALID_V3_INVOICE_AUDIT_EVENT', 'Audit reason code is invalid.');
  }
  return reasonCode;
}

function nonnegativeTimestamp(value) {
  const timestamp = Number(value);
  if (!Number.isSafeInteger(timestamp) || timestamp < 0) {
    fail('INVALID_V3_INVOICE_AUDIT_EVENT', 'Audit timestamp is invalid.');
  }
  return timestamp;
}

function validateEventId(value) {
  const eventId = String(value || '').trim().toLowerCase();
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(eventId)) {
    fail('INVALID_V3_INVOICE_AUDIT_EVENT', 'Audit event id is invalid.');
  }
  return eventId;
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

const INSERT_AUDIT_EVENT = `
  INSERT INTO legend_commerce.invoice_access_audit (
    event_id,
    order_reference,
    invoice_id,
    channel,
    outcome,
    reason_code,
    occurred_at,
    retain_until
  ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
`;

export function createNeonV3InvoiceAccessAuditStore({
  connectionString = process.env.DATABASE_URL,
  clientFactory = createDefaultNeonClient,
  clock = () => Math.floor(Date.now() / 1000),
  idFactory = randomUUID,
} = {}) {
  const databaseUrl = validateNeonConnectionString(connectionString);
  if (typeof clientFactory !== 'function') {
    fail('INVALID_NEON_CLIENT_FACTORY', 'A Neon client factory is required.');
  }
  if (typeof clock !== 'function' || typeof idFactory !== 'function') {
    fail('INVALID_V3_INVOICE_AUDIT_CONFIGURATION', 'Audit clock and id factory are required.');
  }

  return Object.freeze({
    async recordInvoiceAccess({
      channel,
      orderReference,
      invoiceId = null,
      outcome,
      reasonCode,
    } = {}) {
      const occurredAt = nonnegativeTimestamp(clock());
      const event = Object.freeze({
        eventId: validateEventId(idFactory()),
        orderReference: normalizeReference(orderReference),
        invoiceId: normalizeInvoiceId(invoiceId),
        channel: normalizeEnum(channel, CHANNELS, 'channel'),
        outcome: normalizeEnum(outcome, OUTCOMES, 'outcome'),
        reasonCode: normalizeReasonCode(reasonCode),
        occurredAt,
        retainUntil: occurredAt + NORMAL_RETENTION_SECONDS,
      });

      try {
        await withClient(clientFactory, databaseUrl, (client) => client.query(
          INSERT_AUDIT_EVENT,
          [
            event.eventId,
            event.orderReference,
            event.invoiceId,
            event.channel,
            event.outcome,
            event.reasonCode,
            event.occurredAt,
            event.retainUntil,
          ],
        ));
      } catch (error) {
        if (error instanceof NeonV3InvoiceAccessAuditStoreError) throw error;
        fail('V3_INVOICE_AUDIT_WRITE_FAILED', 'Invoice access audit could not be persisted.');
      }

      return event;
    },
  });
}
