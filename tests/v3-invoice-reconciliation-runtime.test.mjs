import assert from 'node:assert/strict';
import test from 'node:test';

import {
  config as scheduledConfig,
  createNetlifyV3InvoiceReconciliationHandler,
} from '../netlify/functions/reconcile-v3-invoices.mjs';
import { createV3InvoiceReconciliationRuntime } from '../server/netlify/v3-invoice-reconciliation-runtime.mjs';

const NOW = 1_800_700_000;
const reference = 'a'.repeat(64);

function env(overrides = {}) {
  return {
    V3_INVOICE_RECONCILIATION_ENABLED: 'true',
    ORDER_EMAILS_ENABLED: 'true',
    NEON_DATABASE_URL: 'postgresql://runtime:secret@ep-test.neon.tech/legend?sslmode=require',
    RESEND_API_KEY: 'fake-key-for-unit-test',
    RESEND_FROM: 'LegendMural <orders@example.test>',
    RESEND_REPLY_TO: 'info@example.test',
    ...overrides,
  };
}

test('runtime opt-in gate prevents all Neon and Resend dependency initialization by default', async () => {
  let factoryCalls = 0;
  const forbidden = () => {
    factoryCalls += 1;
    throw new Error('dependency must not initialize');
  };
  const run = createV3InvoiceReconciliationRuntime({
    env: env({ V3_INVOICE_RECONCILIATION_ENABLED: 'false' }),
    reconciliationSourceFactory: forbidden,
    notificationStoreFactory: forbidden,
    invoiceDeliverySourceFactory: forbidden,
    notifierFactory: forbidden,
    deliveryFactory: forbidden,
    workerFactory: forbidden,
  });

  const result = await run();
  assert.equal(result.skipped, true);
  assert.equal(result.reason, 'reconciliation_disabled');
  assert.equal(factoryCalls, 0);
});

test('runtime also stops before dependency initialization when paid-order email sending is disabled', async () => {
  let factoryCalls = 0;
  const forbidden = () => {
    factoryCalls += 1;
    throw new Error('dependency must not initialize');
  };
  const run = createV3InvoiceReconciliationRuntime({
    env: env({ ORDER_EMAILS_ENABLED: 'false' }),
    reconciliationSourceFactory: forbidden,
    notificationStoreFactory: forbidden,
    invoiceDeliverySourceFactory: forbidden,
    notifierFactory: forbidden,
    deliveryFactory: forbidden,
    workerFactory: forbidden,
  });

  const result = await run();
  assert.equal(result.skipped, true);
  assert.equal(result.reason, 'emails_disabled');
  assert.equal(factoryCalls, 0);
});

test('enabled runtime composes only the V3 reconciliation source and durable customer invoice delivery path', async () => {
  const runtimeEnv = env();
  const calls = [];
  const source = { listCandidates: async () => [] };
  const notificationStore = { name: 'notification-store' };
  const invoiceSource = { name: 'invoice-source' };
  const notifier = { name: 'resend-notifier' };
  const expectedSummary = Object.freeze({
    startedAt: NOW,
    selected: 1,
    sent: 1,
    failed: 0,
    duplicate: 0,
    skipped: 0,
  });

  const run = createV3InvoiceReconciliationRuntime({
    env: runtimeEnv,
    now: () => NOW,
    reconciliationSourceFactory(options) {
      calls.push(['reconciliationSourceFactory', options]);
      return source;
    },
    notificationStoreFactory(options) {
      calls.push(['notificationStoreFactory', options]);
      return notificationStore;
    },
    invoiceDeliverySourceFactory(options) {
      calls.push(['invoiceDeliverySourceFactory', options]);
      return invoiceSource;
    },
    notifierFactory(options) {
      calls.push(['notifierFactory', options]);
      return notifier;
    },
    deliveryFactory(options) {
      assert.equal(options.invoiceSource, invoiceSource);
      assert.equal(options.notificationStore, notificationStore);
      assert.equal(options.notifier, notifier);
      assert.equal(options.emailsEnabled, 'true');
      assert.equal(options.now(), NOW);
      calls.push(['deliveryFactory']);
      return async (order) => {
        assert.deepEqual(order, {
          reference,
          status: 'paid',
          mode: 'live',
          documentProfileVersion: 1,
          invoiceId: 88,
        });
        return { status: 'sent' };
      };
    },
    workerFactory(options) {
      assert.equal(options.source, source);
      assert.equal(options.now(), NOW);
      calls.push(['workerFactory']);
      return async () => {
        const delivery = await options.deliverV3CustomerInvoice({
          reference,
          status: 'paid',
          mode: 'live',
          documentProfileVersion: 1,
          invoiceId: 88,
        });
        assert.equal(delivery.status, 'sent');
        return expectedSummary;
      };
    },
  });

  const result = await run();
  assert.equal(result, expectedSummary);
  assert.deepEqual(calls.slice(0, 4), [
    ['reconciliationSourceFactory', { connectionString: runtimeEnv.NEON_DATABASE_URL }],
    ['notificationStoreFactory', { connectionString: runtimeEnv.NEON_DATABASE_URL }],
    ['invoiceDeliverySourceFactory', { connectionString: runtimeEnv.NEON_DATABASE_URL }],
    ['notifierFactory', {
      apiKey: runtimeEnv.RESEND_API_KEY,
      from: runtimeEnv.RESEND_FROM,
      replyTo: runtimeEnv.RESEND_REPLY_TO,
    }],
  ]);
  assert.equal(calls.some(([name]) => name === 'deliveryFactory'), true);
  assert.equal(calls.some(([name]) => name === 'workerFactory'), true);
});

test('Netlify scheduled function is pinned to every five minutes and returns the runtime summary', async () => {
  assert.deepEqual(scheduledConfig, { schedule: '*/5 * * * *' });
  const handler = createNetlifyV3InvoiceReconciliationHandler({
    runtimeFactory() {
      return async () => ({
        startedAt: NOW,
        selected: 2,
        sent: 1,
        failed: 1,
        duplicate: 0,
        skipped: 0,
      });
    },
  });

  const response = await handler();
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.deepEqual(await response.json(), {
    startedAt: NOW,
    selected: 2,
    sent: 1,
    failed: 1,
    duplicate: 0,
    skipped: 0,
  });
});

test('Netlify scheduled function surfaces runtime bootstrap failures without exposing error detail', async () => {
  const logs = [];
  const handler = createNetlifyV3InvoiceReconciliationHandler({
    logger: {
      error(message, metadata) {
        logs.push({ message, metadata });
      },
    },
    runtimeFactory() {
      return async () => {
        const error = new Error('secret database detail must not be returned');
        error.code = 'TEST_RECONCILIATION_FAILURE';
        throw error;
      };
    },
  });

  const response = await handler();
  assert.equal(response.status, 500);
  assert.deepEqual(await response.json(), {
    failed: true,
    code: 'V3_INVOICE_RECONCILIATION_RUNTIME_FAILED',
  });
  assert.deepEqual(logs[0].metadata, {
    name: 'Error',
    code: 'TEST_RECONCILIATION_FAILURE',
  });
});
