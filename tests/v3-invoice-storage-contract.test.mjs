import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const ROOT = new URL('../', import.meta.url);

const [migration, migration018, migrationRunner, netlifyConfig, packageSource] = await Promise.all([
  readFile(new URL('server/db/migrations/015_add_v3_invoice_pdf_storage_binding.sql', ROOT), 'utf8'),
  readFile(new URL('server/db/migrations/018_allow_cloudflare_r2_v3_invoice_pdf_storage.sql', ROOT), 'utf8'),
  readFile(new URL('scripts/run-neon-test-migrations.mjs', ROOT), 'utf8'),
  readFile(new URL('netlify.toml', ROOT), 'utf8'),
  readFile(new URL('package.json', ROOT), 'utf8'),
]);

const pkg = JSON.parse(packageSource);

test('migration 015 makes the private PDF binding all-or-nothing and deterministic', () => {
  for (const marker of [
    'ADD COLUMN IF NOT EXISTS pdf_storage_backend text',
    'ADD COLUMN IF NOT EXISTS pdf_storage_key text',
    'ADD COLUMN IF NOT EXISTS pdf_stored_at bigint',
    'order_notifications_v3_pdf_storage_binding_complete',
    "notification_type = 'customer_v3_invoice'",
    "pdf_storage_backend = 'netlify_blobs'",
    "'v1/invoices/' || invoice_id::text || '/' || pdf_sha256 || '.pdf'",
    'pdf_stored_at >= 0',
  ]) {
    assert.ok(migration.includes(marker), `missing migration marker: ${marker}`);
  }

  assert.ok(migration.includes(
    'pdf_storage_backend IS NULL\n          AND pdf_storage_key IS NULL\n          AND pdf_stored_at IS NULL',
  ));
  assert.equal(/\b(DELETE|TRUNCATE)\b/.test(migration), false);
});

test('migration 018 preserves Netlify bindings and allows Cloudflare R2 bindings', () => {
  for (const marker of [
    'DROP CONSTRAINT IF EXISTS order_notifications_v3_pdf_storage_binding_complete',
    "pdf_storage_backend IN ('netlify_blobs', 'cloudflare_r2')",
    "'v1/invoices/' || invoice_id::text || '/' || pdf_sha256 || '.pdf'",
    'pdf_stored_at >= 0',
  ]) {
    assert.ok(migration018.includes(marker), `missing migration 018 marker: ${marker}`);
  }

  assert.equal(/\b(DELETE|TRUNCATE)\b/.test(migration018), false);
});

test('real-Neon test migration runner applies storage binding only after artifact hardening', () => {
  const artifactHardening = migrationRunner.indexOf('014_harden_v3_invoice_artifact_identity.sql');
  const storageBinding = migrationRunner.indexOf('015_add_v3_invoice_pdf_storage_binding.sql');
  assert.ok(artifactHardening >= 0);
  assert.ok(storageBinding > artifactHardening);
});

test('real-Neon test migration runner applies Cloudflare R2 widening after migration 017', () => {
  const accessAuditGrant = migrationRunner.indexOf('017_grant_v3_invoice_access_audit_runtime.sql');
  const cloudflareR2Binding = migrationRunner.indexOf('018_allow_cloudflare_r2_v3_invoice_pdf_storage.sql');
  assert.ok(accessAuditGrant >= 0);
  assert.ok(cloudflareR2Binding > accessAuditGrant);
});

test('Netlify bundles Blobs and exposes only the server function download route', () => {
  assert.ok(netlifyConfig.includes('external_node_modules = ["pdfkit", "@netlify/blobs"]'));
  assert.ok(netlifyConfig.includes('from = "/api/invoice-download"'));
  assert.ok(netlifyConfig.includes('to = "/.netlify/functions/invoice-download"'));
  assert.equal(netlifyConfig.includes('v1/invoices/:invoice'), false);
});

test('Netlify Blobs dependency is exactly pinned for the existing CI/runtime baseline', () => {
  assert.equal(pkg.dependencies?.['@netlify/blobs'], '10.7.13');
});
