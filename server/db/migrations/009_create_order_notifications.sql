BEGIN;

CREATE TABLE IF NOT EXISTS legend_commerce.order_notifications (
  order_reference text NOT NULL
    REFERENCES legend_commerce.orders(reference) ON DELETE RESTRICT,
  notification_type text NOT NULL,
  delivery_status text NOT NULL DEFAULT 'pending',
  delivery_attempts integer NOT NULL DEFAULT 0,
  claimed_at bigint,
  last_attempt_at bigint,
  sent_at bigint,
  provider_message_id text,
  last_error_code text,
  created_at bigint NOT NULL,
  updated_at bigint NOT NULL,

  PRIMARY KEY (order_reference, notification_type),

  CONSTRAINT order_notifications_reference_format
    CHECK (order_reference ~ '^[a-f0-9]{64}$'),
  CONSTRAINT order_notifications_type_allowed
    CHECK (notification_type IN ('merchant_paid_order', 'customer_paid_order')),
  CONSTRAINT order_notifications_status_allowed
    CHECK (delivery_status IN ('pending', 'sending', 'sent', 'failed')),
  CONSTRAINT order_notifications_attempts_nonnegative
    CHECK (delivery_attempts >= 0),
  CONSTRAINT order_notifications_timestamps_nonnegative
    CHECK (
      created_at >= 0
      AND updated_at >= 0
      AND (claimed_at IS NULL OR claimed_at >= 0)
      AND (last_attempt_at IS NULL OR last_attempt_at >= 0)
      AND (sent_at IS NULL OR sent_at >= 0)
    )
);

CREATE INDEX IF NOT EXISTS order_notifications_delivery_idx
  ON legend_commerce.order_notifications (delivery_status, updated_at ASC);

COMMENT ON TABLE legend_commerce.order_notifications IS
  'Durable idempotency and delivery state for paid-order customer and merchant notifications.';

COMMIT;
