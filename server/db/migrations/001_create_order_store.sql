BEGIN;

CREATE SCHEMA IF NOT EXISTS legend_commerce;

CREATE TABLE IF NOT EXISTS legend_commerce.orders (
  reference text PRIMARY KEY,
  status text NOT NULL,
  amount_total integer NOT NULL,
  currency text NOT NULL,
  mode text NOT NULL,
  payment_session_id text NOT NULL UNIQUE,
  created_at bigint NOT NULL,
  updated_at bigint NOT NULL,
  paid_at bigint,
  last_stripe_event_id text,
  last_stripe_event_type text,
  last_stripe_event_created bigint NOT NULL DEFAULT 0,
  version integer NOT NULL DEFAULT 0,
  customer jsonb NOT NULL,
  items jsonb NOT NULL,
  discount jsonb NOT NULL,
  shipping jsonb NOT NULL,
  totals jsonb NOT NULL,

  CONSTRAINT orders_reference_format
    CHECK (reference ~ '^[a-f0-9]{64}$'),
  CONSTRAINT orders_status_allowed
    CHECK (status IN (
      'payment_pending',
      'payment_processing',
      'payment_failed',
      'expired',
      'paid'
    )),
  CONSTRAINT orders_amount_nonnegative
    CHECK (amount_total >= 0),
  CONSTRAINT orders_currency_eur
    CHECK (currency = 'EUR'),
  CONSTRAINT orders_mode_allowed
    CHECK (mode IN ('test', 'live')),
  CONSTRAINT orders_session_format
    CHECK (payment_session_id ~ '^cs_(test|live)_[A-Za-z0-9_-]+$'),
  CONSTRAINT orders_session_mode_consistent
    CHECK (
      (mode = 'test' AND payment_session_id LIKE 'cs_test_%')
      OR (mode = 'live' AND payment_session_id LIKE 'cs_live_%')
    ),
  CONSTRAINT orders_timestamps_nonnegative
    CHECK (
      created_at >= 0
      AND updated_at >= 0
      AND last_stripe_event_created >= 0
      AND (paid_at IS NULL OR paid_at >= 0)
    ),
  CONSTRAINT orders_version_nonnegative
    CHECK (version >= 0),
  CONSTRAINT orders_customer_object
    CHECK (jsonb_typeof(customer) = 'object'),
  CONSTRAINT orders_items_array
    CHECK (jsonb_typeof(items) = 'array' AND jsonb_array_length(items) > 0),
  CONSTRAINT orders_discount_object
    CHECK (jsonb_typeof(discount) = 'object'),
  CONSTRAINT orders_shipping_object
    CHECK (jsonb_typeof(shipping) = 'object'),
  CONSTRAINT orders_totals_object
    CHECK (jsonb_typeof(totals) = 'object')
);

CREATE TABLE IF NOT EXISTS legend_commerce.stripe_events (
  event_id text PRIMARY KEY,
  event_type text NOT NULL,
  order_reference text NOT NULL,
  stripe_created_at bigint NOT NULL,
  processed_at bigint NOT NULL,

  CONSTRAINT stripe_events_id_format
    CHECK (event_id ~ '^evt_[A-Za-z0-9_-]+$'),
  CONSTRAINT stripe_events_reference_format
    CHECK (order_reference ~ '^[a-f0-9]{64}$'),
  CONSTRAINT stripe_events_timestamps_nonnegative
    CHECK (stripe_created_at >= 0 AND processed_at >= 0)
);

CREATE INDEX IF NOT EXISTS orders_status_updated_idx
  ON legend_commerce.orders (status, updated_at DESC);

CREATE INDEX IF NOT EXISTS stripe_events_order_reference_idx
  ON legend_commerce.stripe_events (order_reference, stripe_created_at DESC);

COMMENT ON TABLE legend_commerce.orders IS
  'Authoritative LegendMural orders. Immutable fulfillment JSON is compared on idempotent retries.';

COMMENT ON TABLE legend_commerce.stripe_events IS
  'Globally unique Stripe event reservations committed atomically with order status updates.';

COMMIT;
