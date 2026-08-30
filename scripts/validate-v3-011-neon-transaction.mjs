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
const seriesKey = 'v3-011-neon-transaction-validation';

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
      ) AS v3_already_present,
      to_regclass('legend_commerce.document_number_series') IS NOT NULL AS series_table_exists,
      to_regclass('legend_commerce.invoices') IS NOT NULL AS invoices_table_exists
  `);
  const state = baseline.rows?.[0] || {};
  if (!state.orders_exists || !state.paypal_schema_exists) {
    throw new Error('Isolated Neon integration database is missing the expected order/PayPal baseline schema.');
  }
  if (state.v3_already_present && (!state.series_table_exists || !state.invoices_table_exists)) {
    throw new Error('Isolated Neon contains a partial V3 schema rather than the expected 011 architecture.');
  }

  const collision = await client.query(`
    SELECT
      (SELECT count(*)::int FROM legend_commerce.orders WHERE reference = ANY($1::text[])) AS synthetic_orders,
      CASE WHEN to_regclass('legend_commerce.document_number_series') IS NULL THEN 0 ELSE
        (SELECT count(*)::int FROM legend_commerce.document_number_series WHERE series_key = $2)
      END AS synthetic_series
  `, [syntheticRefs, seriesKey]);
  const collisionState = collision.rows?.[0] || {};
  if (collisionState.synthetic_orders !== 0 || collisionState.synthetic_series !== 0) {
    throw new Error('Isolated Neon already contains synthetic V3 validation fixtures; refusing to overwrite them.');
  }

  await client.query('BEGIN');
  transactionOpen = true;

  if (!state.v3_already_present) {
    // Seed rows before 011 so this path proves migration compatibility with
    // already-existing pending and paid orders.
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
  } else {
    // The shared isolated integration database may already have 011 from an
    // earlier non-production exercise. In that case, validate its current
    // V3 semantics without reapplying named constraints.
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
  }

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
    throw new Error('V3 schema did not preserve/default synthetic legacy rows to profile 0.');
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
      ('order', $1, 1, 2000),
      ('invoice', $1, 1, 2000)
  `, [seriesKey]);

  const series = await client.query(`
    SELECT count(*)::int AS count
    FROM legend_commerce.document_number_series
    WHERE series_key = $1
  `, [seriesKey]);
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
      ) AS v3_column_present,
      (SELECT count(*)::int FROM legend_commerce.orders WHERE reference = ANY($1::text[])) AS synthetic_rows,
      CASE WHEN to_regclass('legend_commerce.document_number_series') IS NULL THEN 0 ELSE
        (SELECT count(*)::int FROM legend_commerce.document_number_series WHERE series_key = $2)
      END AS synthetic_series
  `, [syntheticRefs, seriesKey]);
  const proof = rollbackProof.rows?.[0] || {};
  if (proof.v3_column_present !== state.v3_already_present
    || proof.synthetic_rows !== 0
    || proof.synthetic_series !== 0) {
    throw new Error('Transactional Neon validation did not restore the original isolated database state.');
  }

  const mode = state.v3_already_present ? 'existing-V3 semantics' : 'pre-V3 migration application';
  console.log(`V3 011 isolated Neon validation passed (${mode}) and rolled back cleanly.`);
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
