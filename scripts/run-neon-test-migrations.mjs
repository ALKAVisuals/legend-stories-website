import { readFile } from 'node:fs/promises';

import {
  createDefaultNeonClient,
  validateNeonConnectionString,
} from '../server/adapters/neon-order-store.mjs';

function requireEnvironmentUrl(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is required for the Neon integration workflow.`);
  }
  return validateNeonConnectionString(value);
}

function normalizeRoleName(value) {
  const role = decodeURIComponent(String(value || '')).trim();
  if (!/^[A-Za-z_][A-Za-z0-9_-]{0,62}$/.test(role)) {
    throw new Error('The Neon runtime database role has an unsupported name.');
  }
  return role;
}

function quoteIdentifier(identifier) {
  return `"${identifier.replaceAll('"', '""')}"`;
}

const migrationUrl = requireEnvironmentUrl('NEON_TEST_MIGRATION_URL');
const runtimeUrl = requireEnvironmentUrl('NEON_TEST_DATABASE_URL');
const migrationConfig = new URL(migrationUrl);
const runtimeConfig = new URL(runtimeUrl);

if (migrationConfig.hostname.includes('-pooler.')) {
  throw new Error('NEON_TEST_MIGRATION_URL must use a direct, non-pooled Neon endpoint.');
}
if (migrationConfig.username === runtimeConfig.username) {
  throw new Error('Migration and runtime URLs must use separate Neon database roles.');
}
if (migrationConfig.hostname.replace('-pooler.', '.')
  !== runtimeConfig.hostname.replace('-pooler.', '.')) {
  throw new Error('Migration and runtime URLs must target the same Neon endpoint branch.');
}
if (migrationConfig.pathname !== runtimeConfig.pathname) {
  throw new Error('Migration and runtime URLs must target the same Neon database.');
}

const runtimeRole = normalizeRoleName(runtimeConfig.username);
const migrations = [
  new URL('../server/db/migrations/001_create_order_store.sql', import.meta.url),
  new URL('../server/db/migrations/002_grant_order_store_runtime.sql', import.meta.url),
  new URL('../server/db/migrations/003_add_paypal_reconciliation.sql', import.meta.url),
  new URL('../server/db/migrations/004_grant_paypal_reconciliation_runtime.sql', import.meta.url),
  new URL('../server/db/migrations/005_create_withdrawal_requests.sql', import.meta.url),
  new URL('../server/db/migrations/006_grant_withdrawal_runtime.sql', import.meta.url),
  new URL('../server/db/migrations/007_create_withdrawal_acknowledgements.sql', import.meta.url),
  new URL('../server/db/migrations/008_grant_withdrawal_acknowledgement_runtime.sql', import.meta.url),
  new URL('../server/db/migrations/009_create_order_notifications.sql', import.meta.url),
  new URL('../server/db/migrations/010_grant_order_notifications_runtime.sql', import.meta.url),
  new URL('../server/db/migrations/011_add_v3_order_invoice_architecture.sql', import.meta.url),
  new URL('../server/db/migrations/012_grant_v3_order_invoice_runtime.sql', import.meta.url),
  new URL('../server/db/migrations/013_extend_order_notifications_for_v3_invoice_delivery.sql', import.meta.url),
  new URL('../server/db/migrations/014_harden_v3_invoice_artifact_identity.sql', import.meta.url),
  new URL('../server/db/migrations/015_add_v3_invoice_pdf_storage_binding.sql', import.meta.url),
];

const client = await createDefaultNeonClient(migrationUrl);
try {
  await client.connect();
  for (const migrationUrlObject of migrations) {
    let migration = await readFile(migrationUrlObject, 'utf8');
    migration = migration.replaceAll(
      '__LEGEND_RUNTIME_ROLE__',
      quoteIdentifier(runtimeRole),
    );
    if (migration.includes('__LEGEND_RUNTIME_ROLE__')) {
      throw new Error(`Migration ${migrationUrlObject.pathname} contains an unresolved role placeholder.`);
    }
    await client.query(migration);
  }
  console.log('Applied Neon test migrations and least-privilege runtime grants.');
} finally {
  await client.end();
}
