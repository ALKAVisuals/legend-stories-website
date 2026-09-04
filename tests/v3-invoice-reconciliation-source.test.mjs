import assert from 'node:assert/strict';
import test from 'node:test';

import {
  NeonV3InvoiceReconciliationSourceError,
  createNeonV3InvoiceReconciliationSource,
} from '../server/adapters/neon-v3-invoice-reconciliation-source.mjs';

const DATABASE_URL = 'postgresql://runtime:secret@ep-test.neon.tech/legend?sslmode=require';
const NOW = 1_800_500_000;

function row(referenceChar, invoiceId, reason, dueAt) {
  return {
    order_reference: referenceChar.repeat(64),
    invoice_id: invoiceId,
    reconciliation_reason: reason,
    reconciliation_due_at: dueAt,
  };
}

function createSource(rows, onQuery = () => {}) {
  return createNeonV3InvoiceReconciliationSource({
    connectionString: DATABASE_URL,
    clientFactory: async () => ({
      async connect() {},
      async query(statement, values) {
        onQuery(String(statement), values);
        return { rows };
      },
      async end() {},
    }),
  });
}

test('listCandidates performs one bounded read-only scan for only due Profile-1 V3 invoice work', async () => {
  let queryCount = 0;
  const source = createSource([
    row('a', 10, 'missing', NOW - 400),
    row('b', 11, 'pending', NOW - 300),
    row('c', 12, 'failed_due', NOW - 200),
    row('d', 13, 'stale_sending', NOW - 100),
  ], (statement, values) => {
    queryCount += 1;
    assert.match(statement, /FROM legend_commerce\.orders AS o/);
    assert.match(statement, /INNER JOIN legend_commerce\.invoices AS i/);
    assert.match(statement, /LEFT JOIN legend_commerce\.order_notifications AS n/);
    assert.match(statement, /o\.status = 'paid'/);
    assert.match(statement, /o\.mode = 'live'/);
    assert.match(statement, /o\.document_profile_version = 1/);
    assert.match(statement, /n\.notification_type = 'customer_v3_invoice'/);
    assert.match(statement, /n\.next_attempt_at IS NOT NULL/);
    assert.match(statement, /n\.delivery_attempts < \$4/);
    assert.match(statement, /ORDER BY reconciliation_due_at ASC, o\.reference ASC/);
    assert.doesNotMatch(statement, /FOR UPDATE|\bUPDATE\b|\bINSERT\b|\bDELETE\b/i);
    assert.deepEqual(values, [NOW, 25, 300, 5]);
  });

  const candidates = await source.listCandidates({ dueAt: NOW });

  assert.equal(queryCount, 1);
  assert.deepEqual(candidates, [
    {
      order: {
        reference: 'a'.repeat(64),
        status: 'paid',
        mode: 'live',
        documentProfileVersion: 1,
        invoiceId: 10,
      },
      reason: 'missing',
      dueAt: NOW - 400,
    },
    {
      order: {
        reference: 'b'.repeat(64),
        status: 'paid',
        mode: 'live',
        documentProfileVersion: 1,
        invoiceId: 11,
      },
      reason: 'pending',
      dueAt: NOW - 300,
    },
    {
      order: {
        reference: 'c'.repeat(64),
        status: 'paid',
        mode: 'live',
        documentProfileVersion: 1,
        invoiceId: 12,
      },
      reason: 'failed_due',
      dueAt: NOW - 200,
    },
    {
      order: {
        reference: 'd'.repeat(64),
        status: 'paid',
        mode: 'live',
        documentProfileVersion: 1,
        invoiceId: 13,
      },
      reason: 'stale_sending',
      dueAt: NOW - 100,
    },
  ]);
});

test('listCandidates enforces the locked maximum batch size of 25', async () => {
  const source = createSource([]);
  await assert.rejects(
    source.listCandidates({ dueAt: NOW, limit: 26 }),
    (error) => error instanceof NeonV3InvoiceReconciliationSourceError
      && error.code === 'INVALID_V3_RECONCILIATION_REQUEST',
  );
});

test('listCandidates fails closed on an unexpected candidate category', async () => {
  const source = createSource([
    row('e', 14, 'sent', NOW),
  ]);
  await assert.rejects(
    source.listCandidates({ dueAt: NOW }),
    (error) => error instanceof NeonV3InvoiceReconciliationSourceError
      && error.code === 'INVALID_V3_RECONCILIATION_RESULT',
  );
});
