import test from 'node:test';
import assert from 'node:assert/strict';

import { createPaidOrderNotificationRuntime } from '../server/netlify/paid-order-notification-runtime.mjs';

const reference = 'a'.repeat(64);

function livePaidOrder(overrides = {}) {
  return {
    reference,
    status: 'paid',
    mode: 'live',
    paidAt: 1_788_000_000,
    customer: {
      firstname: 'Test',
      lastname: 'Customer',
      email: 'customer@example.test',
      street: 'Example Street 12',
      city: 'Nijmegen',
      zip: '6500 AA',
      country: 'NL',
    },
    ...overrides,
  };
}

function runtimeEnv(overrides = {}) {
  return {
    ORDER_EMAILS_ENABLED: 'true',
    ORDER_NOTIFICATION_TO: 'merchant@example.test',
    NEON_DATABASE_URL: 'fake-neon-url-for-unit-test',
    RESEND_API_KEY: 'fake-key-for-unit-test',
    RESEND_FROM: 'LegendMural <orders@example.test>',
    RESEND_REPLY_TO: 'info@example.test',
    ...overrides,
  };
}

function createMemoryNotificationStore() {
  const records = new Map();
  const keyFor = ({ orderReference, notificationType }) => `${orderReference}:${notificationType}`;
  return {
    async ensureNotification(args) {
      const key = keyFor(args);
      const created = !records.has(key);
      if (created) records.set(key, { deliveryStatus: 'pending' });
      return { created, notification: { ...records.get(key) } };
    },
    async claimNotification(args) {
      const key = keyFor(args);
      const record = records.get(key);
      if (!record) throw new Error('notification missing');
      if (['pending', 'failed'].includes(record.deliveryStatus)) {
        record.deliveryStatus = 'sending';
        return { claimed: true, notification: { ...record } };
      }
      return { claimed: false, notification: { ...record } };
    },
    async recordDelivery(args) {
      const key = keyFor(args);
      const record = records.get(key);
      if (!record) throw new Error('notification missing');
      record.deliveryStatus = args.status;
      return { ...record };
    },
  };
}

test('disabled paid-order emails do not initialize Neon or Resend dependencies', async () => {
  let storeFactoryCalls = 0;
  let notifierFactoryCalls = 0;
  const reconcile = createPaidOrderNotificationRuntime({
    env: runtimeEnv({ ORDER_EMAILS_ENABLED: 'false' }),
    notificationStoreFactory() {
      storeFactoryCalls += 1;
      throw new Error('must not initialize store');
    },
    notifierFactory() {
      notifierFactoryCalls += 1;
      throw new Error('must not initialize notifier');
    },
  });

  const result = await reconcile(livePaidOrder());
  assert.equal(result.skipped, true);
  assert.equal(result.reason, 'disabled');
  assert.equal(storeFactoryCalls, 0);
  assert.equal(notifierFactoryCalls, 0);
});

test('non-paid and non-live orders skip before dependency initialization', async () => {
  let storeFactoryCalls = 0;
  let notifierFactoryCalls = 0;
  const reconcile = createPaidOrderNotificationRuntime({
    env: runtimeEnv(),
    notificationStoreFactory() {
      storeFactoryCalls += 1;
      throw new Error('must not initialize store');
    },
    notifierFactory() {
      notifierFactoryCalls += 1;
      throw new Error('must not initialize notifier');
    },
  });

  const pending = await reconcile(livePaidOrder({ status: 'payment_pending' }));
  const testMode = await reconcile(livePaidOrder({ mode: 'test' }));
  assert.equal(pending.reason, 'not_paid');
  assert.equal(testMode.reason, 'not_live');
  assert.equal(storeFactoryCalls, 0);
  assert.equal(notifierFactoryCalls, 0);
});

test('enabled live paid order composes configured dependencies and delivers both notifications', async () => {
  const env = runtimeEnv();
  const store = createMemoryNotificationStore();
  const sent = [];
  let storeFactoryCalls = 0;
  let notifierFactoryCalls = 0;

  const reconcile = createPaidOrderNotificationRuntime({
    env,
    notificationStoreFactory(options) {
      storeFactoryCalls += 1;
      assert.equal(options.connectionString, env.NEON_DATABASE_URL);
      return store;
    },
    notifierFactory(options) {
      notifierFactoryCalls += 1;
      assert.deepEqual(options, {
        apiKey: env.RESEND_API_KEY,
        from: env.RESEND_FROM,
        replyTo: env.RESEND_REPLY_TO,
      });
      return {
        async sendPaidOrderEmail(message) {
          sent.push({ notificationType: message.notificationType, to: message.to });
          return { providerMessageId: `message-${message.notificationType}` };
        },
      };
    },
  });

  const result = await reconcile(livePaidOrder());
  assert.equal(result.skipped, false);
  assert.deepEqual(result.deliveries.map((delivery) => delivery.status), ['sent', 'sent']);
  assert.deepEqual(sent, [
    { notificationType: 'merchant_paid_order', to: 'merchant@example.test' },
    { notificationType: 'customer_paid_order', to: 'customer@example.test' },
  ]);
  assert.equal(storeFactoryCalls, 1);
  assert.equal(notifierFactoryCalls, 1);
});

test('repeated reconciliation uses durable notification claims to suppress duplicate delivery', async () => {
  const store = createMemoryNotificationStore();
  let sendCalls = 0;
  const reconcile = createPaidOrderNotificationRuntime({
    env: runtimeEnv(),
    notificationStoreFactory() { return store; },
    notifierFactory() {
      return {
        async sendPaidOrderEmail({ notificationType }) {
          sendCalls += 1;
          return { providerMessageId: `message-${notificationType}` };
        },
      };
    },
  });

  const first = await reconcile(livePaidOrder());
  const second = await reconcile(livePaidOrder());
  assert.equal(sendCalls, 2);
  assert.deepEqual(first.deliveries.map((delivery) => delivery.status), ['sent', 'sent']);
  assert.deepEqual(second.deliveries.map((delivery) => delivery.duplicate), [true, true]);
  assert.deepEqual(second.deliveries.map((delivery) => delivery.status), ['sent', 'sent']);
});

test('provider rejection remains a notification failure and never becomes a runtime throw', async () => {
  const store = createMemoryNotificationStore();
  const reconcile = createPaidOrderNotificationRuntime({
    env: runtimeEnv(),
    notificationStoreFactory() { return store; },
    notifierFactory() {
      return {
        async sendPaidOrderEmail() {
          const error = new Error('provider rejected test message');
          error.code = 'TEST_PROVIDER_REJECTED';
          throw error;
        },
      };
    },
  });

  const result = await reconcile(livePaidOrder());
  assert.equal(result.skipped, false);
  assert.deepEqual(result.deliveries.map((delivery) => delivery.status), ['failed', 'failed']);
  assert.deepEqual(result.deliveries.map((delivery) => delivery.errorCode), [
    'TEST_PROVIDER_REJECTED',
    'TEST_PROVIDER_REJECTED',
  ]);
});

test('notification runtime bootstrap failure is non-fatal and logs only safe metadata', async () => {
  const logged = [];
  let notifierFactoryCalls = 0;
  const env = runtimeEnv({ RESEND_API_KEY: 'fake-key-that-must-not-be-logged' });
  const reconcile = createPaidOrderNotificationRuntime({
    env,
    notificationStoreFactory() {
      const error = new Error('temporary notification store failure');
      error.code = 'TEST_NOTIFICATION_STORE_UNAVAILABLE';
      throw error;
    },
    notifierFactory() {
      notifierFactoryCalls += 1;
      throw new Error('notifier must not initialize after store bootstrap failure');
    },
    logger: {
      error(message, metadata) {
        logged.push({ message, metadata });
      },
    },
  });

  const result = await reconcile(livePaidOrder());
  assert.equal(result.failed, true);
  assert.equal(result.reason, 'runtime_error');
  assert.deepEqual(result.deliveries, []);
  assert.equal(notifierFactoryCalls, 0);
  assert.equal(logged.length, 1);
  assert.equal(logged[0].message, 'Paid-order notification reconciliation failed.');
  assert.deepEqual(Object.keys(logged[0].metadata).sort(), ['code', 'name', 'reference']);
  assert.equal(logged[0].metadata.code, 'TEST_NOTIFICATION_STORE_UNAVAILABLE');
  assert.equal(logged[0].metadata.reference, reference);
  const serializedLog = JSON.stringify(logged[0]);
  assert.equal(serializedLog.includes('customer@example.test'), false);
  assert.equal(serializedLog.includes('Example Street 12'), false);
  assert.equal(serializedLog.includes(env.RESEND_API_KEY), false);
});
