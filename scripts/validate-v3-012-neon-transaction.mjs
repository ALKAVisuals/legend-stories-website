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
const qSchema = quoteIdentifier(schema);
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

  const privileges = await client.query(`
    SELECT
      has_table_privilege($1, $2, 'SELECT') AS orders_select,
      has_table_privilege($1, $2, 'INSERT') AS orders_table_insert,
      has_table_privilege($1, $2, 'UPDATE') AS orders_table_update,
      has_column_privilege($1, $2, 'document_profile_version', 'INSERT') AS profile_insert,
      has_column_privilege($1, $2, 'document_profile_version', 'UPDATE') AS profile_update,
      has_column_privilege($1, $2, 'order_number', 'INSERT') AS order_number_insert,
      has_column_privilege($1, $2, 'order_number', 'UPDATE') AS order_number_update,
      has_column_privilege($1, $2, 'invoice_id', 'UPDATE') AS invoice_id_update,
      has_column_privilege($1, $2, 'customer', 'UPDATE') AS customer_update,
      has_table_privilege($1, $3, 'SELECT') AS invoices_select,
      has_table_privilege($1, $3, 'INSERT') AS invoices_insert,
      has_table_privilege($1, $3, 'UPDATE') AS invoices_update,
      has_table_privilege($1, $3, 'DELETE') AS invoices_delete,
      has_table_privilege($1, $4, 'SELECT') AS series_select,
      has_table_privilege($1, $4, 'INSERT') AS series_insert,
      has_table_privilege($1, $4, 'UPDATE') AS series_table_update,
      has_column_privilege($1, $4, 'next_value', 'UPDATE') AS series_next_update,
      has_column_privilege($1, $4, 'updated_at', 'UPDATE') AS series_time_update,
      has_column_privilege($1, $4, 'series_key', 'UPDATE') AS series_key_update,
      has_sequence_privilege($1, $5, 'USAGE') AS sequence_usage,
      has_sequence_privilege($1, $5, 'UPDATE') AS sequence_update
  `, [
    runtimeRole,
    `${schema}.orders`,
    `${schema}.invoices`,
    `${schema}.document_number_series`,
    `${schema}.invoices_id_seq`,
  ]);

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
    if (p[key] !== true) throw new Error(`Isolated Neon runtime grant missing: ${key}`);
  }
  for (const key of requiredFalse) {
    if (p[key] !== false) throw new Error(`Isolated Neon runtime grant is broader than intended: ${key}`);
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

  console.log('V3 012 isolated Neon grant validation passed and rolled back cleanly.');
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
