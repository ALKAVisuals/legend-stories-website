import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const ROOT = new URL('../', import.meta.url);
const [migration, grants, runner] = await Promise.all([
  readFile(new URL('server/db/migrations/003_add_paypal_reconciliation.sql', ROOT), 'utf8'),
  readFile(new URL('server/db/migrations/004_grant_paypal_reconciliation_runtime.sql', ROOT), 'utf8'),
  readFile(new URL('scripts/run-neon-test-migrations.mjs', ROOT), 'utf8'),
]);

test('PayPal reconciliation migration replaces the Stripe-only session constraint', () => {
  assert.match(migration, /DROP CONSTRAINT IF EXISTS orders_session_format/);
  assert.match(migration, /ADD COLUMN IF NOT EXISTS payment_provider text/);
  assert.match(migration, /GENERATED ALWAYS AS/);
  assert.match(migration, /THEN 'stripe'::text/);
  assert.match(migration, /THEN 'paypal'::text/);
  assert.match(migration, /CHECK \(payment_provider IS NOT NULL\)/);
  assert.match(migration, /CHECK \(payment_provider IN \('stripe', 'paypal'\)\)/);
  assert.match(migration, /payment_provider = 'paypal'/);
  assert.match(migration, /payment_provider = 'stripe'/);
});

test('PayPal webhook ledger stores only reconciliation identity and timing metadata', () => {
  assert.match(migration, /CREATE TABLE IF NOT EXISTS legend_commerce\.paypal_webhook_events/);
  for (const field of [
    'event_id text PRIMARY KEY',
    'event_type text NOT NULL',
    'order_reference text NOT NULL',
    'paypal_order_id text NOT NULL',
    'paypal_capture_id text',
    'mode text NOT NULL',
    'paypal_created_at bigint NOT NULL',
    'processed_at bigint NOT NULL',
  ]) {
    assert.ok(migration.includes(field), `Missing PayPal webhook ledger field: ${field}`);
  }
  assert.equal(/customer|email|street|shipping_address|payer_payload/i.test(
    migration.slice(migration.indexOf('CREATE TABLE IF NOT EXISTS legend_commerce.paypal_webhook_events')),
  ), false);
});

test('PayPal webhook ledger runtime role stays least privilege', () => {
  assert.match(grants, /GRANT SELECT, INSERT/);
  assert.match(grants, /ON TABLE legend_commerce\.paypal_webhook_events/);
  assert.doesNotMatch(grants, /\b(?:UPDATE|DELETE|TRUNCATE|CREATE|DROP|ALTER)\b/);
});

test('Neon migration runner applies PayPal schema before PayPal runtime grants', () => {
  const schemaIndex = runner.indexOf('003_add_paypal_reconciliation.sql');
  const grantIndex = runner.indexOf('004_grant_paypal_reconciliation_runtime.sql');
  assert.ok(schemaIndex > -1);
  assert.ok(grantIndex > schemaIndex);
});
