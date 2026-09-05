export const PRIVILEGE_PROOF_CAPABILITY_ROLE = 'legendmural_ci_runtime_contract';
export const PRIVILEGE_PROOF_LOGIN_ROLE = 'legendmural_ci_app';

export const TABLE_PRIVILEGES = Object.freeze([
  'SELECT',
  'INSERT',
  'UPDATE',
  'DELETE',
  'TRUNCATE',
  'REFERENCES',
  'TRIGGER',
]);

export const EXPECTED_TABLE_PRIVILEGES = Object.freeze({
  orders: Object.freeze(['SELECT', 'INSERT', 'UPDATE']),
  stripe_events: Object.freeze(['SELECT', 'INSERT']),
  paypal_webhook_events: Object.freeze(['SELECT', 'INSERT']),
  withdrawal_requests: Object.freeze(['SELECT', 'INSERT']),
  withdrawal_acknowledgements: Object.freeze(['SELECT', 'INSERT']),
  order_notifications: Object.freeze(['SELECT', 'INSERT', 'UPDATE']),
  invoices: Object.freeze(['SELECT', 'INSERT']),
  document_number_series: Object.freeze(['SELECT', 'INSERT']),
});

export const EXPECTED_UPDATE_COLUMNS = Object.freeze({
  withdrawal_acknowledgements: Object.freeze([
    'delivery_status',
    'delivery_attempts',
    'last_attempt_at',
    'sent_at',
    'provider_message_id',
    'last_error_code',
    'updated_at',
  ]),
  document_number_series: Object.freeze(['next_value', 'updated_at']),
});

export const EXPECTED_SEQUENCE_PRIVILEGES = Object.freeze({
  'invoices_id_seq': Object.freeze(['USAGE']),
});
