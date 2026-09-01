import test from 'node:test';
import assert from 'node:assert/strict';

import { createNeonDocumentNumberAllocator } from '../server/adapters/neon-document-number-allocator.mjs';

const DATABASE_URL = 'postgresql://legend:synthetic-test-password@ep-number-pooler.eu-central-1.aws.neon.tech/neondb?sslmode=require';

function seriesId(documentType, seriesKey) {
  return `${documentType}:${seriesKey}`;
}

function cloneState(state) {
  return new Map([...state.entries()].map(([key, value]) => [key, { ...value }]));
}

function createTransactionalFakeDatabase({ failAdvanceAttempts = new Set() } = {}) {
  const committed = new Map();
  let clientCount = 0;
  let commitCount = 0;
  let rollbackCount = 0;

  return {
    committed,
    stats: () => ({ clientCount, commitCount, rollbackCount }),
    async clientFactory() {
      clientCount += 1;
      const attempt = clientCount;
      let transactionState = null;

      return {
        async connect() {},
        async query(sql, params = []) {
          const normalized = String(sql).replace(/\s+/g, ' ').trim();
          if (normalized === 'BEGIN ISOLATION LEVEL SERIALIZABLE') {
            transactionState = cloneState(committed);
            return { rows: [] };
          }
          if (normalized === 'COMMIT') {
            committed.clear();
            for (const [key, value] of transactionState.entries()) committed.set(key, { ...value });
            transactionState = null;
            commitCount += 1;
            return { rows: [] };
          }
          if (normalized === 'ROLLBACK') {
            transactionState = null;
            rollbackCount += 1;
            return { rows: [] };
          }
          if (!transactionState) throw new Error('Query executed outside a fake transaction.');

          const [documentType, seriesKey] = params;
          const key = seriesId(documentType, seriesKey);
          if (normalized.startsWith('INSERT INTO legend_commerce.document_number_series')) {
            if (!transactionState.has(key)) {
              transactionState.set(key, { next_value: 1, updated_at: Number(params[2]) });
            }
            return { rows: [] };
          }
          if (normalized.startsWith('SELECT next_value, updated_at FROM legend_commerce.document_number_series')) {
            const current = transactionState.get(key);
            return { rows: current ? [{ ...current }] : [] };
          }
          if (normalized.startsWith('UPDATE legend_commerce.document_number_series')) {
            const current = transactionState.get(key);
            if (!current) throw new Error('Missing fake document number series.');
            const advanced = {
              next_value: current.next_value + 1,
              updated_at: Math.max(current.updated_at, Number(params[2])),
            };
            transactionState.set(key, advanced);
            if (failAdvanceAttempts.has(attempt)) {
              const error = new Error('synthetic serialization failure after series advance');
              error.code = '40001';
              throw error;
            }
            return { rows: [{ ...advanced }] };
          }
          throw new Error(`Unexpected SQL query: ${normalized}`);
        },
        async end() {},
      };
    },
  };
}

test('allocates current next_value and advances exactly once per committed transaction', async () => {
  const fake = createTransactionalFakeDatabase();
  const allocator = createNeonDocumentNumberAllocator({ connectionString: DATABASE_URL, clientFactory: fake.clientFactory });

  const first = await allocator.transact(({ allocate }) => allocate({ documentType: 'order', seriesKey: '2026', updatedAt: 1_800_200_000 }));
  const second = await allocator.transact(({ allocate }) => allocate({ documentType: 'order', seriesKey: '2026', updatedAt: 1_800_200_001 }));

  assert.deepEqual(first, { documentType: 'order', seriesKey: '2026', value: 1, nextValue: 2 });
  assert.deepEqual(second, { documentType: 'order', seriesKey: '2026', value: 2, nextValue: 3 });
  assert.equal(fake.committed.get(seriesId('order', '2026')).next_value, 3);
  assert.equal(fake.stats().commitCount, 2);
});

test('rolls back an allocated value when later transaction work fails', async () => {
  const fake = createTransactionalFakeDatabase();
  const allocator = createNeonDocumentNumberAllocator({ connectionString: DATABASE_URL, clientFactory: fake.clientFactory });

  await assert.rejects(
    () => allocator.transact(async ({ allocate }) => {
      const allocation = await allocate({ documentType: 'invoice', seriesKey: 'rollback-check', updatedAt: 1_800_200_010 });
      assert.equal(allocation.value, 1);
      const error = new Error('synthetic post-allocation failure');
      error.code = 'SYNTHETIC_FAILURE';
      throw error;
    }),
    (error) => error?.code === 'SYNTHETIC_FAILURE',
  );

  const afterRollback = await allocator.transact(({ allocate }) => allocate({ documentType: 'invoice', seriesKey: 'rollback-check', updatedAt: 1_800_200_011 }));
  assert.equal(afterRollback.value, 1);
  assert.equal(fake.stats().rollbackCount, 1);
});

test('retries the entire serializable transaction after SQLSTATE 40001 after the series was touched', async () => {
  const fake = createTransactionalFakeDatabase({ failAdvanceAttempts: new Set([1]) });
  const allocator = createNeonDocumentNumberAllocator({ connectionString: DATABASE_URL, clientFactory: fake.clientFactory });
  let workRuns = 0;

  const allocation = await allocator.transact(async ({ allocate }) => {
    workRuns += 1;
    return allocate({ documentType: 'order', seriesKey: 'retry-check', updatedAt: 1_800_200_020 });
  });

  assert.equal(workRuns, 2);
  assert.equal(fake.stats().clientCount, 2);
  assert.equal(fake.stats().rollbackCount, 1);
  assert.equal(fake.stats().commitCount, 1);
  assert.equal(allocation.value, 1);
  assert.equal(fake.committed.get(seriesId('order', 'retry-check')).next_value, 2);
});

test('stops after four retryable serialization failures', async () => {
  const fake = createTransactionalFakeDatabase({ failAdvanceAttempts: new Set([1, 2, 3, 4]) });
  const allocator = createNeonDocumentNumberAllocator({ connectionString: DATABASE_URL, clientFactory: fake.clientFactory });
  let workRuns = 0;

  await assert.rejects(
    () => allocator.transact(async ({ allocate }) => {
      workRuns += 1;
      return allocate({ documentType: 'invoice', seriesKey: 'retry-exhausted', updatedAt: 1_800_200_030 });
    }),
    (error) => error?.code === 'DOCUMENT_NUMBER_TRANSACTION_RETRYABLE' && error?.details?.sqlState === '40001',
  );

  assert.equal(workRuns, 4);
  assert.equal(fake.stats().clientCount, 4);
  assert.equal(fake.stats().rollbackCount, 4);
  assert.equal(fake.stats().commitCount, 0);
  assert.equal(fake.committed.has(seriesId('invoice', 'retry-exhausted')), false);
});

test('keeps order and invoice series independent inside one transaction', async () => {
  const fake = createTransactionalFakeDatabase();
  const allocator = createNeonDocumentNumberAllocator({ connectionString: DATABASE_URL, clientFactory: fake.clientFactory });

  const result = await allocator.transact(async ({ allocate }) => ({
    order: await allocate({ documentType: 'order', seriesKey: 'global', updatedAt: 1_800_200_040 }),
    invoice: await allocate({ documentType: 'invoice', seriesKey: 'global', updatedAt: 1_800_200_040 }),
  }));

  assert.equal(result.order.value, 1);
  assert.equal(result.invoice.value, 1);
  assert.equal(fake.committed.get(seriesId('order', 'global')).next_value, 2);
  assert.equal(fake.committed.get(seriesId('invoice', 'global')).next_value, 2);
});
