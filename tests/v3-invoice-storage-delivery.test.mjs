import assert from 'node:assert/strict';
import test from 'node:test';

import { createV3CustomerInvoiceDeliveryOrchestrator } from '../server/notifications/v3-customer-invoice-delivery-orchestrator.mjs';

const reference = 'd'.repeat(64);
const invoiceId = 77;
const paidAt = 1_800_400_010;
const pdfBytes = Buffer.from('%PDF-1.4\nstored-v3-proof\n', 'utf8');
const pdfSha256 = 'a'.repeat(64);

function order() {
  return {
    reference,
    status: 'paid',
    mode: 'live',
    documentProfileVersion: 1,
    invoiceId,
  };
}

function durableInvoice() {
  return Object.freeze({
    orderReference: reference,
    invoiceId,
    snapshotSchemaVersion: 1,
    snapshot: Object.freeze({
      schemaVersion: 1,
      order: Object.freeze({ reference, paidAt }),
      customer: Object.freeze({ email: 'durable@example.test' }),
      document: Object.freeze({ invoiceNumber: 'INVOICE-77' }),
    }),
  });
}

function artifact() {
  return Object.freeze({
    bytes: pdfBytes,
    filename: 'invoice-INVOICE-77.pdf',
    rendererVersion: 1,
    sha256: pdfSha256,
    byteLength: pdfBytes.byteLength,
  });
}

function createHarness({ state, storageError = null, clock = [] } = {}) {
  const calls = [];
  const durable = durableInvoice();
  const rendered = artifact();
  let clockIndex = 0;
  const now = () => clock[Math.min(clockIndex++, clock.length - 1)];

  const invoiceSource = {
    async loadIssuedInvoiceForDelivery(args) {
      calls.push(['source', args]);
      return durable;
    },
  };
  const notificationStore = {
    async ensureNotification(args) {
      calls.push(['ensure', args]);
      return { created: true, notification: { deliveryStatus: 'pending' } };
    },
    async claimNotification(args) {
      calls.push(['claim', args]);
      return {
        claimed: true,
        notification: {
          deliveryStatus: 'sending',
          deliveryAttempts: 1,
          claimToken: 'claim-77',
        },
      };
    },
    async prepareV3InvoiceArtifact(args) {
      calls.push(['prepare', args]);
      return { deliveryStatus: 'sending', ...args };
    },
    async recordDelivery(args) {
      calls.push(['record', args]);
      return { deliveryStatus: args.status, ...args };
    },
  };
  const artifactStore = {
    async loadArtifactState(args) {
      calls.push(['artifact-state', args]);
      return state || {
        invoiceId,
        orderReference: reference,
        snapshotSchemaVersion: 1,
        rendererVersion: null,
        pdfSha256: null,
        pdfByteLength: null,
        attachmentFilename: null,
        storageBackend: null,
        storageKey: null,
        storageBound: false,
      };
    },
    async bindStoredArtifact(args) {
      calls.push(['bind', args]);
      return {
        ...args,
        attachmentFilename: args.attachmentFilename,
        storageBound: true,
      };
    },
  };
  const pdfStore = {
    async persistVerifiedArtifact(args) {
      calls.push(['persist', args]);
      if (storageError) throw storageError;
      return {
        storageBackend: 'netlify_blobs',
        storageKey: `v1/invoices/${invoiceId}/${pdfSha256}.pdf`,
        bytes: pdfBytes,
      };
    },
    async loadVerifiedArtifact(args) {
      calls.push(['load', args]);
      if (storageError) throw storageError;
      return {
        storageBackend: args.storageBackend,
        storageKey: args.storageKey,
        bytes: pdfBytes,
      };
    },
  };
  const pdfRenderer = async (args) => {
    calls.push(['pdf', args]);
    return rendered;
  };
  const emailRenderer = async (args) => {
    calls.push(['email', args]);
    return {
      subject: 'invoice',
      text: 'invoice',
      html: '<p>invoice</p>',
      rendererVersion: 2,
    };
  };
  const notifier = {
    async sendV3InvoiceEmail(args) {
      calls.push(['send', args]);
      return { providerMessageId: 'resend-77' };
    },
  };

  return {
    calls,
    deliver: createV3CustomerInvoiceDeliveryOrchestrator({
      invoiceSource,
      notificationStore,
      artifactStore,
      pdfStore,
      notifier,
      pdfRenderer,
      emailRenderer,
      emailsEnabled: 'true',
      storageEnabled: 'true',
      now,
    }),
  };
}

function names(calls) {
  return calls.map(([name]) => name);
}

function call(calls, name) {
  return calls.find(([callName]) => callName === name)?.[1];
}

test('first storage-enabled delivery prepares durable artifact identity before store, binding and send', async () => {
  const harness = createHarness({
    clock: [1_800_400_100, 1_800_400_101, 1_800_400_102, 1_800_400_103],
  });

  const result = await harness.deliver(order());
  assert.equal(result.status, 'sent');
  assert.deepEqual(names(harness.calls), [
    'source', 'ensure', 'claim', 'artifact-state', 'pdf', 'prepare',
    'persist', 'bind', 'email', 'send', 'record',
  ]);
  assert.ok(names(harness.calls).indexOf('prepare') < names(harness.calls).indexOf('persist'));
  assert.ok(names(harness.calls).indexOf('bind') < names(harness.calls).indexOf('send'));

  assert.deepEqual(call(harness.calls, 'prepare'), {
    orderReference: reference,
    invoiceId,
    claimToken: 'claim-77',
    rendererVersion: 1,
    pdfSha256,
    pdfByteLength: pdfBytes.byteLength,
    attachmentFilename: 'invoice-INVOICE-77.pdf',
    updatedAt: 1_800_400_101,
  });
  assert.equal(call(harness.calls, 'bind').storedAt, 1_800_400_102);
  assert.strictEqual(call(harness.calls, 'send').attachment.bytes, pdfBytes);
});

test('retry with an existing durable storage binding loads exact bytes and never re-renders or rewrites', async () => {
  const storageKey = `v1/invoices/${invoiceId}/${pdfSha256}.pdf`;
  const harness = createHarness({
    state: {
      invoiceId,
      orderReference: reference,
      snapshotSchemaVersion: 1,
      rendererVersion: 1,
      pdfSha256,
      pdfByteLength: pdfBytes.byteLength,
      attachmentFilename: 'invoice-INVOICE-77.pdf',
      storageBackend: 'netlify_blobs',
      storageKey,
      storageBound: true,
    },
    clock: [1_800_401_100, 1_800_401_101],
  });

  const result = await harness.deliver(order());
  assert.equal(result.status, 'sent');
  assert.deepEqual(names(harness.calls), [
    'source', 'ensure', 'claim', 'artifact-state', 'load', 'email', 'send', 'record',
  ]);
  assert.equal(names(harness.calls).includes('pdf'), false);
  assert.equal(names(harness.calls).includes('prepare'), false);
  assert.equal(names(harness.calls).includes('persist'), false);
  assert.equal(names(harness.calls).includes('bind'), false);
  assert.equal(call(harness.calls, 'load').storageKey, storageKey);
  assert.strictEqual(call(harness.calls, 'send').attachment.bytes, pdfBytes);
});

test('storage failure is terminal for automatic delivery and never reaches Resend', async () => {
  const error = Object.assign(new Error('synthetic Blob outage'), {
    code: 'V3_INVOICE_STORAGE_UNAVAILABLE',
  });
  const harness = createHarness({
    storageError: error,
    clock: [1_800_402_100, 1_800_402_101, 1_800_402_102],
  });

  const result = await harness.deliver(order());
  assert.equal(result.status, 'failed');
  assert.equal(result.errorCode, 'V3_INVOICE_STORAGE_UNAVAILABLE');
  assert.equal(names(harness.calls).includes('send'), false);
  const failed = call(harness.calls, 'record');
  assert.equal(failed.status, 'failed');
  assert.equal(failed.errorCode, 'V3_INVOICE_STORAGE_UNAVAILABLE');
  assert.equal(Object.hasOwn(failed, 'nextAttemptAt'), false);
});
