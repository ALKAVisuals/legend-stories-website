#!/usr/bin/env bash
set -euo pipefail

container="legendmural-v3-pg18"
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

psql_stdin < server/db/migrations/001_create_order_store.sql
psql_stdin < server/db/migrations/003_add_paypal_reconciliation.sql

# Seed rows before 011 so the migration proves compatibility with existing
# pending and paid commerce state.
psql_stdin <<'SQL'
INSERT INTO legend_commerce.orders (
  reference, status, amount_total, currency, mode, payment_session_id,
  created_at, updated_at, paid_at, customer, items, discount, shipping, totals
) VALUES
(
  repeat('a', 64), 'payment_pending', 1995, 'EUR', 'test', 'PAYPALLEGACY001',
  1000, 1000, NULL, '{}'::jsonb, '[{"sku":"LEGACY-PENDING"}]'::jsonb,
  '{}'::jsonb, '{}'::jsonb, '{}'::jsonb
),
(
  repeat('b', 64), 'paid', 2995, 'EUR', 'test', 'PAYPALLEGACY002',
  1000, 1100, 1100, '{}'::jsonb, '[{"sku":"LEGACY-PAID"}]'::jsonb,
  '{}'::jsonb, '{}'::jsonb, '{}'::jsonb
);
SQL

psql_stdin < server/db/migrations/011_add_v3_order_invoice_architecture.sql

psql_stdin <<'SQL'
DO $$
DECLARE
  legacy_count integer;
  v_invoice_id bigint;
  deferred_count integer;
  series_count integer;
BEGIN
  SELECT count(*) INTO legacy_count
  FROM legend_commerce.orders
  WHERE reference IN (repeat('a', 64), repeat('b', 64))
    AND document_profile_version = 0
    AND order_number IS NULL
    AND order_number_assigned_at IS NULL
    AND invoice_id IS NULL;
  IF legacy_count <> 2 THEN
    RAISE EXCEPTION '011 did not preserve existing rows as legacy profile 0';
  END IF;

  -- A pre-V3 pending checkout must still be able to become paid without
  -- consuming V3 document identity.
  UPDATE legend_commerce.orders
  SET status = 'paid', paid_at = 1200, updated_at = 1200
  WHERE reference = repeat('a', 64);

  IF NOT EXISTS (
    SELECT 1 FROM legend_commerce.orders
    WHERE reference = repeat('a', 64)
      AND status = 'paid'
      AND document_profile_version = 0
      AND order_number IS NULL
      AND invoice_id IS NULL
  ) THEN
    RAISE EXCEPTION 'legacy profile 0 paid transition was blocked';
  END IF;

  -- A V3 pending checkout is valid only while it has no official identity.
  INSERT INTO legend_commerce.orders (
    reference, status, amount_total, currency, mode, payment_session_id,
    created_at, updated_at, customer, items, discount, shipping, totals,
    document_profile_version
  ) VALUES (
    repeat('c', 64), 'payment_pending', 3995, 'EUR', 'test', 'PAYPALV3PENDING01',
    2000, 2000, '{}'::jsonb, '[{"sku":"V3-PENDING"}]'::jsonb,
    '{}'::jsonb, '{}'::jsonb, '{}'::jsonb, 1
  );

  BEGIN
    UPDATE legend_commerce.orders
    SET status = 'paid', paid_at = 2100, updated_at = 2100
    WHERE reference = repeat('c', 64);
    RAISE EXCEPTION 'expected incomplete V3 paid identity to be rejected';
  EXCEPTION
    WHEN check_violation THEN NULL;
  END;

  IF NOT EXISTS (
    SELECT 1 FROM legend_commerce.orders
    WHERE reference = repeat('c', 64)
      AND status = 'payment_pending'
      AND document_profile_version = 1
  ) THEN
    RAISE EXCEPTION 'failed V3 transition did not roll back cleanly';
  END IF;

  BEGIN
    UPDATE legend_commerce.orders
    SET order_number = 'EARLY-ORDER', order_number_assigned_at = 2050
    WHERE reference = repeat('c', 64);
    RAISE EXCEPTION 'expected pre-payment V3 identity assignment to be rejected';
  EXCEPTION
    WHEN check_violation THEN NULL;
  END;

  -- Order and invoice counters must be independent even with one series key.
  INSERT INTO legend_commerce.document_number_series
    (document_type, series_key, next_value, updated_at)
  VALUES
    ('order', 'validation', 1, 2000),
    ('invoice', 'validation', 1, 2000);

  SELECT count(*) INTO series_count
  FROM legend_commerce.document_number_series
  WHERE series_key = 'validation';
  IF series_count <> 2 THEN
    RAISE EXCEPTION 'order/invoice series are not independent';
  END IF;

  -- Prove the intended deferred circular relationship: invoice first,
  -- then the paid order update in the same transaction.
  INSERT INTO legend_commerce.orders (
    reference, status, amount_total, currency, mode, payment_session_id,
    created_at, updated_at, customer, items, discount, shipping, totals,
    document_profile_version
  ) VALUES (
    repeat('d', 64), 'payment_pending', 4995, 'EUR', 'test', 'PAYPALV3VALID0001',
    3000, 3000, '{}'::jsonb, '[{"sku":"V3-VALID"}]'::jsonb,
    '{}'::jsonb, '{}'::jsonb, '{}'::jsonb, 1
  );

  INSERT INTO legend_commerce.invoices (
    order_reference, order_number, invoice_number, status, issued_at,
    currency, amount_total, schema_version, snapshot, created_at
  ) VALUES (
    repeat('d', 64), 'TEST-ORDER-000001', 'TEST-INVOICE-000001', 'issued', 3100,
    'EUR', 4995, 1, '{"schemaVersion":1}'::jsonb, 3100
  ) RETURNING id INTO v_invoice_id;

  UPDATE legend_commerce.orders
  SET status = 'paid',
      paid_at = 3100,
      updated_at = 3100,
      order_number = 'TEST-ORDER-000001',
      order_number_assigned_at = 3100,
      invoice_id = v_invoice_id
  WHERE reference = repeat('d', 64);

  SELECT count(*) INTO deferred_count
  FROM pg_constraint
  WHERE conname IN ('invoices_order_identity_fk', 'orders_invoice_same_order_fk')
    AND condeferrable
    AND condeferred;
  IF deferred_count <> 2 THEN
    RAISE EXCEPTION 'V3 circular order/invoice constraints are not initially deferred';
  END IF;
END $$;

-- The valid V3 dossier must survive the transaction boundary with both sides
-- pointing to the same order identity.
SELECT o.reference, o.status, o.document_profile_version, o.order_number,
       i.invoice_number, i.amount_total
FROM legend_commerce.orders o
JOIN legend_commerce.invoices i ON i.id = o.invoice_id
WHERE o.reference = repeat('d', 64)
  AND o.status = 'paid'
  AND o.document_profile_version = 1
  AND o.order_number = i.order_number
  AND o.amount_total = i.amount_total;
SQL

echo "V3 011 PostgreSQL 18 schema validation passed."
