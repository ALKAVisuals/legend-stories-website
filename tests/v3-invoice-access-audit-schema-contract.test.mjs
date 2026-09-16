import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const ROOT = new URL('../', import.meta.url);
const [migration, grants, runner] = await Promise.all([
  readFile(new URL('server/db/migrations/016_create_v3_invoice_access_audit.sql', ROOT), 'utf8'),
  readFile(new URL('server/db/migrations/017_grant_v3_invoice_access_audit_runtime.sql', ROOT), 'utf8'),
  readFile(new URL('scripts/run-neon-test-migrations.mjs', ROOT), 'utf8'),
]);

test('invoice-access audit migration stores only the approved minimal durable fields', () => {
  assert.match(migration, /CREATE TABLE IF NOT EXISTS legend_commerce\.invoice_access_audit/);
  for (const field of [
    'event_id uuid PRIMARY KEY',
    'order_reference text NOT NULL',
    'invoice_id bigint',
    'channel text NOT NULL',
    'outcome text NOT NULL',
    'reason_code text NOT NULL',
    'occurred_at bigint NOT NULL',
    'retain_until bigint NOT NULL',
  ]) {
    assert.ok(migration.includes(field), `Expected audit field ${field}`);
  }
  for (const forbidden of [
    'email',
    'paypal',
    'session_id',
    'storage_key',
    'blob',
    'ip_address',
    'user_agent',
    'service_token',
    'pdf_bytes',
  ]) {
    const createTable = migration.slice(
      migration.indexOf('CREATE TABLE IF NOT EXISTS legend_commerce.invoice_access_audit'),
      migration.indexOf('CREATE INDEX IF NOT EXISTS invoice_access_audit_retention_idx'),
    );
    assert.equal(createTable.toLowerCase().includes(forbidden), false, `Forbidden audit column token: ${forbidden}`);
  }
});

test('invoice-access audit migration locks safe channel/outcome classes and the 90-day retention floor', () => {
  assert.match(migration, /channel IN \('customer', 'dashboard'\)/);
  assert.match(migration, /outcome IN \('success', 'denied', 'unavailable', 'error'\)/);
  assert.match(migration, /reason_code ~ '\^\[a-z\]\[a-z0-9_\]\{0,63\}\$'/);
  assert.match(migration, /retain_until >= occurred_at \+ 7776000/);
});

test('runtime receives INSERT-only audit permission and no read, update or destructive grant', () => {
  assert.match(grants, /GRANT INSERT[\s\S]*ON TABLE legend_commerce\.invoice_access_audit/);
  assert.doesNotMatch(grants, /GRANT\s+(SELECT|UPDATE|DELETE|TRUNCATE|REFERENCES|TRIGGER)/i);
});

test('Neon migration runner applies audit schema before its runtime grant', () => {
  const schemaIndex = runner.indexOf('016_create_v3_invoice_access_audit.sql');
  const grantIndex = runner.indexOf('017_grant_v3_invoice_access_audit_runtime.sql');
  assert.ok(schemaIndex >= 0 && grantIndex > schemaIndex);
});
