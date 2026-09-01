import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const ROOT = new URL('../', import.meta.url);
const [migration, grants, runner] = await Promise.all([
  readFile(new URL('server/db/migrations/011_add_v3_order_invoice_architecture.sql', ROOT), 'utf8'),
  readFile(new URL('server/db/migrations/012_grant_v3_order_invoice_runtime.sql', ROOT), 'utf8'),
  readFile(new URL('scripts/run-neon-test-migrations.mjs', ROOT), 'utf8'),
]);

test('V3 migration keeps existing orders legacy by default and adds official document identity fields', () => {
  assert.match(migration, /document_profile_version smallint NOT NULL DEFAULT 0/);
  assert.match(migration, /order_number text/);
  assert.match(migration, /order_number_assigned_at bigint/);
  assert.match(migration, /invoice_id bigint/);
  assert.match(migration, /CHECK \(document_profile_version IN \(0, 1\)\)/);
  assert.doesNotMatch(migration, /LM-ORD-|LM-INV-|series_year/);
});

test('V3 migration creates independent transactional document number series', () => {
  assert.match(migration, /CREATE TABLE IF NOT EXISTS legend_commerce\.document_number_series/);
  assert.match(migration, /PRIMARY KEY \(document_type, series_key\)/);
  assert.match(migration, /document_type IN \('order', 'invoice'\)/);
  assert.match(migration, /next_value >= 1/);
});

test('V3 invoices are one-per-order immutable source records with unique public identities', () => {
  assert.match(migration, /CREATE TABLE IF NOT EXISTS legend_commerce\.invoices/);
  assert.match(migration, /invoices_order_reference_unique UNIQUE \(order_reference\)/);
  assert.match(migration, /invoices_order_number_unique UNIQUE \(order_number\)/);
  assert.match(migration, /invoices_invoice_number_unique UNIQUE \(invoice_number\)/);
  assert.match(migration, /CHECK \(status = 'issued'\)/);
  assert.match(migration, /CHECK \(jsonb_typeof\(snapshot\) = 'object'\)/);
  assert.match(migration, /FOREIGN KEY \(order_reference\)/);
  assert.match(migration, /REFERENCES legend_commerce\.orders\(reference\)/);
});

test('V3 paid profile requires complete document identity and invoice-order identity is cross-checked', () => {
  const identityConstraint = migration.slice(migration.indexOf('orders_document_identity_consistent'));
  assert.match(identityConstraint, /document_profile_version = 0/);
  assert.match(identityConstraint, /status = 'paid'/);
  assert.match(identityConstraint, /order_number IS NOT NULL/);
  assert.match(identityConstraint, /order_number_assigned_at IS NOT NULL/);
  assert.match(identityConstraint, /invoice_id IS NOT NULL/);
  assert.match(migration, /FOREIGN KEY \(invoice_id, reference, order_number\)/);
  assert.match(migration, /REFERENCES legend_commerce\.invoices\(id, order_reference, order_number\)/);
});

test('V3 runtime grants keep invoice source write-once and restrict series mutation to counter metadata', () => {
  assert.match(grants, /GRANT SELECT, INSERT[\s\S]*ON TABLE legend_commerce\.invoices/);
  assert.doesNotMatch(grants, /GRANT\s+UPDATE[\s\S]*ON TABLE legend_commerce\.invoices/i);
  assert.doesNotMatch(grants, /GRANT\s+DELETE[\s\S]*legend_commerce\.invoices/i);

  const updateGrant = grants.match(/GRANT UPDATE \(([\s\S]*?)\)\s*ON TABLE legend_commerce\.document_number_series/);
  assert.ok(updateGrant);
  assert.match(updateGrant[1], /next_value/);
  assert.match(updateGrant[1], /updated_at/);
  assert.doesNotMatch(updateGrant[1], /document_type|series_key/);
  assert.match(grants, /GRANT USAGE[\s\S]*ON SEQUENCE legend_commerce\.invoices_id_seq/);
});

test('Neon test migration runner applies the complete schema and grant sequence through V3', () => {
  const expected = [
    '001_create_order_store.sql',
    '002_grant_order_store_runtime.sql',
    '003_add_paypal_reconciliation.sql',
    '004_grant_paypal_reconciliation_runtime.sql',
    '005_create_withdrawal_requests.sql',
    '006_grant_withdrawal_runtime.sql',
    '007_create_withdrawal_acknowledgements.sql',
    '008_grant_withdrawal_acknowledgement_runtime.sql',
    '009_create_order_notifications.sql',
    '010_grant_order_notifications_runtime.sql',
    '011_add_v3_order_invoice_architecture.sql',
    '012_grant_v3_order_invoice_runtime.sql',
  ];

  let previous = -1;
  for (const filename of expected) {
    const index = runner.indexOf(filename);
    assert.ok(index > previous, `Expected ${filename} after the previous migration`);
    previous = index;
  }
});
