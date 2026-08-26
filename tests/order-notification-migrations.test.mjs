import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const CREATE_MIGRATION = new URL('../server/db/migrations/009_create_order_notifications.sql', import.meta.url);
const GRANT_MIGRATION = new URL('../server/db/migrations/010_grant_order_notifications_runtime.sql', import.meta.url);

test('order notification migration provides durable per-order idempotency', async () => {
  const sql = await readFile(CREATE_MIGRATION, 'utf8');

  assert.match(sql, /CREATE TABLE IF NOT EXISTS legend_commerce\.order_notifications/);
  assert.match(sql, /PRIMARY KEY \(order_reference, notification_type\)/);
  assert.match(sql, /REFERENCES legend_commerce\.orders\(reference\) ON DELETE RESTRICT/);
  assert.match(sql, /merchant_paid_order/);
  assert.match(sql, /customer_paid_order/);
  assert.match(sql, /delivery_status IN \('pending', 'sent', 'failed'\)/);
  assert.match(sql, /provider_message_id text/);
  assert.match(sql, /last_error_code text/);
  assert.doesNotMatch(sql, /customer jsonb/i);
  assert.doesNotMatch(sql, /items jsonb/i);
});

test('runtime role receives only the order-notification table permissions it needs', async () => {
  const sql = await readFile(GRANT_MIGRATION, 'utf8');

  assert.match(sql, /GRANT SELECT, INSERT, UPDATE/);
  assert.match(sql, /ON TABLE legend_commerce\.order_notifications/);
  assert.match(sql, /TO __LEGEND_RUNTIME_ROLE__/);
  assert.doesNotMatch(sql, /DELETE/i);
  assert.doesNotMatch(sql, /TRUNCATE/i);
});
