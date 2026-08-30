import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import {
  DocumentNumberAllocatorError,
  reserveDocumentNumberValue,
  reserveOrderAndInvoiceNumberValues,
} from '../server/commerce/document-number-allocator.mjs';

function scriptedClient(steps) {
  return {
    async query(sql, params = []) {
      const normalized = String(sql).replace(/\s+/g, ' ').trim();
      const step = steps.shift();
      assert.ok(step, `Unexpected query: ${normalized}`);
      assert.match(normalized, step.match);
      if (step.params) assert.deepEqual(params, step.params);
      if (step.error) throw step.error;
      return structuredClone(step.result || { rows: [] });
    },
  };
}

test('single allocation creates/resolves, locks, and advances exactly one raw value', async () => {
  const steps = [
    {
      match: /^INSERT INTO legend_commerce\.document_number_series/,
      params: ['order', '2026', 1_800_000_000],
    },
    {
      match: /^SELECT next_value, updated_at FROM legend_commerce\.document_number_series .* FOR UPDATE$/,
      params: ['order', '2026'],
      result: { rows: [{ next_value: '1', updated_at: '1799999999' }] },
    },
    {
      match: /^UPDATE legend_commerce\.document_number_series SET next_value = \$3,/,
      params: ['order', '2026', 2, 1_800_000_000, 1],
      result: { rows: [{ next_value: '2', updated_at: '1800000000' }] },
    },
  ];

  const result = await reserveDocumentNumberValue(scriptedClient(steps), {
    documentType: 'order',
    seriesKey: '2026',
    updatedAt: 1_800_000_000,
  });

  assert.deepEqual(result, {
    documentType: 'order',
    seriesKey: '2026',
    value: 1,
    nextValue: 2,
    updatedAt: 1_800_000_000,
  });
  assert.equal(steps.length, 0);
  assert.equal(Object.isFrozen(result), true);
});

test('paired allocation always locks order before invoice and keeps counters independent', async () => {
  const steps = [
    { match: /^INSERT INTO .*document_number_series/, params: ['order', 'alpha', 2_000] },
    {
      match: /^SELECT .*document_number_series .* FOR UPDATE$/,
      params: ['order', 'alpha'],
      result: { rows: [{ next_value: 7, updated_at: 1_999 }] },
    },
    {
      match: /^UPDATE .*document_number_series/,
      params: ['order', 'alpha', 8, 2_000, 7],
      result: { rows: [{ next_value: 8, updated_at: 2_000 }] },
    },
    { match: /^INSERT INTO .*document_number_series/, params: ['invoice', 'beta', 2_000] },
    {
      match: /^SELECT .*document_number_series .* FOR UPDATE$/,
      params: ['invoice', 'beta'],
      result: { rows: [{ next_value: 41, updated_at: 1_998 }] },
    },
    {
      match: /^UPDATE .*document_number_series/,
      params: ['invoice', 'beta', 42, 2_000, 41],
      result: { rows: [{ next_value: 42, updated_at: 2_000 }] },
    },
  ];

  const result = await reserveOrderAndInvoiceNumberValues(scriptedClient(steps), {
    orderSeriesKey: 'alpha',
    invoiceSeriesKey: 'beta',
    updatedAt: 2_000,
  });

  assert.equal(result.order.value, 7);
  assert.equal(result.invoice.value, 41);
  assert.equal(steps.length, 0);
});

test('allocator rejects invalid document type, series key, and timestamp before querying', async () => {
  const neverClient = {
    async query() {
      assert.fail('Invalid allocator input must not reach the database.');
    },
  };

  await assert.rejects(
    () => reserveDocumentNumberValue(neverClient, {
      documentType: 'credit-note',
      seriesKey: '2026',
      updatedAt: 1,
    }),
    (error) => error instanceof DocumentNumberAllocatorError && error.code === 'INVALID_DOCUMENT_TYPE',
  );

  await assert.rejects(
    () => reserveDocumentNumberValue(neverClient, {
      documentType: 'order',
      seriesKey: ' 2026 ',
      updatedAt: 1,
    }),
    (error) => error.code === 'INVALID_DOCUMENT_SERIES_KEY',
  );

  await assert.rejects(
    () => reserveDocumentNumberValue(neverClient, {
      documentType: 'invoice',
      seriesKey: 'x'.repeat(65),
      updatedAt: 1,
    }),
    (error) => error.code === 'INVALID_DOCUMENT_SERIES_KEY',
  );

  await assert.rejects(
    () => reserveDocumentNumberValue(neverClient, {
      documentType: 'invoice',
      seriesKey: '2026',
      updatedAt: -1,
    }),
    (error) => error.code === 'INVALID_DOCUMENT_NUMBER_TIMESTAMP',
  );
});

test('allocator fails hard when durable series state is missing or unsafe', async () => {
  const missingSteps = [
    { match: /^INSERT INTO .*document_number_series/ },
    { match: /^SELECT .* FOR UPDATE$/, result: { rows: [] } },
  ];
  await assert.rejects(
    () => reserveDocumentNumberValue(scriptedClient(missingSteps), {
      documentType: 'order', seriesKey: 's', updatedAt: 1,
    }),
    (error) => error.code === 'DOCUMENT_NUMBER_SERIES_INVARIANT_BROKEN',
  );

  const unsafeSteps = [
    { match: /^INSERT INTO .*document_number_series/ },
    {
      match: /^SELECT .* FOR UPDATE$/,
      result: { rows: [{ next_value: String(Number.MAX_SAFE_INTEGER), updated_at: 1 }] },
    },
  ];
  await assert.rejects(
    () => reserveDocumentNumberValue(scriptedClient(unsafeSteps), {
      documentType: 'invoice', seriesKey: 's', updatedAt: 1,
    }),
    (error) => error.code === 'DOCUMENT_NUMBER_SERIES_INVARIANT_BROKEN',
  );
});

test('allocator stays policy-neutral and does not own transaction boundaries', async () => {
  const source = await readFile(
    new URL('../server/commerce/document-number-allocator.mjs', import.meta.url),
    'utf8',
  );

  assert.doesNotMatch(source, /LM-ORD-/);
  assert.doesNotMatch(source, /LM-INV-/);
  assert.doesNotMatch(source, /\bBEGIN\b\s*(?:ISOLATION|;)/i);
  assert.doesNotMatch(source, /\bCOMMIT\b\s*;/i);
});
