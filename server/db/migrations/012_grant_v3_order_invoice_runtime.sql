GRANT SELECT, INSERT
  ON TABLE legend_commerce.invoices
  TO __LEGEND_RUNTIME_ROLE__;

GRANT SELECT, INSERT
  ON TABLE legend_commerce.document_number_series
  TO __LEGEND_RUNTIME_ROLE__;

GRANT UPDATE (
  next_value,
  updated_at
)
  ON TABLE legend_commerce.document_number_series
  TO __LEGEND_RUNTIME_ROLE__;

GRANT USAGE
  ON SEQUENCE legend_commerce.invoices_id_seq
  TO __LEGEND_RUNTIME_ROLE__;
