BEGIN;

ALTER TABLE legend_commerce.orders
  ADD COLUMN IF NOT EXISTS document_profile_version smallint NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS order_number text,
  ADD COLUMN IF NOT EXISTS order_number_assigned_at bigint,
  ADD COLUMN IF NOT EXISTS invoice_id bigint;

CREATE SEQUENCE IF NOT EXISTS legend_commerce.invoices_id_seq
  AS bigint
  START WITH 1
  INCREMENT BY 1
  MINVALUE 1
  CACHE 1;

CREATE TABLE IF NOT EXISTS legend_commerce.document_number_series (
  document_type text NOT NULL,
  series_key text NOT NULL,
  next_value bigint NOT NULL,
  updated_at bigint NOT NULL,

  PRIMARY KEY (document_type, series_key),

  CONSTRAINT document_number_series_type_allowed
    CHECK (document_type IN ('order', 'invoice')),
  CONSTRAINT document_number_series_key_format
    CHECK (series_key ~ '^[A-Za-z0-9][A-Za-z0-9._-]{0,31}$'),
  CONSTRAINT document_number_series_next_positive
    CHECK (next_value >= 1),
  CONSTRAINT document_number_series_updated_nonnegative
    CHECK (updated_at >= 0)
);

CREATE TABLE IF NOT EXISTS legend_commerce.invoices (
  id bigint PRIMARY KEY DEFAULT nextval('legend_commerce.invoices_id_seq'),
  order_reference text NOT NULL,
  order_number text NOT NULL,
  invoice_number text NOT NULL,
  status text NOT NULL,
  issued_at bigint NOT NULL,
  currency text NOT NULL,
  amount_total integer NOT NULL,
  schema_version smallint NOT NULL,
  snapshot jsonb NOT NULL,
  created_at bigint NOT NULL,

  CONSTRAINT invoices_order_reference_unique UNIQUE (order_reference),
  CONSTRAINT invoices_order_number_unique UNIQUE (order_number),
  CONSTRAINT invoices_invoice_number_unique UNIQUE (invoice_number),
  CONSTRAINT invoices_identity_tuple_unique UNIQUE (id, order_reference, order_number),
  CONSTRAINT invoices_order_reference_fk
    FOREIGN KEY (order_reference)
    REFERENCES legend_commerce.orders(reference)
    ON DELETE RESTRICT,
  CONSTRAINT invoices_status_allowed
    CHECK (status = 'issued'),
  CONSTRAINT invoices_currency_eur
    CHECK (currency = 'EUR'),
  CONSTRAINT invoices_amount_nonnegative
    CHECK (amount_total >= 0),
  CONSTRAINT invoices_schema_version_positive
    CHECK (schema_version >= 1),
  CONSTRAINT invoices_snapshot_object
    CHECK (jsonb_typeof(snapshot) = 'object'),
  CONSTRAINT invoices_timestamps_nonnegative
    CHECK (issued_at >= 0 AND created_at >= 0)
);

ALTER SEQUENCE legend_commerce.invoices_id_seq
  OWNED BY legend_commerce.invoices.id;

CREATE UNIQUE INDEX IF NOT EXISTS orders_order_number_unique_idx
  ON legend_commerce.orders (order_number)
  WHERE order_number IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS orders_invoice_id_unique_idx
  ON legend_commerce.orders (invoice_id)
  WHERE invoice_id IS NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'orders_document_profile_allowed'
      AND conrelid = 'legend_commerce.orders'::regclass
  ) THEN
    ALTER TABLE legend_commerce.orders
      ADD CONSTRAINT orders_document_profile_allowed
      CHECK (document_profile_version IN (0, 1));
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'orders_document_identity_consistent'
      AND conrelid = 'legend_commerce.orders'::regclass
  ) THEN
    ALTER TABLE legend_commerce.orders
      ADD CONSTRAINT orders_document_identity_consistent
      CHECK (
        (
          document_profile_version = 0
          AND order_number IS NULL
          AND order_number_assigned_at IS NULL
          AND invoice_id IS NULL
        )
        OR
        (
          document_profile_version = 1
          AND (
            (
              status = 'paid'
              AND order_number IS NOT NULL
              AND order_number_assigned_at IS NOT NULL
              AND invoice_id IS NOT NULL
            )
            OR
            (
              status <> 'paid'
              AND order_number IS NULL
              AND order_number_assigned_at IS NULL
              AND invoice_id IS NULL
            )
          )
        )
      );
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'orders_document_timestamps_nonnegative'
      AND conrelid = 'legend_commerce.orders'::regclass
  ) THEN
    ALTER TABLE legend_commerce.orders
      ADD CONSTRAINT orders_document_timestamps_nonnegative
      CHECK (order_number_assigned_at IS NULL OR order_number_assigned_at >= 0);
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'orders_invoice_identity_fk'
      AND conrelid = 'legend_commerce.orders'::regclass
  ) THEN
    ALTER TABLE legend_commerce.orders
      ADD CONSTRAINT orders_invoice_identity_fk
      FOREIGN KEY (invoice_id, reference, order_number)
      REFERENCES legend_commerce.invoices(id, order_reference, order_number)
      ON DELETE RESTRICT;
  END IF;
END
$$;

COMMENT ON COLUMN legend_commerce.orders.document_profile_version IS
  '0 = legacy/pre-V3 order; 1 = V3 order requiring official document identity on first durable paid transition.';

COMMENT ON TABLE legend_commerce.document_number_series IS
  'Transactional server-side counters for independent official order and invoice number series.';

COMMENT ON TABLE legend_commerce.invoices IS
  'Immutable issued invoice source records. PDF and email artifacts are derived from the versioned snapshot.';

COMMIT;
