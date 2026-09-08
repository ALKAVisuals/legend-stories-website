import assert from 'node:assert/strict';
import test from 'node:test';

import { createNeonV3InvoiceAccessAuditStore } from '../server/adapters/neon-v3-invoice-access-audit-store.mjs';

const connectionString = 'postgresql://runtime:secret@ep-test.neon.tech/legend?sslmode=require';
const orderReference = 'a'.repeat(64);
const eventId = '123e4567-e89b-42d3-a456-426614174000';
const occurredAt = 1_800_400_000;

function harness({ queryError = null } = {}) {
  const calls = [];
  const client = {
    async connect() {
      calls.push(['connect']);
    },
    async query(text, params) {
      calls.push(['query', text, params]);
      if (queryError) throw queryError;
      return { rows: [] };
    },
    async end() {
      calls.push(['end']);
    },
  };
  const store = createNeonV3InvoiceAccessAuditStore({
    connectionString,
    clientFactory: async () => client,
    clock: () => occurredAt,
    idFactory: () => eventId,
  });
  return { calls, store };
}

test('persists only the minimal server-approved invoice-access audit tuple', async () => {
  const h = harness();
  const event = await h.store.recordInvoiceAccess({
    channel: 'customer',
    orderReference,
    invoiceId: 77,
    outcome: 'success',
    reasonCode: 'download_success',
  });

  assert.deepEqual(event, {
    eventId,
    orderReference,
    invoiceId: 77,
    channel: 'customer',
    outcome: 'success',
    reasonCode: 'download_success',
    occurredAt,
    retainUntil: occurredAt + 7_776_000,
  });

  const query = h.calls.find(([name]) => name === 'query');
  assert.ok(query);
  assert.match(query[1], /INSERT INTO legend_commerce\.invoice_access_audit/);
  assert.doesNotMatch(query[1], /RETURNING/i);
  assert.deepEqual(query[2], [
    eventId,
    orderReference,
    77,
    'customer',
    'success',
    'download_success',
    occurredAt,
    occurredAt + 7_776_000,
  ]);
  assert.deepEqual(h.calls.map(([name]) => name), ['connect', 'query', 'end']);
});

test('supports denied access before an invoice identity has been resolved', async () => {
  const h = harness();
  const event = await h.store.recordInvoiceAccess({
    channel: 'customer',
    orderReference,
    invoiceId: null,
    outcome: 'denied',
    reasonCode: 'authorization_denied',
  });
  assert.equal(event.invoiceId, null);
  assert.equal(event.retainUntil - event.occurredAt, 7_776_000);
});

test('rejects unsafe reason classes before opening Neon', async () => {
  const h = harness();
  await assert.rejects(
    h.store.recordInvoiceAccess({
      channel: 'dashboard',
      orderReference,
      invoiceId: 77,
      outcome: 'error',
      reasonCode: 'customer@example.invalid',
    }),
    (error) => error?.code === 'INVALID_V3_INVOICE_AUDIT_EVENT',
  );
  assert.equal(h.calls.length, 0);
});

test('maps database write failures to a fail-closed audit error without leaking database details', async () => {
  const databaseError = new Error('sensitive database detail');
  databaseError.code = '42501';
  const h = harness({ queryError: databaseError });
  await assert.rejects(
    h.store.recordInvoiceAccess({
      channel: 'dashboard',
      orderReference,
      invoiceId: 77,
      outcome: 'unavailable',
      reasonCode: 'storage_unavailable',
    }),
    (error) => error?.code === 'V3_INVOICE_AUDIT_WRITE_FAILED'
      && !error.message.includes('sensitive database detail'),
  );
  assert.deepEqual(h.calls.map(([name]) => name), ['connect', 'query', 'end']);
});
