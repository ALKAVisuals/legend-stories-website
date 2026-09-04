import test from 'node:test';
import assert from 'node:assert/strict';

import {
  createProfile1PaidOrderDeliveryComposition,
  Profile1PaidOrderDeliveryCompositionError,
} from '../server/notifications/profile1-paid-order-delivery-composition.mjs';

function profile1Order(overrides = {}) {
  return {
    reference: 'e'.repeat(64),
    status: 'paid',
    mode: 'live',
    paidAt: 1_800_500_010,
    documentProfileVersion: 1,
    invoiceId: 88,
    customer: {
      email: 'customer@example.com',
    },
    ...overrides,
  };
}

function recordingStore() {
  const calls = [];
  return {
    calls,
    async ensureNotification(args) {
      calls.push(['ensure', args]);
      return { created: true, notification: { deliveryStatus: 'pending' } };
    },
    async claimNotification(args) {
      calls.push(['claim', args]);
      return { claimed: true, notification: { deliveryStatus: 'sending' } };
    },
    async recordDelivery(args) {
      calls.push(['record', args]);
      return { deliveryStatus: args.status };
    },
  };
}

function createHarness({ merchantSendError = null, v3Error = null } = {}) {
  const store = recordingStore();
  const legacySends = [];
  const v3Calls = [];
  const notifier = {
    async sendPaidOrderEmail(args) {
      legacySends.push(args);
      if (merchantSendError) throw merchantSendError;
      return { providerMessageId: 'merchant-message-1' };
    },
  };
  const deliverV3CustomerInvoice = async (order) => {
    v3Calls.push(order);
    if (v3Error) throw v3Error;
    return Object.freeze({
      notificationType: 'customer_v3_invoice',
      status: 'sent',
      duplicate: false,
    });
  };
  const deliver = createProfile1PaidOrderDeliveryComposition({
    notificationStore: store,
    notifier,
    deliverV3CustomerInvoice,
    emailsEnabled: 'true',
    merchantTo: 'orders@legendmural.com',
    now: () => 1_800_500_100,
  });
  return { store, legacySends, v3Calls, deliver };
}

test('Profile 1 preserves merchant_paid_order and replaces legacy customer_paid_order with customer_v3_invoice', async () => {
  const harness = createHarness();
  const order = profile1Order();

  const result = await harness.deliver(order);

  assert.equal(result.documentProfileVersion, 1);
  assert.equal(result.failed, false);
  assert.deepEqual(
    result.merchant.deliveries.map((delivery) => [delivery.notificationType, delivery.status]),
    [['merchant_paid_order', 'sent']],
  );
  assert.equal(result.customer.notificationType, 'customer_v3_invoice');
  assert.equal(result.customer.status, 'sent');

  assert.deepEqual(
    harness.legacySends.map((message) => [message.notificationType, message.to]),
    [['merchant_paid_order', 'orders@legendmural.com']],
  );
  assert.equal(
    harness.legacySends.some((message) => message.notificationType === 'customer_paid_order'),
    false,
  );
  assert.equal(
    harness.store.calls.some(([, args]) => args.notificationType === 'customer_paid_order'),
    false,
  );
  assert.equal(harness.v3Calls.length, 1);
  assert.equal(harness.v3Calls[0], order);
});

test('missing merchant recipient does not suppress the V3 customer invoice path', async () => {
  const store = recordingStore();
  const v3Calls = [];
  const deliver = createProfile1PaidOrderDeliveryComposition({
    notificationStore: store,
    notifier: {
      async sendPaidOrderEmail() {
        throw new Error('merchant notifier must not run without recipient');
      },
    },
    deliverV3CustomerInvoice: async (order) => {
      v3Calls.push(order);
      return { notificationType: 'customer_v3_invoice', status: 'sent' };
    },
    emailsEnabled: 'true',
    merchantTo: '',
  });

  const result = await deliver(profile1Order());

  assert.equal(result.merchant.skipped, true);
  assert.equal(result.merchant.reason, 'recipients_missing');
  assert.equal(result.customer.status, 'sent');
  assert.equal(v3Calls.length, 1);
  assert.equal(store.calls.length, 0);
});

test('merchant provider failure is durable and does not suppress customer_v3_invoice', async () => {
  const error = new Error('merchant provider unavailable');
  error.code = 'MERCHANT_PROVIDER_FAILURE';
  const harness = createHarness({ merchantSendError: error });

  const result = await harness.deliver(profile1Order());

  assert.equal(result.failed, true);
  assert.equal(result.merchant.deliveries[0].notificationType, 'merchant_paid_order');
  assert.equal(result.merchant.deliveries[0].status, 'failed');
  assert.equal(result.merchant.deliveries[0].errorCode, 'MERCHANT_PROVIDER_FAILURE');
  assert.equal(result.customer.status, 'sent');
  assert.equal(harness.v3Calls.length, 1);
  assert.equal(
    harness.store.calls.some(([, args]) => (
      args.notificationType === 'merchant_paid_order'
      && args.status === 'failed'
      && args.errorCode === 'MERCHANT_PROVIDER_FAILURE'
    )),
    true,
  );
});

test('V3 customer failure does not remove an independently successful merchant notification', async () => {
  const error = new Error('durable invoice source unavailable');
  error.code = 'V3_DURABLE_SOURCE_FAILURE';
  const harness = createHarness({ v3Error: error });

  const result = await harness.deliver(profile1Order());

  assert.equal(result.failed, true);
  assert.equal(result.merchant.deliveries[0].status, 'sent');
  assert.deepEqual(result.customer, {
    failed: true,
    errorCode: 'V3_DURABLE_SOURCE_FAILURE',
  });
  assert.deepEqual(
    harness.legacySends.map((message) => message.notificationType),
    ['merchant_paid_order'],
  );
});

test('an unexpected merchant-boundary failure is isolated so the V3 customer path still runs', async () => {
  const v3Calls = [];
  const merchantError = new Error('merchant boundary misconfigured');
  merchantError.code = 'MERCHANT_BOUNDARY_FAILURE';
  const deliver = createProfile1PaidOrderDeliveryComposition({
    deliverMerchantPaidOrder: async () => {
      throw merchantError;
    },
    deliverV3CustomerInvoice: async (order) => {
      v3Calls.push(order);
      return { notificationType: 'customer_v3_invoice', status: 'sent' };
    },
  });

  const result = await deliver(profile1Order());

  assert.deepEqual(result.merchant, {
    failed: true,
    errorCode: 'MERCHANT_BOUNDARY_FAILURE',
  });
  assert.equal(result.customer.status, 'sent');
  assert.equal(result.failed, true);
  assert.equal(v3Calls.length, 1);
});

test('composition fails closed when invoked directly for a non-Profile-1 order', async () => {
  const calls = [];
  const deliver = createProfile1PaidOrderDeliveryComposition({
    deliverMerchantPaidOrder: async () => {
      calls.push('merchant');
    },
    deliverV3CustomerInvoice: async () => {
      calls.push('customer');
    },
  });

  await assert.rejects(
    deliver(profile1Order({ documentProfileVersion: 0 })),
    (error) => error instanceof Profile1PaidOrderDeliveryCompositionError
      && error.code === 'PROFILE1_DELIVERY_COMPOSITION_MISMATCH'
      && error.details.documentProfileVersion === 0,
  );
  assert.deepEqual(calls, []);
});
