BEGIN;

ALTER TABLE legend_commerce.order_notifications
  ADD COLUMN IF NOT EXISTS pdf_storage_backend text,
  ADD COLUMN IF NOT EXISTS pdf_storage_key text,
  ADD COLUMN IF NOT EXISTS pdf_stored_at bigint;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'order_notifications_v3_pdf_storage_binding_complete'
      AND conrelid = 'legend_commerce.order_notifications'::regclass
  ) THEN
    ALTER TABLE legend_commerce.order_notifications
      ADD CONSTRAINT order_notifications_v3_pdf_storage_binding_complete
      CHECK (
        (
          pdf_storage_backend IS NULL
          AND pdf_storage_key IS NULL
          AND pdf_stored_at IS NULL
        )
        OR (
          notification_type = 'customer_v3_invoice'
          AND invoice_id IS NOT NULL
          AND pdf_sha256 IS NOT NULL
          AND pdf_sha256 ~ '^[a-f0-9]{64}$'
          AND pdf_storage_backend = 'netlify_blobs'
          AND pdf_storage_key = (
            'v1/invoices/' || invoice_id::text || '/' || pdf_sha256 || '.pdf'
          )
          AND pdf_stored_at IS NOT NULL
          AND pdf_stored_at >= 0
        )
      );
  END IF;
END
$$;

COMMENT ON COLUMN legend_commerce.order_notifications.pdf_storage_backend IS
  'Private durable backend for the exact V3 invoice PDF bytes. Locked backend: netlify_blobs.';

COMMENT ON COLUMN legend_commerce.order_notifications.pdf_storage_key IS
  'Deterministic private object key for the SHA-bound V3 invoice PDF artifact; never customer authorization.';

COMMENT ON COLUMN legend_commerce.order_notifications.pdf_stored_at IS
  'Unix timestamp when the exact verified V3 invoice PDF byte artifact was first durably bound.';

COMMENT ON CONSTRAINT order_notifications_v3_pdf_storage_binding_complete
  ON legend_commerce.order_notifications IS
  'Permanent V3 PDF storage binding is entirely absent or complete, private, deterministic and SHA-bound.';

COMMIT;
