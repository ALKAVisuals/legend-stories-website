BEGIN;

ALTER TABLE legend_commerce.order_notifications
  ADD COLUMN IF NOT EXISTS invoice_id bigint,
  ADD COLUMN IF NOT EXISTS snapshot_schema_version smallint,
  ADD COLUMN IF NOT EXISTS renderer_version smallint,
  ADD COLUMN IF NOT EXISTS pdf_sha256 text,
  ADD COLUMN IF NOT EXISTS pdf_byte_length integer,
  ADD COLUMN IF NOT EXISTS attachment_filename text,
  ADD COLUMN IF NOT EXISTS claim_token text,
  ADD COLUMN IF NOT EXISTS lease_expires_at bigint,
  ADD COLUMN IF NOT EXISTS next_attempt_at bigint;

ALTER TABLE legend_commerce.order_notifications
  DROP CONSTRAINT IF EXISTS order_notifications_type_allowed;

ALTER TABLE legend_commerce.order_notifications
  ADD CONSTRAINT order_notifications_type_allowed
  CHECK (
    notification_type IN (
      'merchant_paid_order',
      'customer_paid_order',
      'customer_v3_invoice'
    )
  );

CREATE UNIQUE INDEX IF NOT EXISTS invoices_delivery_identity_unique_idx
  ON legend_commerce.invoices (id, order_reference);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'order_notifications_invoice_identity_fk'
      AND conrelid = 'legend_commerce.order_notifications'::regclass
  ) THEN
    ALTER TABLE legend_commerce.order_notifications
      ADD CONSTRAINT order_notifications_invoice_identity_fk
      FOREIGN KEY (invoice_id, order_reference)
      REFERENCES legend_commerce.invoices(id, order_reference)
      ON DELETE RESTRICT;
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'order_notifications_v3_invoice_binding_required'
      AND conrelid = 'legend_commerce.order_notifications'::regclass
  ) THEN
    ALTER TABLE legend_commerce.order_notifications
      ADD CONSTRAINT order_notifications_v3_invoice_binding_required
      CHECK (
        notification_type <> 'customer_v3_invoice'
        OR (
          invoice_id IS NOT NULL
          AND snapshot_schema_version IS NOT NULL
          AND snapshot_schema_version >= 1
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
    WHERE conname = 'order_notifications_v3_metadata_valid'
      AND conrelid = 'legend_commerce.order_notifications'::regclass
  ) THEN
    ALTER TABLE legend_commerce.order_notifications
      ADD CONSTRAINT order_notifications_v3_metadata_valid
      CHECK (
        (snapshot_schema_version IS NULL OR snapshot_schema_version >= 1)
        AND (renderer_version IS NULL OR renderer_version >= 1)
        AND (pdf_sha256 IS NULL OR pdf_sha256 ~ '^[a-f0-9]{64}$')
        AND (pdf_byte_length IS NULL OR pdf_byte_length >= 0)
        AND (claim_token IS NULL OR length(claim_token) BETWEEN 1 AND 120)
      );
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'order_notifications_delivery_schedule_nonnegative'
      AND conrelid = 'legend_commerce.order_notifications'::regclass
  ) THEN
    ALTER TABLE legend_commerce.order_notifications
      ADD CONSTRAINT order_notifications_delivery_schedule_nonnegative
      CHECK (
        (lease_expires_at IS NULL OR lease_expires_at >= 0)
        AND (next_attempt_at IS NULL OR next_attempt_at >= 0)
      );
  END IF;
END
$$;

CREATE INDEX IF NOT EXISTS order_notifications_delivery_due_idx
  ON legend_commerce.order_notifications (
    delivery_status,
    next_attempt_at,
    lease_expires_at,
    updated_at
  );

COMMENT ON COLUMN legend_commerce.order_notifications.invoice_id IS
  'Binds a V3 customer invoice delivery to the immutable issued invoice source record.';

COMMENT ON COLUMN legend_commerce.order_notifications.snapshot_schema_version IS
  'Immutable invoice snapshot schema version used by the logical V3 delivery.';

COMMENT ON COLUMN legend_commerce.order_notifications.claim_token IS
  'Opaque token for the active sending claim; V3 delivery completion must match the current claim.';

COMMENT ON COLUMN legend_commerce.order_notifications.lease_expires_at IS
  'Expiry of the current sending claim. Expired or legacy NULL sending claims may be reclaimed.';

COMMENT ON COLUMN legend_commerce.order_notifications.next_attempt_at IS
  'Earliest timestamp at which a failed notification may be reclaimed. NULL preserves immediate retry eligibility.';

COMMIT;
