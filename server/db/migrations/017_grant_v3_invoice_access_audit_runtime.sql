BEGIN;

GRANT INSERT
  ON TABLE legend_commerce.invoice_access_audit
  TO __LEGEND_RUNTIME_ROLE__;

COMMIT;
