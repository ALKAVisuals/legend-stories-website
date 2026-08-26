import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import {
  NeonOrderNotificationStoreError,
  createNeonOrderNotificationStore,
} from '../server/adapters/neon-order-notification-store.mjs';

const DATABASE_URL = 'postgresql://runtime:secret@ep-test.neon.tech/legend?sslmode=require';
const REFERENCE = 'a'.repeat(64);

function row(overrides = {}) {
  return {
    order_reference: REFERENCE,
    notification_type: 'merchant_paid_order',
    delivery_status: 'pending',
    delivery_attempts: 0,
    claimed_at: null,
    last_attempt_at: null,
    sent_at: null,
    provider_message_id: null,
    last_error_code: null,
    created_at: 100,
    updated_at: 100,
    ...overrides,
  };
}

function createClientFactory(queryHandler) {
  return async () => ({
    async connect() {},
    async query(statement, values) {
      return queryHandler(String(statement), values);
    },
    async end() {},
  });
}

test('notification types reject unsupported values before database access', async () => {
  let connected = false;
  const store = createNeonOrderNotificationStore({
    connectionString: DATABASE_URL,
    clientFactory: async () => {
      connected = true;
      throw new Error('should not connect');
    },
  });

  await assert.rejects(
    store.ensureNotification({
      orderReference: REFERENCE,
      notificationType: 'unknown_type',
      createdAt: 100,
    }),
    (error) => error instanceof NeonOrderNotificationStoreError
      && error.code === 'INVALID_ORDER_NOTIFICATION_TYPE',
  );
  assert.equal(connected, false);
});

test('ensureNotification creates one durable notification record', async () => {
  const store = createNeonOrderNotificationStore({
    connectionString: DATABASE_URL,
    clientFactory: createClientFactory((statement, values) => {
      assert.match(statement, /INSERT INTO legend_commerce\.order_notifications/);
      assert.deepEqual(values, [REFERENCE, 'merchant_paid_order', 100]);
      return { rows: [row()] };
    }),
  });

  const result = await store.ensureNotification({
    orderReference: REFERENCE,
    notificationType: 'merchant_paid_order',
    createdAt: 100,
  });

  assert.equal(result.created, true);
  assert.equal(result.notification.deliveryStatus, 'pending');
  assert.equal(result.notification.deliveryAttempts, 0);
});

test('claimNotification atomically moves only pending or failed delivery to sending', async () => {
  const store = createNeonOrderNotificationStore({
    connectionString: DATABASE_URL,
    clientFactory: createClientFactory((statement, values) => {
      assert.match(statement, /delivery_status IN \('pending', 'failed'\)/);
      assert.deepEqual(values, [REFERENCE, 'customer_paid_order', 200]);
      return {
        rows: [row({
          notification_type: 'customer_paid_order',
          delivery_status: 'sending',
          delivery_attempts: 1,
          claimed_at: 200,
          last_attempt_at: 200,
          updated_at: 200,
        })],
      };
    }),
  });

  const result = await store.claimNotification({
    orderReference: REFERENCE,
    notificationType: 'customer_paid_order',
    attemptedAt: 200,
  });

  assert.equal(result.claimed, true);
  assert.equal(result.notification.deliveryStatus, 'sending');
  assert.equal(result.notification.deliveryAttempts, 1);
});

test('recordDelivery persists provider identity only for sent delivery', async () => {
  const store = createNeonOrderNotificationStore({
    connectionString: DATABASE_URL,
    clientFactory: createClientFactory((statement, values) => {
      assert.match(statement, /delivery_status = 'sent'/);
      assert.deepEqual(values, [REFERENCE, 'merchant_paid_order', 300, 're_123']);
      return {
        rows: [row({
          delivery_status: 'sent',
          delivery_attempts: 1,
          claimed_at: 250,
          last_attempt_at: 250,
          sent_at: 300,
          provider_message_id: 're_123',
          updated_at: 300,
        })],
      };
    }),
  });

  const notification = await store.recordDelivery({
    orderReference: REFERENCE,
    notificationType: 'merchant_paid_order',
    status: 'sent',
    attemptedAt: 300,
    providerMessageId: 're_123',
  });

  assert.equal(notification.deliveryStatus, 'sent');
  assert.equal(notification.providerMessageId, 're_123');
  assert.equal(notification.sentAt, 300);
});

test('order notification migration enforces one row per order and notification type', async () => {
  const migration = await readFile(
    new URL('../server/db/migrations/009_create_order_notifications.sql', import.meta.url),
    'utf8',
  );
  const grant = await readFile(
    new URL('../server/db/migrations/010_grant_order_notifications_runtime.sql', import.meta.url),
    'utf8',
  );

  assert.match(migration, /PRIMARY KEY \(order_reference, notification_type\)/);
  assert.match(migration, /merchant_paid_order/);
  assert.match(migration, /customer_paid_order/);
  assert.match(migration, /'pending', 'sending', 'sent', 'failed'/);
  assert.match(grant, /GRANT SELECT, INSERT, UPDATE/);
  assert.match(grant, /legend_commerce\.order_notifications/);
});
