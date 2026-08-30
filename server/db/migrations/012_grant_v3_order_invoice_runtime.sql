BEGIN;

-- Migration 002 granted table-wide INSERT/UPDATE on orders. Tighten those
-- privileges before V3 adds legal document identity columns to the runtime.
REVOKE INSERT, UPDATE
  ON TABLE legend_commerce.orders
  FROM __LEGEND_RUNTIME_ROLE__;

GRANT INSERT (
  reference,
  status,
  amount_total,
  currency,
  mode,
  payment_session_id,
  created_at,
  updated_at,
  paid_at,
  last_stripe_event_id,
  last_stripe_event_type,
  last_stripe_event_created,
  version,
  customer,
  items,
  discount,
  shipping,
  totals,
  document_profile_version
) ON TABLE legend_commerce.orders
  TO __LEGEND_RUNTIME_ROLE__;

GRANT UPDATE (
  status,
  updated_at,
  paid_at,
  last_stripe_event_id,
  last_stripe_event_type,
  last_stripe_event_created,
  version,
  order_number,
  order_number_assigned_at,
  invoice_id
) ON TABLE legend_commerce.orders
  TO __LEGEND_RUNTIME_ROLE__;

-- Issued invoice truth is immutable to the application runtime.
REVOKE ALL PRIVILEGES
  ON TABLE legend_commerce.invoices
  FROM __LEGEND_RUNTIME_ROLE__;

GRANT SELECT, INSERT
  ON TABLE legend_commerce.invoices
  TO __LEGEND_RUNTIME_ROLE__;

-- The runtime may allocate from a series, but may not rewrite series identity.
REVOKE ALL PRIVILEGES
  ON TABLE legend_commerce.document_number_series
  FROM __LEGEND_RUNTIME_ROLE__;

GRANT SELECT, INSERT
  ON TABLE legend_commerce.document_number_series
  TO __LEGEND_RUNTIME_ROLE__;

GRANT UPDATE (next_value, updated_at)
  ON TABLE legend_commerce.document_number_series
  TO __LEGEND_RUNTIME_ROLE__;

-- PostgreSQL identity backing sequence for invoices.id. USAGE is sufficient
-- for nextval() during INSERT; the runtime does not receive sequence UPDATE.
REVOKE ALL PRIVILEGES
  ON SEQUENCE legend_commerce.invoices_id_seq
  FROM __LEGEND_RUNTIME_ROLE__;

GRANT USAGE
  ON SEQUENCE legend_commerce.invoices_id_seq
  TO __LEGEND_RUNTIME_ROLE__;

COMMIT;
