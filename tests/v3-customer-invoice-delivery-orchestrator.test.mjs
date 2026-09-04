import test from 'node:test';
import assert from 'node:assert/strict';

import {
  createV3CustomerInvoiceDeliveryOrchestrator,
  V3CustomerInvoiceDeliveryError,
} from '../server/notifications/v3-customer-invoice-delivery-orchestrator.mjs';

const reference = 'd'.repeat(64);
const invoiceId = 77;
const paidAt = 1_800_400_010;

function profile1Order(overrides = {}) {
  return {
    reference,
    status: 'paid',
    mode: 'live',
    documentProfileVersion: 1,
    invoiceId,
    amountTotal: 5390,
    customer: { email: 'mutable-order-address@example.invalid' },
    ...overrides,
  };
}

function durableInvoice() {
  const snapshot = Object.freeze({
    schemaVersion: 1,
    order: Object.freeze({ reference, paidAt }),
    customer: Object.freeze({ email: 'durable-customer@example.invalid' }),
    document: Object.freeze({
      orderNumber: 'ORDER-SYNTHETIC-42',
      invoiceNumber: 'INVOICE-SYNTHETIC-77',
    }),
  });
  return Object.freeze({
    orderReference: reference,
    invoiceId,
    orderNumber: 'ORDER-SYNTHETIC-42',
    invoiceNumber: 'INVOICE-SYNTHETIC-77',
    snapshotSchemaVersion: 1,
    snapshot,
  });
}

function createHarness({
  claim = null,
  prepareError = null,
  sendError = null,
  sourceError = null,
  emailsEnabled = 'true',
  clockValues = [1_800_400_100, 1_800_400_101, 1_800_400_102],
} = {}) {
  const calls = [];
  const durable = durableInvoice();
  const artifactBytes = Buffer.from('%PDF-1.4\nsynthetic-orchestrator-proof\n', 'utf8');
  const artifact = Object.freeze({
    bytes: artifactBytes,
    filename: 'invoice-INVOICE-SYNTHETIC-77.pdf',
    rendererVersion: 1,
    sha256: 'a'.repeat(64),
    byteLength: artifactBytes.byteLength,
  });
  const renderedEmail = Object.freeze({
    subject: 'Synthetic V3 invoice email',
    text: 'Synthetic text body',
    html: '<p>Synthetic HTML body</p>',
    rendererVersion: 1,
  });

  let clockIndex = 0;
  const now = () => {
    const value = clockValues[Math.min(clockIndex, clockValues.length - 1)];
    clockIndex += 1;
    return value;
  };

  const invoiceSource = {
    async loadIssuedInvoiceForDelivery(args) {
      calls.push(['source', args]);
      if (sourceError) throw sourceError;
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
      return claim || {
        claimed: true,
        notification: {
          deliveryStatus: 'sending',
          claimToken: 'claim-token-77',
        },
      };
    },
    async prepareV3InvoiceArtifact(args) {
      calls.push(['prepare', args]);
      if (prepareError) throw prepareError;
      return { deliveryStatus: 'sending', ...args };
    },
    async recordDelivery(args) {
      calls.push(['record', args]);
      return { deliveryStatus: args.status, ...args };
    },
  };

  const pdfRenderer = async (args) => {
    calls.push(['pdf', args]);
    return artifact;
  };
  const emailRenderer = (args) => {
    calls.push(['email', args]);
    return renderedEmail;
  };
  const notifier = {
    async sendV3InvoiceEmail(args) {
      calls.push(['send', args]);
      if (sendError) throw sendError;
      return { providerMessageId: 'resend-message-77' };
    },
  };

  const deliver = createV3CustomerInvoiceDeliveryOrchestrator({
    invoiceSource,
    notificationStore,
    notifier,
    pdfRenderer,
    emailRenderer,
    emailsEnabled,
    now,
  });

  return { calls, durable, artifact, renderedEmail, deliver };
}

function callsNamed(calls, name) {
  return calls.filter(([callName]) => callName === name).map(([, args]) => args);
}

test('coordinates one claimed customer_v3_invoice delivery from the immutable durable snapshot', async () => {
  const harness = createHarness();
  const order = profile1Order();
  const before = JSON.stringify(order);

  const result = await harness.deliver(order);

  assert.deepEqual(result, {
    notificationType: 'customer_v3_invoice',
    orderReference: reference,
    invoiceId,
    status: 'sent',
    duplicate: false,
    skipped: false,
    reason: null,
  });
  assert.equal(JSON.stringify(order), before);
  assert.deepEqual(harness.calls.map(([name]) => name), [
    'source',
    'ensure',
    'claim',
    'pdf',
    'prepare',
    'email',
    'send',
    'record',
  ]);

  assert.deepEqual(callsNamed(harness.calls, 'source')[0], {
    orderReference: reference,
    invoiceId,
  });
  assert.deepEqual(callsNamed(harness.calls, 'ensure')[0], {
    orderReference: reference,
    notificationType: 'customer_v3_invoice',
    createdAt: paidAt,
    invoiceId,
    snapshotSchemaVersion: 1,
  });
  assert.deepEqual(callsNamed(harness.calls, 'claim')[0], {
    orderReference: reference,
    notificationType: 'customer_v3_invoice',
    attemptedAt: 1_800_400_100,
  });
  assert.strictEqual(callsNamed(harness.calls, 'pdf')[0].snapshot, harness.durable.snapshot);
  assert.deepEqual(callsNamed(harness.calls, 'prepare')[0], {
    orderReference: reference,
    invoiceId,
    claimToken: 'claim-token-77',
    rendererVersion: 1,
    pdfSha256: 'a'.repeat(64),
    pdfByteLength: harness.artifact.byteLength,
    attachmentFilename: 'invoice-INVOICE-SYNTHETIC-77.pdf',
    updatedAt: 1_800_400_101,
  });
  assert.strictEqual(callsNamed(harness.calls, 'email')[0].snapshot, harness.durable.snapshot);

  const send = callsNamed(harness.calls, 'send')[0];
  assert.equal(send.to, 'durable-customer@example.invalid');
  assert.equal(send.to === order.customer.email, false);
  assert.equal(send.orderReference, reference);
  assert.strictEqual(send.renderedEmail, harness.renderedEmail);
  assert.equal(send.attachment.filename, harness.artifact.filename);
  assert.strictEqual(send.attachment.bytes, harness.artifact.bytes);

  assert.deepEqual(callsNamed(harness.calls, 'record')[0], {
    orderReference: reference,
    notificationType: 'customer_v3_invoice',
    status: 'sent',
    attemptedAt: 1_800_400_102,
    providerMessageId: 'resend-message-77',
    claimToken: 'claim-token-77',
  });
});

test('does not render or send when the durable notification is already claimed or delivered', async () => {
  const harness = createHarness({
    claim: {
      claimed: false,
      notification: { deliveryStatus: 'sent', claimToken: null },
    },
  });

  const result = await harness.deliver(profile1Order());

  assert.equal(result.status, 'sent');
  assert.equal(result.duplicate, true);
  assert.deepEqual(harness.calls.map(([name]) => name), ['source', 'ensure', 'claim']);
});

test('persists artifact identity before provider send and records provider rejection as failed', async () => {
  const providerError = Object.assign(new Error('synthetic provider rejection'), {
    code: 'RESEND_PAID_ORDER_DELIVERY_REJECTED',
  });
  const harness = createHarness({ sendError: providerError });

  const result = await harness.deliver(profile1Order());

  assert.equal(result.status, 'failed');
  assert.equal(result.errorCode, 'RESEND_PAID_ORDER_DELIVERY_REJECTED');
  assert.deepEqual(harness.calls.map(([name]) => name), [
    'source',
    'ensure',
    'claim',
    'pdf',
    'prepare',
    'email',
    'send',
    'record',
  ]);
  assert.ok(
    harness.calls.findIndex(([name]) => name === 'prepare')
      < harness.calls.findIndex(([name]) => name === 'send'),
  );

  const failed = callsNamed(harness.calls, 'record')[0];
  assert.deepEqual(failed, {
    orderReference: reference,
    notificationType: 'customer_v3_invoice',
    status: 'failed',
    attemptedAt: 1_800_400_102,
    errorCode: 'RESEND_PAID_ORDER_DELIVERY_REJECTED',
    claimToken: 'claim-token-77',
  });
  assert.equal(Object.hasOwn(failed, 'nextAttemptAt'), false);
});

test('fails closed on artifact identity conflict before rendering email or calling the provider', async () => {
  const artifactError = Object.assign(new Error('synthetic artifact mismatch'), {
    code: 'ORDER_NOTIFICATION_ARTIFACT_MISMATCH',
  });
  const harness = createHarness({ prepareError: artifactError });

  const result = await harness.deliver(profile1Order());

  assert.equal(result.status, 'failed');
  assert.equal(result.errorCode, 'ORDER_NOTIFICATION_ARTIFACT_MISMATCH');
  assert.equal(callsNamed(harness.calls, 'email').length, 0);
  assert.equal(callsNamed(harness.calls, 'send').length, 0);
  assert.deepEqual(callsNamed(harness.calls, 'record')[0], {
    orderReference: reference,
    notificationType: 'customer_v3_invoice',
    status: 'failed',
    attemptedAt: 1_800_400_102,
    errorCode: 'ORDER_NOTIFICATION_ARTIFACT_MISMATCH',
    claimToken: 'claim-token-77',
  });
});

test('bubbles durable invoice identity/source failure before claiming any delivery row', async () => {
  const sourceError = Object.assign(new Error('synthetic durable identity mismatch'), {
    code: 'V3_INVOICE_DELIVERY_IDENTITY_MISMATCH',
  });
  const harness = createHarness({ sourceError });

  await assert.rejects(
    harness.deliver(profile1Order()),
    (error) => error === sourceError,
  );
  assert.deepEqual(harness.calls.map(([name]) => name), ['source']);
});

test('skips disabled, unpaid and non-live delivery without loading durable invoice state', async () => {
  const disabled = createHarness({ emailsEnabled: 'false' });
  const disabledResult = await disabled.deliver(profile1Order());
  assert.equal(disabledResult.skipped, true);
  assert.equal(disabledResult.reason, 'disabled');
  assert.equal(disabled.calls.length, 0);

  const unpaid = createHarness();
  const unpaidResult = await unpaid.deliver(profile1Order({ status: 'payment_pending' }));
  assert.equal(unpaidResult.skipped, true);
  assert.equal(unpaidResult.reason, 'not_paid');
  assert.equal(unpaid.calls.length, 0);

  const testMode = createHarness();
  const testModeResult = await testMode.deliver(profile1Order({ mode: 'test' }));
  assert.equal(testModeResult.skipped, true);
  assert.equal(testModeResult.reason, 'not_live');
  assert.equal(testMode.calls.length, 0);
});

test('fails closed when called directly with a non-Profile-1 order or invalid invoice identity', async () => {
  const harness = createHarness();

  await assert.rejects(
    harness.deliver(profile1Order({ documentProfileVersion: 0 })),
    (error) => error instanceof V3CustomerInvoiceDeliveryError
      && error.code === 'V3_INVOICE_DELIVERY_PROFILE_MISMATCH',
  );
  await assert.rejects(
    harness.deliver(profile1Order({ invoiceId: null })),
    (error) => error instanceof V3CustomerInvoiceDeliveryError
      && error.code === 'INVALID_V3_INVOICE_DELIVERY_ORDER'
      && error.details.field === 'invoiceId',
  );
  assert.equal(harness.calls.length, 0);
});
