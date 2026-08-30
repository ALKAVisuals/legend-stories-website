#!/usr/bin/env bash
set -euo pipefail

container="legendmural-v3-allocator-pg18"
tmpdir="$(mktemp -d)"
cleanup() {
  docker rm -f "$container" >/dev/null 2>&1 || true
  rm -rf "$tmpdir"
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
  docker exec -i "$container" psql -X -v ON_ERROR_STOP=1 -U postgres -d postgres
}

psql_value() {
  docker exec "$container" psql -XAtq -v ON_ERROR_STOP=1 -U postgres -d postgres -c "$1"
}

apply_runtime_migration() {
  sed 's/__LEGEND_RUNTIME_ROLE__/legend_runtime/g' "$1" | psql_stdin >/dev/null
}

psql_stdin <<'SQL' >/dev/null
CREATE ROLE legend_runtime NOLOGIN;
SQL

psql_stdin < server/db/migrations/001_create_order_store.sql >/dev/null
psql_stdin < server/db/migrations/003_add_paypal_reconciliation.sql >/dev/null
psql_stdin < server/db/migrations/011_add_v3_order_invoice_architecture.sql >/dev/null
apply_runtime_migration server/db/migrations/002_grant_order_store_runtime.sql
apply_runtime_migration server/db/migrations/004_grant_paypal_reconciliation_runtime.sql
apply_runtime_migration server/db/migrations/012_grant_v3_order_invoice_runtime.sql

# Run the same create -> row lock -> exact increment contract used by the JS
# allocator. The caller owns the surrounding transaction.
allocate_once() {
  local document_type="$1"
  local series_key="$2"
  local updated_at="$3"
  local hold_seconds="${4:-0}"

  docker exec -i "$container" psql -XAtq -v ON_ERROR_STOP=1 -U postgres -d postgres <<SQL
BEGIN;
SET ROLE legend_runtime;
INSERT INTO legend_commerce.document_number_series (
  document_type, series_key, next_value, updated_at
) VALUES ('$document_type', '$series_key', 1, $updated_at)
ON CONFLICT (document_type, series_key) DO NOTHING;
WITH locked AS MATERIALIZED (
  SELECT next_value
  FROM legend_commerce.document_number_series
  WHERE document_type = '$document_type' AND series_key = '$series_key'
  FOR UPDATE
)
UPDATE legend_commerce.document_number_series AS series
SET next_value = locked.next_value + 1,
    updated_at = GREATEST(series.updated_at, $updated_at)
FROM locked
WHERE series.document_type = '$document_type'
  AND series.series_key = '$series_key'
  AND series.next_value = locked.next_value
RETURNING series.next_value - 1;
SELECT pg_sleep($hold_seconds);
COMMIT;
SQL
}

first="$(allocate_once order sequential 1000 | grep -E '^[0-9]+$' | head -1)"
second="$(allocate_once order sequential 1001 | grep -E '^[0-9]+$' | head -1)"
if [[ "$first" != "1" || "$second" != "2" ]]; then
  echo "Expected sequential allocations 1,2; got $first,$second" >&2
  exit 1
fi

# Order and invoice counters must remain independent even when they share a key.
order_value="$(allocate_once order independent 1100 | grep -E '^[0-9]+$' | head -1)"
invoice_value="$(allocate_once invoice independent 1100 | grep -E '^[0-9]+$' | head -1)"
if [[ "$order_value" != "1" || "$invoice_value" != "1" ]]; then
  echo "Order/invoice series are not independent: $order_value,$invoice_value" >&2
  exit 1
fi

# A counter touch inside a rolled-back caller transaction must consume nothing.
psql_stdin <<'SQL' >/dev/null
INSERT INTO legend_commerce.document_number_series
  (document_type, series_key, next_value, updated_at)
VALUES ('order', 'rollback', 50, 1200);

BEGIN;
SET ROLE legend_runtime;
SELECT next_value
FROM legend_commerce.document_number_series
WHERE document_type = 'order' AND series_key = 'rollback'
FOR UPDATE;
UPDATE legend_commerce.document_number_series
SET next_value = 51, updated_at = 1201
WHERE document_type = 'order' AND series_key = 'rollback' AND next_value = 50;
ROLLBACK;
SQL
rollback_value="$(psql_value "SELECT next_value FROM legend_commerce.document_number_series WHERE document_type='order' AND series_key='rollback'")"
if [[ "$rollback_value" != "50" ]]; then
  echo "Rollback consumed a document number; expected 50, got $rollback_value" >&2
  exit 1
fi

# Two genuinely overlapping transactions against one series may block, but
# they must never return the same allocation. Session A deliberately retains
# its row lock for one second before commit while session B starts behind it.
allocate_once order concurrent 1300 1 >"$tmpdir/a.out" &
pid_a=$!
sleep 0.2
allocate_once order concurrent 1301 0 >"$tmpdir/b.out" &
pid_b=$!
wait "$pid_a"
wait "$pid_b"

mapfile -t concurrent_values < <(
  cat "$tmpdir/a.out" "$tmpdir/b.out" | grep -E '^[0-9]+$' | sort -n
)
if [[ "${#concurrent_values[@]}" -ne 2
   || "${concurrent_values[0]}" != "1"
   || "${concurrent_values[1]}" != "2" ]]; then
  echo "Concurrent allocations were not unique/consecutive:" >&2
  cat "$tmpdir/a.out" "$tmpdir/b.out" >&2
  exit 1
fi

concurrent_next="$(psql_value "SELECT next_value FROM legend_commerce.document_number_series WHERE document_type='order' AND series_key='concurrent'")"
if [[ "$concurrent_next" != "3" ]]; then
  echo "Concurrent counter did not advance exactly twice; got $concurrent_next" >&2
  exit 1
fi

# The schema itself rejects types outside the currently supported order/invoice
# families. The application allocator additionally rejects malformed keys.
if psql_value "INSERT INTO legend_commerce.document_number_series (document_type, series_key, next_value, updated_at) VALUES ('other','invalid',1,1)" >/dev/null 2>&1; then
  echo "Unexpectedly accepted unsupported document type" >&2
  exit 1
fi

# No production-format policy belongs in the allocator implementation itself.
if grep -E 'LM-ORD-|LM-INV-' server/commerce/document-number-allocator.mjs >/dev/null; then
  echo "Allocator prematurely hardcodes a public document number format" >&2
  exit 1
fi

echo "V3 document number allocator PostgreSQL 18 validation passed."
