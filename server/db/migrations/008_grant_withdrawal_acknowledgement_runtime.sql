BEGIN;

GRANT SELECT, INSERT ON legend_commerce.withdrawal_acknowledgements
  TO __LEGEND_RUNTIME_ROLE__;

GRANT UPDATE (
  delivery_status,
  delivery_attempts,
  last_attempt_at,
  sent_at,
  provider_message_id,
  last_error_code,
  updated_at
) ON legend_commerce.withdrawal_acknowledgements
  TO __LEGEND_RUNTIME_ROLE__;

COMMIT;
