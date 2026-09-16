BEGIN;

CREATE TABLE IF NOT EXISTS legend_commerce.invoice_access_audit (
  event_id uuid PRIMARY KEY,
  order_reference text NOT NULL,
  invoice_id bigint,
  channel text NOT NULL,
  outcome text NOT NULL,
  reason_code text NOT NULL,
  occurred_at bigint NOT NULL,
  retain_until bigint NOT NULL,

  CONSTRAINT invoice_access_audit_reference_format
    CHECK (order_reference ~ '^[a-f0-9]{64}$'),
  CONSTRAINT invoice_access_audit_invoice_id_positive
    CHECK (invoice_id IS NULL OR invoice_id > 0),
  CONSTRAINT invoice_access_audit_channel_allowed
    CHECK (channel IN ('customer', 'dashboard')),
  CONSTRAINT invoice_access_audit_outcome_allowed
    CHECK (outcome IN ('success', 'denied', 'unavailable', 'error')),
  CONSTRAINT invoice_access_audit_reason_code_safe
    CHECK (reason_code ~ '^[a-z][a-z0-9_]{0,63}$'),
  CONSTRAINT invoice_access_audit_timestamps_nonnegative
    CHECK (occurred_at >= 0 AND retain_until >= 0),
  CONSTRAINT invoice_access_audit_normal_retention_floor
    CHECK (retain_until >= occurred_at + 7776000)
);

CREATE INDEX IF NOT EXISTS invoice_access_audit_retention_idx
  ON legend_commerce.invoice_access_audit (retain_until, occurred_at);

CREATE INDEX IF NOT EXISTS invoice_access_audit_order_idx
  ON legend_commerce.invoice_access_audit (order_reference, occurred_at DESC);

CREATE INDEX IF NOT EXISTS invoice_access_audit_invoice_idx
  ON legend_commerce.invoice_access_audit (invoice_id, occurred_at DESC)
  WHERE invoice_id IS NOT NULL;

COMMENT ON TABLE legend_commerce.invoice_access_audit IS
  'Minimal durable V3 invoice PDF access audit. Normal retention is 90 days; justified security/legal holds may extend retain_until.';

COMMENT ON COLUMN legend_commerce.invoice_access_audit.event_id IS
  'Server-generated opaque UUID for this audit event; not a customer or provider identifier.';

COMMENT ON COLUMN legend_commerce.invoice_access_audit.order_reference IS
  'Trusted internal order reference resolved by the server before audit persistence.';

COMMENT ON COLUMN legend_commerce.invoice_access_audit.invoice_id IS
  'Trusted internal invoice identity when resolved; nullable for denied access before invoice identity resolution.';

COMMENT ON COLUMN legend_commerce.invoice_access_audit.reason_code IS
  'Low-cardinality safe reason class. Never store customer email, session/provider ids, Blob identity, credentials, IP or user-agent here.';

COMMENT ON COLUMN legend_commerce.invoice_access_audit.retain_until IS
  'Earliest normal deletion/anonymization eligibility timestamp; initialized to at least 90 days after occurred_at and extendable only by privileged administration.';

COMMIT;
