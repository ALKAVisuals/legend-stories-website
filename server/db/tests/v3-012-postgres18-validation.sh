#!/usr/bin/env bash
set -euo pipefail

container="legendmural-v3-012-pg18"
cleanup() {
  docker rm -f "$container" >/dev/null 2>&1 || true
}
trap cleanup EXIT

docker run --name "$container" -e POSTGRES_PASSWORD=postgres -d postgres:18 >/dev/null
for _ in {1..30}; do
  if docker exec "$container" pg_isready -U postgres >/dev/null 2>&1; then
    break
  fi
  sleep 1
done
docker exec "$container" pg_isready -U postgres >/dev/null

psql_stdin() {
  docker exec -i "$container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres
}

psql_stdin <<'SQL'
CREATE ROLE legend_v3_runtime;
SQL

psql_stdin < server/db/migrations/001_create_order_store.sql
psql_stdin < server/db/migrations/003_add_paypal_reconciliation.sql
psql_stdin < server/db/migrations/011_add_v3_order_invoice_architecture.sql

sed 's/__LEGEND_RUNTIME_ROLE__/legend_v3_runtime/g' \
  server/db/migrations/002_grant_order_store_runtime.sql | psql_stdin
sed 's/__LEGEND_RUNTIME_ROLE__/legend_v3_runtime/g' \
  server/db/migrations/004_grant_paypal_reconciliation_runtime.sql | psql_stdin
sed 's/__LEGEND_RUNTIME_ROLE__/legend_v3_runtime/g' \
  server/db/migrations/012_grant_v3_order_invoice_runtime.sql | psql_stdin

psql_stdin <<'SQL'
DO $$
DECLARE
  seq_name text;
BEGIN
  SELECT pg_get_serial_sequence('legend_commerce.invoices', 'id') INTO seq_name;
  IF seq_name IS DISTINCT FROM 'legend_commerce.invoices_id_seq' THEN
    RAISE EXCEPTION 'unexpected invoices identity sequence: %', seq_name;
  END IF;

  IF NOT has_table_privilege('legend_v3_runtime', 'legend_commerce.orders', 'SELECT') THEN
    RAISE EXCEPTION 'runtime lost required orders SELECT';
  END IF;
  IF has_table_privilege('legend_v3_runtime', 'legend_commerce.orders', 'INSERT') THEN
    RAISE EXCEPTION 'runtime retained table-wide orders INSERT';
  END IF;
  IF has_table_privilege('legend_v3_runtime', 'legend_commerce.orders', 'UPDATE') THEN
    RAISE EXCEPTION 'runtime retained table-wide orders UPDATE';
  END IF;

  IF NOT has_column_privilege('legend_v3_runtime', 'legend_commerce.orders', 'document_profile_version', 'INSERT') THEN
    RAISE EXCEPTION 'runtime cannot opt a new checkout into an explicitly configured document profile';
  END IF;
  IF has_column_privilege('legend_v3_runtime', 'legend_commerce.orders', 'document_profile_version', 'UPDATE') THEN
    RAISE EXCEPTION 'runtime can rewrite document_profile_version after creation';
  END IF;
  IF has_column_privilege('legend_v3_runtime', 'legend_commerce.orders', 'order_number', 'INSERT') THEN
    RAISE EXCEPTION 'runtime can inject official order identity during checkout insert';
  END IF;
  IF NOT has_column_privilege('legend_v3_runtime', 'legend_commerce.orders', 'order_number', 'UPDATE')
     OR NOT has_column_privilege('legend_v3_runtime', 'legend_commerce.orders', 'invoice_id', 'UPDATE')
     OR NOT has_column_privilege('legend_v3_runtime', 'legend_commerce.orders', 'status', 'UPDATE')
     OR NOT has_column_privilege('legend_v3_runtime', 'legend_commerce.orders', 'paid_at', 'UPDATE')
     OR NOT has_column_privilege('legend_v3_runtime', 'legend_commerce.orders', 'version', 'UPDATE') THEN
    RAISE EXCEPTION 'runtime is missing required paid-finalization order columns';
  END IF;
  IF has_column_privilege('legend_v3_runtime', 'legend_commerce.orders', 'amount_total', 'UPDATE')
     OR has_column_privilege('legend_v3_runtime', 'legend_commerce.orders', 'customer', 'UPDATE')
     OR has_column_privilege('legend_v3_runtime', 'legend_commerce.orders', 'items', 'UPDATE') THEN
    RAISE EXCEPTION 'runtime can mutate immutable order quote/snapshot inputs';
  END IF;

  IF NOT has_table_privilege('legend_v3_runtime', 'legend_commerce.invoices', 'SELECT')
     OR NOT has_table_privilege('legend_v3_runtime', 'legend_commerce.invoices', 'INSERT') THEN
    RAISE EXCEPTION 'runtime is missing invoice SELECT/INSERT';
  END IF;
  IF has_table_privilege('legend_v3_runtime', 'legend_commerce.invoices', 'UPDATE')
     OR has_table_privilege('legend_v3_runtime', 'legend_commerce.invoices', 'DELETE')
     OR has_table_privilege('legend_v3_runtime', 'legend_commerce.invoices', 'TRUNCATE') THEN
    RAISE EXCEPTION 'runtime can mutate/delete immutable issued invoices';
  END IF;

  IF NOT has_table_privilege('legend_v3_runtime', 'legend_commerce.document_number_series', 'SELECT')
     OR NOT has_table_privilege('legend_v3_runtime', 'legend_commerce.document_number_series', 'INSERT') THEN
    RAISE EXCEPTION 'runtime is missing document series SELECT/INSERT';
  END IF;
  IF has_table_privilege('legend_v3_runtime', 'legend_commerce.document_number_series', 'UPDATE')
     OR has_table_privilege('legend_v3_runtime', 'legend_commerce.document_number_series', 'DELETE')
     OR has_table_privilege('legend_v3_runtime', 'legend_commerce.document_number_series', 'TRUNCATE') THEN
    RAISE EXCEPTION 'runtime has broad mutation rights on document series';
  END IF;
  IF NOT has_column_privilege('legend_v3_runtime', 'legend_commerce.document_number_series', 'next_value', 'UPDATE')
     OR NOT has_column_privilege('legend_v3_runtime', 'legend_commerce.document_number_series', 'updated_at', 'UPDATE') THEN
    RAISE EXCEPTION 'runtime cannot advance document series';
  END IF;
  IF has_column_privilege('legend_v3_runtime', 'legend_commerce.document_number_series', 'document_type', 'UPDATE')
     OR has_column_privilege('legend_v3_runtime', 'legend_commerce.document_number_series', 'series_key', 'UPDATE') THEN
    RAISE EXCEPTION 'runtime can rewrite document series identity';
  END IF;

  IF NOT has_sequence_privilege('legend_v3_runtime', 'legend_commerce.invoices_id_seq', 'USAGE') THEN
    RAISE EXCEPTION 'runtime lacks minimum invoice identity sequence USAGE';
  END IF;
  IF has_sequence_privilege('legend_v3_runtime', 'legend_commerce.invoices_id_seq', 'UPDATE')
     OR has_sequence_privilege('legend_v3_runtime', 'legend_commerce.invoices_id_seq', 'SELECT') THEN
    RAISE EXCEPTION 'runtime has broader invoice sequence privileges than required';
  END IF;
END $$;
SQL

psql_stdin <<'SQL'
BEGIN;
SET ROLE legend_v3_runtime;

INSERT INTO legend_commerce.orders (
  reference, status, amount_total, currency, mode, payment_session_id,
  created_at, updated_at, paid_at, last_stripe_event_id,
  last_stripe_event_type, last_stripe_event_created, version,
  customer, items, discount, shipping, totals, document_profile_version
) VALUES (
  repeat('e', 64), 'payment_pending', 5995, 'EUR', 'test', 'PAYPALV3GRANT0001',
  4000, 4000, NULL, NULL, NULL, 0, 0,
  '{}'::jsonb, '[{"sku":"V3-GRANT"}]'::jsonb,
  '{}'::jsonb, '{}'::jsonb, '{}'::jsonb, 1
);

DO $$
BEGIN
  BEGIN
    INSERT INTO legend_commerce.orders (
      reference, status, amount_total, currency, mode, payment_session_id,
      created_at, updated_at, customer, items, discount, shipping, totals,
      document_profile_version, order_number
    ) VALUES (
      repeat('f', 64), 'payment_pending', 1000, 'EUR', 'test', 'PAYPALV3GRANT0002',
      4000, 4000, '{}'::jsonb, '[{"sku":"DENIED"}]'::jsonb,
      '{}'::jsonb, '{}'::jsonb, '{}'::jsonb, 1, 'FORBIDDEN-EARLY-ID'
    );
    RAISE EXCEPTION 'expected early official identity INSERT to be denied';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;

  BEGIN
    UPDATE legend_commerce.orders
    SET document_profile_version = 0
    WHERE reference = repeat('e', 64);
    RAISE EXCEPTION 'expected document_profile_version UPDATE to be denied';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;

  BEGIN
    UPDATE legend_commerce.orders
    SET customer = customer
    WHERE reference = repeat('e', 64);
    RAISE EXCEPTION 'expected customer UPDATE to be denied';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
END $$;

INSERT INTO legend_commerce.document_number_series
  (document_type, series_key, next_value, updated_at)
VALUES
  ('order', 'grant-validation', 1, 4000),
  ('invoice', 'grant-validation', 1, 4000);

UPDATE legend_commerce.document_number_series
SET next_value = next_value + 1,
    updated_at = 4100
WHERE document_type = 'order'
  AND series_key = 'grant-validation';

DO $$
BEGIN
  BEGIN
    UPDATE legend_commerce.document_number_series
    SET series_key = 'forbidden-rewrite'
    WHERE document_type = 'order'
      AND series_key = 'grant-validation';
    RAISE EXCEPTION 'expected series identity UPDATE to be denied';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
END $$;

WITH issued AS (
  INSERT INTO legend_commerce.invoices (
    order_reference, order_number, invoice_number, status, issued_at,
    currency, amount_total, schema_version, snapshot, created_at
  ) VALUES (
    repeat('e', 64), 'TEST-ORDER-GRANT-000001', 'TEST-INVOICE-GRANT-000001',
    'issued', 4200, 'EUR', 5995, 1, '{"schemaVersion":1}'::jsonb, 4200
  )
  RETURNING id
)
UPDATE legend_commerce.orders
SET status = 'paid',
    updated_at = 4200,
    paid_at = 4200,
    version = version + 1,
    order_number = 'TEST-ORDER-GRANT-000001',
    order_number_assigned_at = 4200,
    invoice_id = issued.id
FROM issued
WHERE reference = repeat('e', 64);

SET CONSTRAINTS ALL IMMEDIATE;

DO $$
BEGIN
  BEGIN
    UPDATE legend_commerce.invoices
    SET amount_total = amount_total
    WHERE order_reference = repeat('e', 64);
    RAISE EXCEPTION 'expected invoice UPDATE to be denied';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;

  BEGIN
    DELETE FROM legend_commerce.invoices
    WHERE order_reference = repeat('e', 64);
    RAISE EXCEPTION 'expected invoice DELETE to be denied';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
END $$;

RESET ROLE;
ROLLBACK;
SQL

echo "V3 012 PostgreSQL 18 least-privilege validation passed."
