BEGIN;

ALTER TABLE legend_commerce.order_notifications
  DROP CONSTRAINT IF EXISTS order_notifications_v3_pdf_storage_binding_complete;

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
      AND pdf_storage_backend IN ('netlify_blobs', 'cloudflare_r2')
      AND pdf_storage_key = (
        'v1/invoices/' || invoice_id::text || '/' || pdf_sha256 || '.pdf'
      )
      AND pdf_stored_at IS NOT NULL
      AND pdf_stored_at >= 0
    )
  );

COMMENT ON COLUMN legend_commerce.order_notifications.pdf_storage_backend IS
  'Private durable backend for the exact V3 invoice PDF bytes. Allowed backends: netlify_blobs, cloudflare_r2.';

COMMENT ON CONSTRAINT order_notifications_v3_pdf_storage_binding_complete
  ON legend_commerce.order_notifications IS
  'Permanent V3 PDF storage binding is entirely absent or complete, private, deterministic, SHA-bound and restricted to an approved durable backend.';

COMMIT;
