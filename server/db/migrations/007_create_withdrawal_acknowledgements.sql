BEGIN;

CREATE TABLE IF NOT EXISTS legend_commerce.withdrawal_acknowledgements (
  order_reference text PRIMARY KEY
    REFERENCES legend_commerce.withdrawal_requests(order_reference) ON DELETE RESTRICT,
  payment_session_id text NOT NULL UNIQUE,
  confirmation_code text NOT NULL UNIQUE,
  consumer_name text NOT NULL,
  confirmation_email text NOT NULL,
  declaration text NOT NULL,
  withdrawn_at bigint NOT NULL,
  delivery_status text NOT NULL DEFAULT 'pending',
  delivery_attempts integer NOT NULL DEFAULT 0,
  last_attempt_at bigint,
  sent_at bigint,
  provider_message_id text,
  last_error_code text,
  created_at bigint NOT NULL,
  updated_at bigint NOT NULL,

  CONSTRAINT withdrawal_ack_reference_format
    CHECK (order_reference ~ '^[a-f0-9]{64}$'),
  CONSTRAINT withdrawal_ack_paypal_order_id_format
    CHECK (payment_session_id ~ '^[A-Z0-9]{1,36}$'),
  CONSTRAINT withdrawal_ack_confirmation_code_format
    CHECK (confirmation_code ~ '^LM-WD-[A-F0-9]{16}$'),
  CONSTRAINT withdrawal_ack_consumer_name_length
    CHECK (char_length(consumer_name) BETWEEN 1 AND 200),
  CONSTRAINT withdrawal_ack_confirmation_email_length
    CHECK (char_length(confirmation_email) BETWEEN 3 AND 254),
  CONSTRAINT withdrawal_ack_declaration_length
    CHECK (char_length(declaration) BETWEEN 1 AND 500),
  CONSTRAINT withdrawal_ack_delivery_status
    CHECK (delivery_status IN ('pending', 'sent', 'failed')),
  CONSTRAINT withdrawal_ack_attempts_nonnegative
    CHECK (delivery_attempts >= 0),
  CONSTRAINT withdrawal_ack_timestamps_nonnegative
    CHECK (
      withdrawn_at >= 0
      AND created_at >= 0
      AND updated_at >= 0
      AND (last_attempt_at IS NULL OR last_attempt_at >= 0)
      AND (sent_at IS NULL OR sent_at >= 0)
    )
);

CREATE INDEX IF NOT EXISTS withdrawal_acknowledgements_delivery_idx
  ON legend_commerce.withdrawal_acknowledgements (delivery_status, updated_at ASC);

COMMENT ON TABLE legend_commerce.withdrawal_acknowledgements IS
  'Durable statutory withdrawal acknowledgement snapshot and delivery state. Statement fields are immutable; only delivery metadata may be updated by the runtime role.';

COMMIT;
