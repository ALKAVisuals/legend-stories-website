import { readFile } from 'node:fs/promises';

import {
  createDefaultNeonClient,
  validateNeonConnectionString,
} from '../server/adapters/neon-order-store.mjs';

const VALIDATION_SCHEMA = 'legend_v3_011_validation';

function requireMigrationUrl() {
  const value = process.env.NEON_TEST_MIGRATION_URL;
  if (!value) {
    throw new Error('NEON_TEST_MIGRATION_URL is required for isolated V3 Neon validation.');
  }
  return validateNeonConnectionString(value);
}

async function migrationSql(relativePath) {
  const fileUrl = new URL(relativePath, import.meta.url);
  let sql = await readFile(fileUrl, 'utf8');
  sql = sql
    .replace(/^\s*BEGIN;\s*/i, '')
    .replace(/\s*COMMIT;\s*$/i, '')
    .replaceAll('legend_commerce', VALIDATION_SCHEMA);
  return sql;
}

async function expectCheckViolation(client, sql, params, label) {
  const savepoint = `v3_${label.replace(/[^a-z0-9_]/gi, '_').toLowerCase()}`;
  await client.query(`SAVEPOINT ${savepoint}`);
  try {
    await client.query(sql, params);
  } catch (error) {
    await client.query(`ROLLBACK TO SAVEPOINT ${savepoint}`);
    await client.query(`RELEASE SAVEPOINT ${savepoint}`);
    if (error?.code !== '23514') throw error;
    return;
  }
  await client.query(`ROLLBACK TO SAVEPOINT ${savepoint}`);
  await client.query(`RELEASE SAVEPOINT ${savepoint}`);
  throw new Error(`${label} unexpectedly passed its V3 check constraint.`);
}

const migrationUrl = requireMigrationUrl();
const refs = Object.freeze({
  legacyPending: '01'.repeat(32),
  legacyPaid: '02'.repeat(32),
  v3Pending: '03'.repeat(32),
  v3Valid: '04'.repeat(32),
});

const client = await createDefaultNeonClient(migrationUrl);
let transactionOpen = false;
try {
  await client.connect();

  const collision = await client.query(
    'SELECT to_regnamespace($1) IS NOT NULL AS validation_schema_exists',
    [VALIDATION_SCHEMA],
  );
  if (collision.rows?.[0]?.validation_schema_exists) {
    throw new Error(`Refusing to overwrite existing Neon schema ${VALIDATION_SCHEMA}.`);
  }

  await client.query('BEGIN');
  transactionOpen = true;

  // Rebuild the authoritative pre-V3 order + PayPal baseline in a dedicated
  // transaction-local schema. This deliberately ignores any unrelated V3
  // state that may already exist in the shared integration database.
  await client.query(await migrationSql('../server/db/migrations/001_create_order_store.sql'));
  await client.query(await migrationSql('../server/db/migrations/003_add_paypal_reconciliation.sql'));

  // Seed rows before 011 to prove migration compatibility with existing
  // pending and paid records.
  await client.query(`
    INSERT INTO ${VALIDATION_SCHEMA}.orders (
      reference, status, amount_total, currency, mode, payment_session_id,
      created_at, updated_at, paid_at, customer, items, discount, shipping, totals
    ) VALUES
      ($1, 'payment_pending', 1995, 'EUR', 'test', 'V3NEONLEGACY001',
       1000, 1000, NULL, '{}'::jsonb, '[{"sku":"LEGACY-PENDING"}]'::jsonb,
       '{}'::jsonb, '{}'::jsonb, '{}'::jsonb),
      ($2, 'paid', 2995, 'EUR', 'test', 'V3NEONLEGACY002',
       1000, 1100, 1100, '{}'::jsonb, '[{"sku":"LEGACY-PAID"}]'::jsonb,
       '{}'::jsonb, '{}'::jsonb, '{}'::jsonb)
  `, [refs.legacyPending, refs.legacyPaid]);

  await client.query(await migrationSql('../server/db/migrations/011_add_v3_order_invoice_architecture.sql'));

  const legacy = await client.query(`
    SELECT count(*)::int AS count
    FROM ${VALIDATION_SCHEMA}.orders
    WHERE reference = ANY($1::text[])
      AND document_profile_version = 0
      AND order_number IS NULL
      AND order_number_assigned_at IS NULL
      AND invoice_id IS NULL
  `, [[refs.legacyPending, refs.legacyPaid]]);
  if (legacy.rows?.[0]?.count !== 2) {
    throw new Error('011 did not preserve pre-existing synthetic rows as legacy profile 0.');
  }

  // A pre-V3 pending checkout must remain able to become paid without V3
  // document identity after the additive migration.
  await client.query(`
    UPDATE ${VALIDATION_SCHEMA}.orders
    SET status = 'paid', paid_at = 1200, updated_at = 1200
    WHERE reference = $1
  `, [refs.legacyPending]);

  const legacyPaid = await client.query(`
    SELECT status, document_profile_version, order_number, invoice_id
    FROM ${VALIDATION_SCHEMA}.orders
    WHERE reference = $1
  `, [refs.legacyPending]);
  const legacyPaidRow = legacyPaid.rows?.[0];
  if (!legacyPaidRow
    || legacyPaidRow.status !== 'paid'
    || Number(legacyPaidRow.document_profile_version) !== 0
    || legacyPaidRow.order_number !== null
    || legacyPaidRow.invoice_id !== null) {
    throw new Error('Legacy profile-0 pending -> paid compatibility failed after 011.');
  }

  await client.query(`
    INSERT INTO ${VALIDATION_SCHEMA}.orders (
      reference, status, amount_total, currency, mode, payment_session_id,
      created_at, updated_at, customer, items, discount, shipping, totals,
      document_profile_version
    ) VALUES (
      $1, 'payment_pending', 3995, 'EUR', 'test', 'V3NEONPENDING001',
      2000, 2000, '{}'::jsonb, '[{"sku":"V3-PENDING"}]'::jsonb,
      '{}'::jsonb, '{}'::jsonb, '{}'::jsonb, 1
    )
  `, [refs.v3Pending]);

  await expectCheckViolation(client, `
    UPDATE ${VALIDATION_SCHEMA}.orders
    SET status = 'paid', paid_at = 2100, updated_at = 2100
    WHERE reference = $1
  `, [refs.v3Pending], 'incomplete_paid_identity');

  await expectCheckViolation(client, `
    UPDATE ${VALIDATION_SCHEMA}.orders
    SET order_number = 'EARLY-ORDER', order_number_assigned_at = 2050
    WHERE reference = $1
  `, [refs.v3Pending], 'prepayment_identity');

  // Same series key must be usable independently for order and invoice.
  await client.query(`
    INSERT INTO ${VALIDATION_SCHEMA}.document_number_series
      (document_type, series_key, next_value, updated_at)
    VALUES
      ('order', 'validation', 1, 2000),
      ('invoice', 'validation', 1, 2000)
  `);

  const series = await client.query(`
    SELECT count(*)::int AS count
    FROM ${VALIDATION_SCHEMA}.document_number_series
    WHERE series_key = 'validation'
  `);
  if (series.rows?.[0]?.count !== 2) {
    throw new Error('Order and invoice number series are not independent.');
  }

  await client.query(`
    INSERT INTO ${VALIDATION_SCHEMA}.orders (
      reference, status, amount_total, currency, mode, payment_session_id,
      created_at, updated_at, customer, items, discount, shipping, totals,
      document_profile_version
    ) VALUES (
      $1, 'payment_pending', 4995, 'EUR', 'test', 'V3NEONVALID0001',
      3000, 3000, '{}'::jsonb, '[{"sku":"V3-VALID"}]'::jsonb,
      '{}'::jsonb, '{}'::jsonb, '{}'::jsonb, 1
    )
  `, [refs.v3Valid]);

  // Prove the intended deferred circular relationship: insert immutable
  // invoice first, then attach it while moving the same order to paid.
  const invoice = await client.query(`
    INSERT INTO ${VALIDATION_SCHEMA}.invoices (
      order_reference, order_number, invoice_number, status, issued_at,
      currency, amount_total, schema_version, snapshot, created_at
    ) VALUES (
      $1, 'TEST-ORDER-NEON-000001', 'TEST-INVOICE-NEON-000001', 'issued', 3100,
      'EUR', 4995, 1, '{"schemaVersion":1}'::jsonb, 3100
    )
    RETURNING id
  `, [refs.v3Valid]);
  const invoiceId = invoice.rows?.[0]?.id;
  if (!invoiceId) throw new Error('V3 validation invoice did not receive an identity.');

  await client.query(`
    UPDATE ${VALIDATION_SCHEMA}.orders
    SET status = 'paid',
        paid_at = 3100,
        updated_at = 3100,
        order_number = 'TEST-ORDER-NEON-000001',
        order_number_assigned_at = 3100,
        invoice_id = $2
    WHERE reference = $1
  `, [refs.v3Valid, invoiceId]);

  await client.query('SET CONSTRAINTS ALL IMMEDIATE');

  const dossier = await client.query(`
    SELECT o.status, o.document_profile_version, o.order_number,
           i.invoice_number, o.amount_total = i.amount_total AS totals_match
    FROM ${VALIDATION_SCHEMA}.orders o
    JOIN ${VALIDATION_SCHEMA}.invoices i ON i.id = o.invoice_id
    WHERE o.reference = $1
      AND o.order_number = i.order_number
  `, [refs.v3Valid]);
  const row = dossier.rows?.[0];
  if (!row
    || row.status !== 'paid'
    || Number(row.document_profile_version) !== 1
    || row.order_number !== 'TEST-ORDER-NEON-000001'
    || row.invoice_number !== 'TEST-INVOICE-NEON-000001'
    || row.totals_match !== true) {
    throw new Error('Valid V3 order/invoice dossier did not reconcile on isolated Neon.');
  }

  const deferred = await client.query(`
    SELECT count(*)::int AS count
    FROM pg_constraint c
    JOIN pg_namespace n ON n.oid = c.connamespace
    WHERE n.nspname = $1
      AND c.conname IN ('invoices_order_identity_fk', 'orders_invoice_same_order_fk')
      AND c.condeferrable
      AND c.condeferred
  `, [VALIDATION_SCHEMA]);
  if (deferred.rows?.[0]?.count !== 2) {
    throw new Error('V3 order/invoice relationship constraints are not deferrable and initially deferred.');
  }

  await client.query('ROLLBACK');
  transactionOpen = false;

  const rollbackProof = await client.query(
    'SELECT to_regnamespace($1) IS NOT NULL AS validation_schema_exists',
    [VALIDATION_SCHEMA],
  );
  if (rollbackProof.rows?.[0]?.validation_schema_exists) {
    throw new Error('Transactional Neon validation schema persisted after rollback.');
  }

  console.log('V3 011 isolated Neon validation passed in a transaction-local schema and rolled back cleanly.');
} catch (error) {
  if (transactionOpen) {
    try {
      await client.query('ROLLBACK');
    } catch {
      // Preserve the original validation failure.
    }
  }
  throw error;
} finally {
  await client.end();
}
