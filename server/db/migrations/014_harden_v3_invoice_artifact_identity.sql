BEGIN;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'order_notifications_v3_artifact_identity_complete'
      AND conrelid = 'legend_commerce.order_notifications'::regclass
  ) THEN
    ALTER TABLE legend_commerce.order_notifications
      ADD CONSTRAINT order_notifications_v3_artifact_identity_complete
      CHECK (
        (
          renderer_version IS NULL
          AND pdf_sha256 IS NULL
          AND pdf_byte_length IS NULL
          AND attachment_filename IS NULL
        )
        OR (
          notification_type = 'customer_v3_invoice'
          AND renderer_version IS NOT NULL
          AND renderer_version >= 1
          AND pdf_sha256 IS NOT NULL
          AND pdf_sha256 ~ '^[a-f0-9]{64}$'
          AND pdf_byte_length IS NOT NULL
          AND pdf_byte_length > 0
          AND attachment_filename IS NOT NULL
          AND length(attachment_filename) BETWEEN 1 AND 200
          AND attachment_filename = btrim(attachment_filename)
          AND attachment_filename !~ '[[:cntrl:]]'
          AND position('/' in attachment_filename) = 0
          AND position(chr(92) in attachment_filename) = 0
          AND lower(attachment_filename) LIKE '%.pdf'
        )
      );
  END IF;
END
$$;

COMMENT ON CONSTRAINT order_notifications_v3_artifact_identity_complete
  ON legend_commerce.order_notifications IS
  'V3 invoice PDF artifact identity must be entirely absent or complete, safe, positive-sized and bound only to customer_v3_invoice.';

COMMIT;
