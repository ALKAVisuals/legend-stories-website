import assert from 'node:assert/strict';
import test from 'node:test';

import {
  V3InvoiceReconciliationWorkerError,
  createV3InvoiceReconciliationWorker,
} from '../server/notifications/v3-invoice-reconciliation-worker.mjs';

const NOW = 1_800_600_000;

function candidate(char, invoiceId, reason = 'failed_due') {
  return {
    order: {
      reference: char.repeat(64),
      status: 'paid',
      mode: 'live',
      documentProfileVersion: 1,
      invoiceId,
    },
    reason,
    dueAt: NOW - invoiceId,
  };
}

test('worker requests one max-25 due batch and processes candidates in source order through only the V3 delivery boundary', async () => {
  const listCalls = [];
  const deliveryCalls = [];
  const source = {
    async listCandidates(args) {
      listCalls.push(args);
      return [
        candidate('a', 1, 'missing'),
        candidate('b', 2, 'pending'),
        candidate('c', 3, 'failed_due'),
        candidate('d', 4, 'stale_sending'),
      ];
    },
  };

  const outcomes = [
    { status: 'sent' },
    { status: 'failed' },
    { status: 'sent', duplicate: true },
    { status: 'skipped', skipped: true },
  ];
  const worker = createV3InvoiceReconciliationWorker({
    source,
    now: () => NOW,
    async deliverV3CustomerInvoice(order) {
      deliveryCalls.push(order);
      return outcomes[deliveryCalls.length - 1];
    },
  });

  const result = await worker();

  assert.deepEqual(listCalls, [{ dueAt: NOW, limit: 25 }]);
  assert.deepEqual(deliveryCalls.map((order) => order.reference), [
    'a'.repeat(64),
    'b'.repeat(64),
    'c'.repeat(64),
    'd'.repeat(64),
  ]);
  assert.equal(deliveryCalls.every((order) => (
    order.status === 'paid'
    && order.mode === 'live'
    && order.documentProfileVersion === 1
  )), true);
  assert.deepEqual(result, {
    startedAt: NOW,
    selected: 4,
    sent: 1,
    failed: 1,
    duplicate: 1,
    skipped: 1,
  });
});

test('worker isolates one candidate failure and continues the bounded batch without changing delivery scope', async () => {
  const deliveryCalls = [];
  const logs = [];
  const worker = createV3InvoiceReconciliationWorker({
    source: {
      async listCandidates() {
        return [candidate('e', 5), candidate('f', 6), candidate('a', 7)];
      },
    },
    now: () => NOW,
    logger: {
      error(message, metadata) {
        logs.push({ message, metadata });
      },
    },
    async deliverV3CustomerInvoice(order) {
      deliveryCalls.push(order.reference);
      if (order.reference === 'f'.repeat(64)) {
        const error = new Error('synthetic durable source failure');
        error.code = 'TEST_SOURCE_FAILURE';
        throw error;
      }
      return { status: 'sent' };
    },
  });

  const result = await worker();

  assert.deepEqual(deliveryCalls, ['e'.repeat(64), 'f'.repeat(64), 'a'.repeat(64)]);
  assert.deepEqual(result, {
    startedAt: NOW,
    selected: 3,
    sent: 2,
    failed: 1,
    duplicate: 0,
    skipped: 0,
  });
  assert.equal(logs.length, 1);
  assert.deepEqual(logs[0].metadata, {
    reference: 'f'.repeat(64),
    code: 'TEST_SOURCE_FAILURE',
  });
});

test('worker fails a non-Profile-1 candidate closed and never passes it to delivery', async () => {
  let deliveryCalls = 0;
  const worker = createV3InvoiceReconciliationWorker({
    source: {
      async listCandidates() {
        return [{
          ...candidate('b', 8),
          order: {
            ...candidate('b', 8).order,
            documentProfileVersion: 0,
          },
        }];
      },
    },
    now: () => NOW,
    logger: { error() {} },
    async deliverV3CustomerInvoice() {
      deliveryCalls += 1;
      return { status: 'sent' };
    },
  });

  const result = await worker();
  assert.equal(deliveryCalls, 0);
  assert.equal(result.failed, 1);
  assert.equal(result.selected, 1);
});

test('worker rejects a reconciliation source that exceeds the locked batch size', async () => {
  const worker = createV3InvoiceReconciliationWorker({
    source: {
      async listCandidates() {
        return Array.from({ length: 26 }, (_, index) => candidate('c', index + 1));
      },
    },
    now: () => NOW,
    async deliverV3CustomerInvoice() {
      return { status: 'sent' };
    },
  });

  await assert.rejects(
    worker(),
    (error) => error instanceof V3InvoiceReconciliationWorkerError
      && error.code === 'V3_RECONCILIATION_SOURCE_INVALID',
  );
});
