import { readFile } from 'node:fs/promises';

import {
  createDefaultNeonClient,
  validateNeonConnectionString,
} from '../server/adapters/neon-order-store.mjs';

function requireMigrationUrl() {
  const value = process.env.NEON_TEST_MIGRATION_URL;
  if (!value) {
    throw new Error('NEON_TEST_MIGRATION_URL is required for isolated V3 Neon validation.');
  }
  return validateNeonConnectionString(value);
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
const migrationFile = new URL(
  '../server/db/migrations/011_add_v3_order_invoice_architecture.sql',
  import.meta.url,
);
const refs = Object.freeze({
  legacyPending: '01'.repeat(32),
  legacyPaid: '02'.repeat(32),
  v3Pending: '03'.repeat(32),
  v3Valid: '04'.repeat(32),
});
const syntheticRefs = Object.values(refs);

const client = await createDefaultNeonClient(migrationUrl);
let transactionOpen = false;
try {
  await client.connect();

  const baseline = await client.query(`
    SELECT
      to_regclass('legend_commerce.orders') IS NOT NULL AS orders_exists,
      EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'legend_commerce'
          AND table_name = 'orders'
          AND column_name = 'payment_provider'
      ) AS paypal_schema_exists,
      EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'legend_commerce'
          AND table_name = 'orders'
          AND column_name = 'document_profile_version'
      ) AS v3_already_present
  `);
  const state = baseline.rows?.[0] || {};
  if (!state.orders_exists || !state.paypal_schema_exists) {
    throw new Error('Isolated Neon integration database is missing the expected pre-V3 order/PayPal schema.');
  }
  if (state.v3_already_present) {
    throw new Error('Isolated Neon integration database already contains V3 schema; transactional 011 validation requires a pre-V3 baseline.');
  }

  await client.query('BEGIN');
  transactionOpen = true;

  await client.query(`
    INSERT INTO legend_commerce.orders (
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

  let migration = await readFile(migrationFile, 'utf8');
  migration = migration
    .replace(/^\s*BEGIN;\s*/i, '')
    .replace(/\s*COMMIT;\s*$/i, '');
  await client.query(migration);

  const legacy = await client.query(`
    SELECT count(*)::int AS count
    FROM legend_commerce.orders
    WHERE reference = ANY($1::text[])
      AND document_profile_version = 0
      AND order_number IS NULL
      AND order_number_assigned_at IS NULL
      AND invoice_id IS NULL
  `, [[refs.legacyPending, refs.legacyPaid]]);
  if (legacy.rows?.[0]?.count !== 2) {
    throw new Error('011 did not preserve synthetic pre-V3 rows as legacy profile 0.');
  }

  await client.query(`
    UPDATE legend_commerce.orders
    SET status = 'paid', paid_at = 1200, updated_at = 1200
    WHERE reference = $1
  `, [refs.legacyPending]);

  await client.query(`
    INSERT INTO legend_commerce.orders (
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
    UPDATE legend_commerce.orders
    SET status = 'paid', paid_at = 2100, updated_at = 2100
    WHERE reference = $1
  `, [refs.v3Pending], 'incomplete_paid_identity');

  await expectCheckViolation(client, `
    UPDATE legend_commerce.orders
    SET order_number = 'EARLY-ORDER', order_number_assigned_at = 2050
    WHERE reference = $1
  `, [refs.v3Pending], 'prepayment_identity');

  await client.query(`
    INSERT INTO legend_commerce.document_number_series
      (document_type, series_key, next_value, updated_at)
    VALUES
      ('order', 'neon-validation', 1, 2000),
      ('invoice', 'neon-validation', 1, 2000)
  `);

  const series = await client.query(`
    SELECT count(*)::int AS count
    FROM legend_commerce.document_number_series
    WHERE series_key = 'neon-validation'
  `);
  if (series.rows?.[0]?.count !== 2) {
    throw new Error('Order and invoice number series are not independent.');
  }

  await client.query(`
    INSERT INTO legend_commerce.orders (
      reference, status, amount_total, currency, mode, payment_session_id,
      created_at, updated_at, customer, items, discount, shipping, totals,
      document_profile_version
    ) VALUES (
      $1, 'payment_pending', 4995, 'EUR', 'test', 'V3NEONVALID0001',
      3000, 3000, '{}'::jsonb, '[{"sku":"V3-VALID"}]'::jsonb,
      '{}'::jsonb, '{}'::jsonb, '{}'::jsonb, 1
    )
  `, [refs.v3Valid]);

  const invoice = await client.query(`
    INSERT INTO legend_commerce.invoices (
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
    UPDATE legend_commerce.orders
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
    FROM legend_commerce.orders o
    JOIN legend_commerce.invoices i ON i.id = o.invoice_id
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
    FROM pg_constraint
    WHERE conname IN ('invoices_order_identity_fk', 'orders_invoice_same_order_fk')
      AND condeferrable
      AND condeferred
  `);
  if (deferred.rows?.[0]?.count !== 2) {
    throw new Error('V3 order/invoice relationship constraints are not deferrable and initially deferred.');
  }

  await client.query('ROLLBACK');
  transactionOpen = false;

  const rollbackProof = await client.query(`
    SELECT
      EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'legend_commerce'
          AND table_name = 'orders'
          AND column_name = 'document_profile_version'
      ) AS v3_column_persisted,
      (SELECT count(*)::int FROM legend_commerce.orders WHERE reference = ANY($1::text[])) AS synthetic_rows
  `, [syntheticRefs]);
  const proof = rollbackProof.rows?.[0] || {};
  if (proof.v3_column_persisted || proof.synthetic_rows !== 0) {
    throw new Error('Transactional Neon validation did not roll back cleanly.');
  }

  console.log('V3 011 isolated Neon transactional validation passed and rolled back cleanly.');
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
