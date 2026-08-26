import assert from 'node:assert/strict';
import test from 'node:test';

import {
  NeonOrderNotificationStoreError,
  createNeonOrderNotificationStore,
} from '../server/adapters/neon-order-notification-store.mjs';

const DATABASE_URL = 'postgresql://runtime:secret@example.neon.tech/legend?sslmode=require';
const REFERENCE = 'a'.repeat(64);

function notificationRow(overrides = {}) {
  return {
    order_reference: REFERENCE,
    notification_type: 'merchant_paid_order',
    delivery_status: 'pending',
    delivery_attempts: 0,
    reserved_at: 100,
    last_attempt_at: null,
    sent_at: null,
    provider_message_id: null,
    last_error_code: null,
    created_at: 100,
    updated_at: 100,
    ...overrides,
  };
}

function scriptedClientFactory(script) {
  const calls = [];
  return {
    calls,
    factory: async () => ({
      async connect() {
        calls.push({ type: 'connect' });
      },
      async query(sql, params = []) {
        const statement = String(sql).replace(/\s+/g, ' ').trim();
        calls.push({ type: 'query', statement, params });
        const next = script.shift();
        assert.ok(next, `Unexpected query: ${statement}`);
        if (next.match) assert.match(statement, next.match);
        if (next.error) throw next.error;
        return { rows: next.rows || [] };
      },
      async end() {
        calls.push({ type: 'end' });
      },
    }),
  };
}

test('reserves merchant notification exactly once', async () => {
  const client = scriptedClientFactory([
    { match: /INSERT INTO legend_commerce\.order_notifications/, rows: [notificationRow()] },
  ]);
  const store = createNeonOrderNotificationStore({
    connectionString: DATABASE_URL,
    clientFactory: client.factory,
  });

  const result = await store.reserveOrderNotification({
    orderReference: REFERENCE,
    notificationType: 'merchant_paid_order',
    reservedAt: 100,
  });

  assert.equal(result.created, true);
  assert.equal(result.notification.orderReference, REFERENCE);
  assert.equal(result.notification.notificationType, 'merchant_paid_order');
  assert.equal(result.notification.deliveryStatus, 'pending');
  assert.deepEqual(
    client.calls.find((call) => call.type === 'query').params,
    [REFERENCE, 'merchant_paid_order', 100],
  );
});

test('duplicate reservation returns the existing durable row', async () => {
  const client = scriptedClientFactory([
    { match: /INSERT INTO legend_commerce\.order_notifications/, rows: [] },
    { match: /FROM legend_commerce\.order_notifications/, rows: [notificationRow()] },
  ]);
  const store = createNeonOrderNotificationStore({
    connectionString: DATABASE_URL,
    clientFactory: client.factory,
  });

  const result = await store.reserveOrderNotification({
    orderReference: REFERENCE,
    notificationType: 'merchant_paid_order',
    reservedAt: 200,
  });

  assert.equal(result.created, false);
  assert.equal(result.notification.reservedAt, 100);
  assert.equal(client.calls.filter((call) => call.type === 'query').length, 2);
});

test('records successful delivery and provider message id', async () => {
  const sentRow = notificationRow({
    delivery_status: 'sent',
    delivery_attempts: 1,
    last_attempt_at: 300,
    sent_at: 300,
    provider_message_id: 're_123',
    updated_at: 300,
  });
  const client = scriptedClientFactory([
    { match: /UPDATE legend_commerce\.order_notifications/, rows: [sentRow] },
  ]);
  const store = createNeonOrderNotificationStore({
    connectionString: DATABASE_URL,
    clientFactory: client.factory,
  });

  const result = await store.recordOrderNotificationDelivery({
    orderReference: REFERENCE,
    notificationType: 'merchant_paid_order',
    status: 'sent',
    attemptedAt: 300,
    providerMessageId: 're_123',
  });

  assert.equal(result.changed, true);
  assert.equal(result.notification.deliveryStatus, 'sent');
  assert.equal(result.notification.providerMessageId, 're_123');
  assert.equal(result.notification.sentAt, 300);
});

test('a notification already marked sent cannot be downgraded or counted twice', async () => {
  const sentRow = notificationRow({
    delivery_status: 'sent',
    delivery_attempts: 1,
    last_attempt_at: 300,
    sent_at: 300,
    provider_message_id: 're_123',
    updated_at: 300,
  });
  const client = scriptedClientFactory([
    { match: /UPDATE legend_commerce\.order_notifications/, rows: [] },
    { match: /FROM legend_commerce\.order_notifications/, rows: [sentRow] },
  ]);
  const store = createNeonOrderNotificationStore({
    connectionString: DATABASE_URL,
    clientFactory: client.factory,
  });

  const result = await store.recordOrderNotificationDelivery({
    orderReference: REFERENCE,
    notificationType: 'merchant_paid_order',
    status: 'failed',
    attemptedAt: 400,
    errorCode: 'RESEND_TIMEOUT',
  });

  assert.equal(result.changed, false);
  assert.equal(result.notification.deliveryStatus, 'sent');
  assert.equal(result.notification.deliveryAttempts, 1);
  assert.equal(result.notification.providerMessageId, 're_123');
});

test('failed delivery is recorded and remains retryable', async () => {
  const failedRow = notificationRow({
    delivery_status: 'failed',
    delivery_attempts: 1,
    last_attempt_at: 500,
    last_error_code: 'RESEND_TIMEOUT',
    updated_at: 500,
  });
  const client = scriptedClientFactory([
    { match: /UPDATE legend_commerce\.order_notifications/, rows: [failedRow] },
  ]);
  const store = createNeonOrderNotificationStore({
    connectionString: DATABASE_URL,
    clientFactory: client.factory,
  });

  const result = await store.recordOrderNotificationDelivery({
    orderReference: REFERENCE,
    notificationType: 'merchant_paid_order',
    status: 'failed',
    attemptedAt: 500,
    errorCode: 'RESEND_TIMEOUT',
  });

  assert.equal(result.changed, true);
  assert.equal(result.notification.deliveryStatus, 'failed');
  assert.equal(result.notification.lastErrorCode, 'RESEND_TIMEOUT');
  assert.equal(result.notification.sentAt, null);
});

test('only the two paid-order notification types are accepted', async () => {
  const store = createNeonOrderNotificationStore({
    connectionString: DATABASE_URL,
    clientFactory: async () => {
      throw new Error('client must not be created for invalid input');
    },
  });

  await assert.rejects(
    store.reserveOrderNotification({
      orderReference: REFERENCE,
      notificationType: 'untrusted_type',
      reservedAt: 100,
    }),
    (error) => error instanceof NeonOrderNotificationStoreError
      && error.code === 'INVALID_ORDER_NOTIFICATION',
  );
});

test('sent delivery requires a provider message id', async () => {
  const store = createNeonOrderNotificationStore({
    connectionString: DATABASE_URL,
    clientFactory: async () => {
      throw new Error('client must not be created for invalid input');
    },
  });

  await assert.rejects(
    store.recordOrderNotificationDelivery({
      orderReference: REFERENCE,
      notificationType: 'customer_paid_order',
      status: 'sent',
      attemptedAt: 100,
    }),
    (error) => error instanceof NeonOrderNotificationStoreError
      && error.code === 'INVALID_ORDER_NOTIFICATION',
  );
});
