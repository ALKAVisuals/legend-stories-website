import { readFile } from 'node:fs/promises';

import {
  createDefaultNeonClient,
  validateNeonConnectionString,
} from '../server/adapters/neon-order-store.mjs';

function requireEnvironmentUrl(name) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required for isolated V3 Neon grant validation.`);
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

function stripTransaction(sql) {
  return sql
    .replace(/^\s*BEGIN;\s*/i, '')
    .replace(/\s*COMMIT;\s*$/i, '');
}

async function migrationText(path, { schema, runtimeRole } = {}) {
  let sql = await readFile(new URL(path, import.meta.url), 'utf8');
  sql = stripTransaction(sql);
  if (schema) sql = sql.replaceAll('legend_commerce', schema);
  if (runtimeRole) sql = sql.replaceAll('__LEGEND_RUNTIME_ROLE__', quoteIdentifier(runtimeRole));
  if (sql.includes('__LEGEND_RUNTIME_ROLE__')) {
    throw new Error(`${path} contains an unresolved runtime role placeholder.`);
  }
  return sql;
}

const migrationUrl = requireEnvironmentUrl('NEON_TEST_MIGRATION_URL');
const runtimeUrl = requireEnvironmentUrl('NEON_TEST_DATABASE_URL');
const migrationConfig = new URL(migrationUrl);
const runtimeConfig = new URL(runtimeUrl);

if (migrationConfig.hostname.includes('-pooler.')) {
  throw new Error('NEON_TEST_MIGRATION_URL must use a direct, non-pooled Neon endpoint.');
}
if (migrationConfig.hostname.replace('-pooler.', '.') !== runtimeConfig.hostname.replace('-pooler.', '.')) {
  throw new Error('Migration and runtime URLs must target the same isolated Neon branch.');
}
if (migrationConfig.pathname !== runtimeConfig.pathname) {
  throw new Error('Migration and runtime URLs must target the same isolated Neon database.');
}

const runtimeRole = normalizeRoleName(runtimeConfig.username);
const schema = `legend_commerce_v3_012_${Date.now().toString(36)}`;
const client = await createDefaultNeonClient(migrationUrl);
let transactionOpen = false;

try {
  await client.connect();

  const version = await client.query('SHOW server_version_num');
  if (Number(version.rows?.[0]?.server_version_num || 0) < 180000) {
    throw new Error('V3 grant validation requires PostgreSQL 18 or newer.');
  }

  await client.query('BEGIN');
  transactionOpen = true;

  for (const path of [
    '../server/db/migrations/001_create_order_store.sql',
    '../server/db/migrations/003_add_paypal_reconciliation.sql',
    '../server/db/migrations/011_add_v3_order_invoice_architecture.sql',
  ]) {
    await client.query(await migrationText(path, { schema }));
  }

  for (const path of [
    '../server/db/migrations/002_grant_order_store_runtime.sql',
    '../server/db/migrations/004_grant_paypal_reconciliation_runtime.sql',
    '../server/db/migrations/012_grant_v3_order_invoice_runtime.sql',
  ]) {
    await client.query(await migrationText(path, { schema, runtimeRole }));
  }

  const sequenceResult = await client.query(
    `SELECT pg_get_serial_sequence($1, 'id') AS sequence_name`,
    [`${schema}.invoices`],
  );
  const expectedSequence = `${schema}.invoices_id_seq`;
  if (sequenceResult.rows?.[0]?.sequence_name !== expectedSequence) {
    throw new Error(`Unexpected isolated Neon invoice identity sequence: ${sequenceResult.rows?.[0]?.sequence_name}`);
  }

  // The Neon integration runtime role is Neon-managed and can have broader
  // effective privileges through ownership/inheritance. Validate the direct
  // ACL entries written by migrations 002/004/012 instead of treating those
  // platform-level effective privileges as grants made by 012 itself.
  const privileges = await client.query(`
    WITH runtime_role AS (
      SELECT oid
      FROM pg_roles
      WHERE rolname = $1
    ),
    table_acl AS (
      SELECT c.relname, acl.privilege_type
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      CROSS JOIN LATERAL aclexplode(c.relacl) acl
      JOIN runtime_role rr ON rr.oid = acl.grantee
      WHERE n.nspname = $2
    ),
    column_acl AS (
      SELECT c.relname, a.attname, acl.privilege_type
      FROM pg_attribute a
      JOIN pg_class c ON c.oid = a.attrelid
      JOIN pg_namespace n ON n.oid = c.relnamespace
      CROSS JOIN LATERAL aclexplode(a.attacl) acl
      JOIN runtime_role rr ON rr.oid = acl.grantee
      WHERE n.nspname = $2
        AND a.attnum > 0
        AND NOT a.attisdropped
    )
    SELECT
      EXISTS (SELECT 1 FROM table_acl WHERE relname = 'orders' AND privilege_type = 'SELECT') AS orders_select,
      EXISTS (SELECT 1 FROM table_acl WHERE relname = 'orders' AND privilege_type = 'INSERT') AS orders_table_insert,
      EXISTS (SELECT 1 FROM table_acl WHERE relname = 'orders' AND privilege_type = 'UPDATE') AS orders_table_update,
      EXISTS (SELECT 1 FROM column_acl WHERE relname = 'orders' AND attname = 'document_profile_version' AND privilege_type = 'INSERT') AS profile_insert,
      EXISTS (SELECT 1 FROM column_acl WHERE relname = 'orders' AND attname = 'document_profile_version' AND privilege_type = 'UPDATE') AS profile_update,
      EXISTS (SELECT 1 FROM column_acl WHERE relname = 'orders' AND attname = 'order_number' AND privilege_type = 'INSERT') AS order_number_insert,
      EXISTS (SELECT 1 FROM column_acl WHERE relname = 'orders' AND attname = 'order_number' AND privilege_type = 'UPDATE') AS order_number_update,
      EXISTS (SELECT 1 FROM column_acl WHERE relname = 'orders' AND attname = 'invoice_id' AND privilege_type = 'UPDATE') AS invoice_id_update,
      EXISTS (SELECT 1 FROM column_acl WHERE relname = 'orders' AND attname = 'customer' AND privilege_type = 'UPDATE') AS customer_update,
      EXISTS (SELECT 1 FROM table_acl WHERE relname = 'invoices' AND privilege_type = 'SELECT') AS invoices_select,
      EXISTS (SELECT 1 FROM table_acl WHERE relname = 'invoices' AND privilege_type = 'INSERT') AS invoices_insert,
      EXISTS (SELECT 1 FROM table_acl WHERE relname = 'invoices' AND privilege_type = 'UPDATE') AS invoices_update,
      EXISTS (SELECT 1 FROM table_acl WHERE relname = 'invoices' AND privilege_type = 'DELETE') AS invoices_delete,
      EXISTS (SELECT 1 FROM table_acl WHERE relname = 'document_number_series' AND privilege_type = 'SELECT') AS series_select,
      EXISTS (SELECT 1 FROM table_acl WHERE relname = 'document_number_series' AND privilege_type = 'INSERT') AS series_insert,
      EXISTS (SELECT 1 FROM table_acl WHERE relname = 'document_number_series' AND privilege_type = 'UPDATE') AS series_table_update,
      EXISTS (SELECT 1 FROM column_acl WHERE relname = 'document_number_series' AND attname = 'next_value' AND privilege_type = 'UPDATE') AS series_next_update,
      EXISTS (SELECT 1 FROM column_acl WHERE relname = 'document_number_series' AND attname = 'updated_at' AND privilege_type = 'UPDATE') AS series_time_update,
      EXISTS (SELECT 1 FROM column_acl WHERE relname = 'document_number_series' AND attname = 'series_key' AND privilege_type = 'UPDATE') AS series_key_update,
      EXISTS (SELECT 1 FROM table_acl WHERE relname = 'invoices_id_seq' AND privilege_type = 'USAGE') AS sequence_usage,
      EXISTS (SELECT 1 FROM table_acl WHERE relname = 'invoices_id_seq' AND privilege_type = 'UPDATE') AS sequence_update
  `, [runtimeRole, schema]);

  const p = privileges.rows?.[0] || {};
  const requiredTrue = [
    'orders_select',
    'profile_insert',
    'order_number_update',
    'invoice_id_update',
    'invoices_select',
    'invoices_insert',
    'series_select',
    'series_insert',
    'series_next_update',
    'series_time_update',
    'sequence_usage',
  ];
  const requiredFalse = [
    'orders_table_insert',
    'orders_table_update',
    'profile_update',
    'order_number_insert',
    'customer_update',
    'invoices_update',
    'invoices_delete',
    'series_table_update',
    'series_key_update',
    'sequence_update',
  ];

  for (const key of requiredTrue) {
    if (p[key] !== true) throw new Error(`Isolated Neon direct runtime ACL missing: ${key}`);
  }
  for (const key of requiredFalse) {
    if (p[key] !== false) throw new Error(`Isolated Neon direct runtime ACL is broader than intended: ${key}`);
  }

  const effectivePrivilegeWarning = await client.query(`
    SELECT
      has_table_privilege($1, $2, 'INSERT') AS broad_insert,
      has_table_privilege($1, $2, 'UPDATE') AS broad_update
  `, [runtimeRole, `${schema}.orders`]);
  if (effectivePrivilegeWarning.rows?.[0]?.broad_insert
      || effectivePrivilegeWarning.rows?.[0]?.broad_update) {
    console.warn('::warning::The isolated Neon runtime role has broader platform-level effective privileges than the direct ACL contract. A dedicated least-privilege production runtime role remains required before V3 activation.');
  }

  const schemaVisibleInsideTransaction = await client.query(
    'SELECT to_regnamespace($1) IS NOT NULL AS exists',
    [schema],
  );
  if (schemaVisibleInsideTransaction.rows?.[0]?.exists !== true) {
    throw new Error('Transaction-local V3 grant validation schema was not created.');
  }

  await client.query('ROLLBACK');
  transactionOpen = false;

  const rollbackProof = await client.query(
    'SELECT to_regnamespace($1) IS NULL AS removed',
    [schema],
  );
  if (rollbackProof.rows?.[0]?.removed !== true) {
    throw new Error('Isolated Neon V3 grant validation schema did not roll back cleanly.');
  }

  console.log('V3 012 isolated Neon direct-ACL validation passed and rolled back cleanly.');
} catch (error) {
  if (transactionOpen) {
    try {
      await client.query('ROLLBACK');
    } catch {
      // Preserve the original validation error.
    }
  }
  throw error;
} finally {
  await client.end();
}
