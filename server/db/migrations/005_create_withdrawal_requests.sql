BEGIN;

CREATE TABLE IF NOT EXISTS legend_commerce.withdrawal_requests (
  order_reference text PRIMARY KEY
    REFERENCES legend_commerce.orders(reference) ON DELETE RESTRICT,
  payment_session_id text NOT NULL UNIQUE,
  confirmation_code text NOT NULL UNIQUE,
  withdrawn_at bigint NOT NULL,
  created_at bigint NOT NULL,

  CONSTRAINT withdrawal_reference_format
    CHECK (order_reference ~ '^[a-f0-9]{64}$'),
  CONSTRAINT withdrawal_paypal_order_id_format
    CHECK (payment_session_id ~ '^[A-Z0-9]{1,36}$'),
  CONSTRAINT withdrawal_confirmation_code_format
    CHECK (confirmation_code ~ '^LM-WD-[A-F0-9]{16}$'),
  CONSTRAINT withdrawal_timestamps_nonnegative
    CHECK (withdrawn_at >= 0 AND created_at >= 0)
);

CREATE INDEX IF NOT EXISTS withdrawal_requests_created_idx
  ON legend_commerce.withdrawal_requests (created_at DESC);

COMMENT ON TABLE legend_commerce.withdrawal_requests IS
  'Immutable consumer withdrawal notices. These records do not mutate PayPal payment state or trigger refunds automatically.';

COMMIT;
