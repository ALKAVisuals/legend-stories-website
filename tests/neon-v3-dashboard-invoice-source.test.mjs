import assert from 'node:assert/strict';
import test from 'node:test';

import {
  createNeonV3DashboardInvoiceSource,
  NeonV3DashboardInvoiceSourceError,
} from '../server/adapters/neon-v3-dashboard-invoice-source.mjs';

const connectionString = 'postgresql://runtime:secret@ep-test.neon.tech/legend?sslmode=require';
const reference = 'd'.repeat(64);

function row(overrides = {}) {
  return {
    reference,
    order_status: 'paid',
    document_profile_version: 1,
    order_invoice_id: 77,
    invoice_id: 77,
    invoice_number: 'LM-INV-2026-000077',
    invoice_status: 'issued',
    issued_at: 1_800_000_100,
    currency: 'EUR',
    amount_total: 12395,
    schema_version: 1,
    ...overrides,
  };
}

function clientFactory(handler) {
  return async () => ({
    async connect() {},
    async query(sql, values) { return handler(sql, values); },
    async end() {},
  });
}

test('loads only read-only issued invoice summary fields for a paid Profile-1 order', async () => {
  const queries = [];
  const source = createNeonV3DashboardInvoiceSource({
    connectionString,
    clientFactory: clientFactory((sql, values) => {
      queries.push({ sql, values });
      return { rows: [row()] };
    }),
  });

  const summary = await source.loadDashboardInvoiceSummary({ orderReference: reference });
  assert.deepEqual(summary, {
    orderReference: reference,
    invoiceId: 77,
    invoiceNumber: 'LM-INV-2026-000077',
    issuedAt: 1_800_000_100,
    currency: 'EUR',
    amountTotal: 12395,
    schemaVersion: 1,
  });
  assert.deepEqual(queries[0].values, [reference]);
  assert.ok(queries[0].sql.includes('JOIN legend_commerce.invoices'));
  assert.equal(/\bsnapshot\b/i.test(queries[0].sql), false);
  assert.equal(/\b(UPDATE|INSERT|DELETE)\b/i.test(queries[0].sql), false);
});

test('fails closed for legacy, unpaid or mismatched invoice identity', async () => {
  for (const overrides of [
    { document_profile_version: 0 },
    { order_status: 'pending' },
    { invoice_status: 'draft' },
    { order_invoice_id: 76 },
  ]) {
    const source = createNeonV3DashboardInvoiceSource({
      connectionString,
      clientFactory: clientFactory(() => ({ rows: [row(overrides)] })),
    });
    await assert.rejects(
      source.loadDashboardInvoiceSummary({ orderReference: reference }),
      (error) => error instanceof NeonV3DashboardInvoiceSourceError
        && error.code === 'V3_DASHBOARD_INVOICE_IDENTITY_MISMATCH',
    );
  }
});

test('returns a not-found error when no issued V3 invoice row exists', async () => {
  const source = createNeonV3DashboardInvoiceSource({
    connectionString,
    clientFactory: clientFactory(() => ({ rows: [] })),
  });
  await assert.rejects(
    source.loadDashboardInvoiceSummary({ orderReference: reference }),
    (error) => error.code === 'V3_DASHBOARD_INVOICE_NOT_FOUND',
  );
});

test('rejects malformed order references before querying Neon', async () => {
  let queried = false;
  const source = createNeonV3DashboardInvoiceSource({
    connectionString,
    clientFactory: clientFactory(() => {
      queried = true;
      return { rows: [] };
    }),
  });
  await assert.rejects(
    source.loadDashboardInvoiceSummary({ orderReference: '../invoice' }),
    (error) => error.code === 'INVALID_V3_DASHBOARD_INVOICE_REQUEST',
  );
  assert.equal(queried, false);
});
