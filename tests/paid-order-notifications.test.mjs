import test from 'node:test';
import assert from 'node:assert/strict';

import { deliverPaidOrderNotifications } from '../server/notifications/paid-order-notifications.mjs';

function paidOrder(overrides = {}) {
  return {
    reference: 'a'.repeat(64),
    status: 'paid',
    mode: 'live',
    paidAt: 1_787_750_000,
    paymentSessionId: '5O190127TN364715T',
    amountTotal: 5495,
    customer: {
      firstname: 'Ada',
      lastname: 'Lovelace',
      email: 'ada@example.com',
      street: 'Schansweg 1',
      line2: '',
      zip: '1234 AB',
      city: 'Nijmegen',
      country: 'NL',
    },
    items: [{
      name: 'LegendMural Test',
      sku: 'LM-TEST-45',
      variantLabel: 'Statement',
      sizeLabel: '45 cm',
      unitPrice: 45,
      quantity: 1,
      lineTotal: 45,
    }],
    discount: { code: '', percent: 0, amount: 0 },
    shipping: { deliveryCountry: 'NL', zone: 'Netherlands', cost: 9.95 },
    totals: {
      subtotal: 4500,
      discount: 0,
      discountedSubtotal: 4500,
      shipping: 995,
      grandTotal: 5495,
    },
    ...overrides,
  };
}

function recordingStore({ claims = {} } = {}) {
  const calls = [];
  return {
    calls,
    async ensureNotification(input) {
      calls.push({ method: 'ensure', ...input });
      return { created: true, notification: { deliveryStatus: 'pending' } };
    },
    async claimNotification(input) {
      calls.push({ method: 'claim', ...input });
      const configured = claims[input.notificationType];
      if (configured === false) {
        return { claimed: false, notification: { deliveryStatus: 'sent' } };
      }
      return { claimed: true, notification: { deliveryStatus: 'sending' } };
    },
    async recordDelivery(input) {
      calls.push({ method: 'record', ...input });
      return { deliveryStatus: input.status };
    },
  };
}

test('kill switch prevents all paid-order email work', async () => {
  const result = await deliverPaidOrderNotifications({
    order: paidOrder(),
    emailsEnabled: 'false',
  });

  assert.equal(result.skipped, true);
  assert.equal(result.reason, 'disabled');
  assert.deepEqual(result.deliveries, []);
});

test('only verified live paid orders may enter email delivery', async () => {
  const pending = await deliverPaidOrderNotifications({
    order: paidOrder({ status: 'payment_pending' }),
    emailsEnabled: 'true',
  });
  assert.equal(pending.reason, 'not_paid');

  const sandbox = await deliverPaidOrderNotifications({
    order: paidOrder({ mode: 'test' }),
    emailsEnabled: 'true',
  });
  assert.equal(sandbox.reason, 'not_live');
});

test('merchant and customer notifications are independently claimed and recorded', async () => {
  const store = recordingStore();
  const sends = [];
  const notifier = {
    async sendPaidOrderEmail(message) {
      sends.push(message);
      return { providerMessageId: `msg-${sends.length}` };
    },
  };

  const result = await deliverPaidOrderNotifications({
    order: paidOrder(),
    notificationStore: store,
    notifier,
    emailsEnabled: 'true',
    merchantTo: 'orders@legendmural.com',
    now: () => 1_787_750_100,
  });

  assert.equal(result.skipped, false);
  assert.deepEqual(result.deliveries.map((entry) => [entry.notificationType, entry.status]), [
    ['merchant_paid_order', 'sent'],
    ['customer_paid_order', 'sent'],
  ]);
  assert.deepEqual(sends.map((entry) => [entry.notificationType, entry.to]), [
    ['merchant_paid_order', 'orders@legendmural.com'],
    ['customer_paid_order', 'ada@example.com'],
  ]);
  assert.equal(store.calls.filter((entry) => entry.method === 'ensure').length, 2);
  assert.equal(store.calls.filter((entry) => entry.method === 'claim').length, 2);
  assert.equal(store.calls.filter((entry) => entry.method === 'record' && entry.status === 'sent').length, 2);
});

test('missing merchant recipient does not suppress the customer confirmation', async () => {
  const store = recordingStore();
  const sends = [];
  const notifier = {
    async sendPaidOrderEmail(message) {
      sends.push(message);
      return { providerMessageId: 'msg-customer' };
    },
  };

  const result = await deliverPaidOrderNotifications({
    order: paidOrder(),
    notificationStore: store,
    notifier,
    emailsEnabled: 'true',
    merchantTo: '',
    now: () => 1_787_750_200,
  });

  assert.deepEqual(result.deliveries.map((entry) => [entry.notificationType, entry.status]), [
    ['merchant_paid_order', 'skipped'],
    ['customer_paid_order', 'sent'],
  ]);
  assert.equal(sends.length, 1);
  assert.equal(sends[0].notificationType, 'customer_paid_order');
});

test('already claimed notification is not sent again', async () => {
  const store = recordingStore({ claims: { merchant_paid_order: false } });
  const sends = [];
  const notifier = {
    async sendPaidOrderEmail(message) {
      sends.push(message);
      return { providerMessageId: 'msg-customer' };
    },
  };

  const result = await deliverPaidOrderNotifications({
    order: paidOrder(),
    notificationStore: store,
    notifier,
    emailsEnabled: 'true',
    merchantTo: 'orders@legendmural.com',
    now: () => 1_787_750_300,
  });

  assert.equal(result.deliveries[0].duplicate, true);
  assert.equal(result.deliveries[0].status, 'sent');
  assert.deepEqual(sends.map((entry) => entry.notificationType), ['customer_paid_order']);
});

test('email failure is recorded without changing or throwing away paid-order truth', async () => {
  const store = recordingStore();
  const notifier = {
    async sendPaidOrderEmail({ notificationType }) {
      if (notificationType === 'merchant_paid_order') {
        const error = new Error('mail unavailable');
        error.code = 'MAIL_TEMPORARY_FAILURE';
        throw error;
      }
      return { providerMessageId: 'msg-customer' };
    },
  };
  const order = paidOrder();

  const result = await deliverPaidOrderNotifications({
    order,
    notificationStore: store,
    notifier,
    emailsEnabled: 'true',
    merchantTo: 'orders@legendmural.com',
    now: () => 1_787_750_400,
  });

  assert.equal(order.status, 'paid');
  assert.equal(result.deliveries[0].status, 'failed');
  assert.equal(result.deliveries[0].errorCode, 'MAIL_TEMPORARY_FAILURE');
  assert.equal(result.deliveries[1].status, 'sent');
  assert.equal(store.calls.some((entry) => (
    entry.method === 'record'
    && entry.notificationType === 'merchant_paid_order'
    && entry.status === 'failed'
    && entry.errorCode === 'MAIL_TEMPORARY_FAILURE'
  )), true);
});
