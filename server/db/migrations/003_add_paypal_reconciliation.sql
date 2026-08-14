BEGIN;

ALTER TABLE legend_commerce.orders
  DROP CONSTRAINT IF EXISTS orders_session_format;

ALTER TABLE legend_commerce.orders
  DROP CONSTRAINT IF EXISTS orders_session_mode_consistent;

ALTER TABLE legend_commerce.orders
  ADD COLUMN IF NOT EXISTS payment_provider text
  GENERATED ALWAYS AS (
    CASE
      WHEN payment_session_id ~ '^cs_(test|live)_[A-Za-z0-9_-]+$' THEN 'stripe'::text
      WHEN payment_session_id ~ '^[A-Z0-9]{1,36}$' THEN 'paypal'::text
      ELSE NULL::text
    END
  ) STORED;

ALTER TABLE legend_commerce.orders
  DROP CONSTRAINT IF EXISTS orders_payment_provider_known;

ALTER TABLE legend_commerce.orders
  ADD CONSTRAINT orders_payment_provider_known
    CHECK (payment_provider IS NOT NULL);

ALTER TABLE legend_commerce.orders
  DROP CONSTRAINT IF EXISTS orders_payment_provider_allowed;

ALTER TABLE legend_commerce.orders
  ADD CONSTRAINT orders_payment_provider_allowed
    CHECK (payment_provider IN ('stripe', 'paypal'));

ALTER TABLE legend_commerce.orders
  ADD CONSTRAINT orders_session_mode_consistent
    CHECK (
      payment_provider = 'paypal'
      OR (
        payment_provider = 'stripe'
        AND (
          (mode = 'test' AND payment_session_id LIKE 'cs_test_%')
          OR (mode = 'live' AND payment_session_id LIKE 'cs_live_%')
        )
      )
    );

CREATE TABLE IF NOT EXISTS legend_commerce.paypal_webhook_events (
  event_id text PRIMARY KEY,
  event_type text NOT NULL,
  order_reference text NOT NULL,
  paypal_order_id text NOT NULL,
  paypal_capture_id text,
  mode text NOT NULL,
  paypal_created_at bigint NOT NULL,
  processed_at bigint NOT NULL,

  CONSTRAINT paypal_webhook_events_id_nonempty
    CHECK (char_length(event_id) BETWEEN 1 AND 128),
  CONSTRAINT paypal_webhook_events_type_nonempty
    CHECK (char_length(event_type) BETWEEN 1 AND 128),
  CONSTRAINT paypal_webhook_events_reference_format
    CHECK (order_reference ~ '^[a-f0-9]{64}$'),
  CONSTRAINT paypal_webhook_events_order_id_format
    CHECK (paypal_order_id ~ '^[A-Z0-9]{1,36}$'),
  CONSTRAINT paypal_webhook_events_capture_id_length
    CHECK (
      paypal_capture_id IS NULL
      OR char_length(paypal_capture_id) BETWEEN 1 AND 128
    ),
  CONSTRAINT paypal_webhook_events_mode_allowed
    CHECK (mode IN ('test', 'live')),
  CONSTRAINT paypal_webhook_events_timestamps_nonnegative
    CHECK (paypal_created_at >= 0 AND processed_at >= 0)
);

CREATE INDEX IF NOT EXISTS paypal_webhook_events_order_reference_idx
  ON legend_commerce.paypal_webhook_events (order_reference, paypal_created_at DESC);

CREATE INDEX IF NOT EXISTS paypal_webhook_events_order_id_idx
  ON legend_commerce.paypal_webhook_events (paypal_order_id, paypal_created_at DESC);

COMMENT ON COLUMN legend_commerce.orders.payment_provider IS
  'Derived payment provider. Stripe Checkout session IDs and PayPal order IDs cannot be relabeled by application writes.';

COMMENT ON TABLE legend_commerce.paypal_webhook_events IS
  'Verified PayPal webhook event reservations for idempotent reconciliation. Full provider payloads are intentionally not stored.';

COMMIT;
