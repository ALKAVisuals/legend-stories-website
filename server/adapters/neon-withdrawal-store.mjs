import { createHash } from 'node:crypto';

import {
  createDefaultNeonClient,
  validateNeonConnectionString,
} from './neon-order-store.mjs';
import { WITHDRAWAL_DECLARATION } from '../withdrawals/statement.mjs';

const PAYPAL_ORDER_ID_PATTERN = /^[A-Z0-9]{1,36}$/;
const REFERENCE_PATTERN = /^[a-f0-9]{64}$/;
const CONFIRMATION_CODE_PATTERN = /^LM-WD-[A-F0-9]{16}$/;
const DELIVERY_STATUSES = new Set(['pending', 'sent', 'failed']);

export class NeonWithdrawalStoreError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = 'NeonWithdrawalStoreError';
    this.code = code;
    this.details = details;
  }
}

function fail(code, message, details = {}) {
  throw new NeonWithdrawalStoreError(code, message, details);
}

function validateClient(client) {
  for (const method of ['connect', 'query', 'end']) {
    if (typeof client?.[method] !== 'function') {
      fail('INVALID_NEON_CLIENT', `Neon client is missing ${method}().`, { method });
    }
  }
  return client;
}

async function closeClient(client) {
  try {
    await client.end();
  } catch {
    // Preserve the original operation result/error.
  }
}

function normalizeDatabaseError(error) {
  if (error instanceof NeonWithdrawalStoreError) return error;
  if (error?.code === '23505') {
    return new NeonWithdrawalStoreError(
      'WITHDRAWAL_STORE_CONFLICT',
      'A withdrawal or acknowledgement record already conflicts with this order.',
      { constraint: error.constraint || '' },
    );
  }
  return new NeonWithdrawalStoreError(
    'WITHDRAWAL_STORE_UNAVAILABLE',
    'The withdrawal store is unavailable.',
    { sqlState: error?.code || '' },
  );
}

async function withClient(clientFactory, connectionString, action) {
  const client = validateClient(await clientFactory(connectionString));
  try {
    await client.connect();
    return await action(client);
  } catch (error) {
    throw normalizeDatabaseError(error);
  } finally {
    await closeClient(client);
  }
}

function normalizeOrderId(value) {
  const orderId = String(value || '').trim().toUpperCase();
  if (!PAYPAL_ORDER_ID_PATTERN.test(orderId)) {
    fail('INVALID_WITHDRAWAL_LOOKUP', 'Order ID is invalid.');
  }
  return orderId;
}

function normalizeEmail(value) {
  const email = String(value || '').trim().toLowerCase();
  if (!email || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    fail('INVALID_WITHDRAWAL_LOOKUP', 'Email address is invalid.');
  }
  return email;
}

function normalizeConsumerName(value) {
  const name = String(value || '').trim();
  if (!name || name.length > 200 || /[\u0000-\u001F\u007F]/.test(name)) {
    fail('INVALID_WITHDRAWAL_NAME', 'Consumer name is invalid.');
  }
  return name;
}

function normalizeConfirmationCode(value) {
  const code = String(value || '').trim().toUpperCase();
  if (!CONFIRMATION_CODE_PATTERN.test(code)) {
    fail('INVALID_WITHDRAWAL_CONFIRMATION_CODE', 'Withdrawal confirmation code is invalid.');
  }
  return code;
}

function normalizeOptionalText(value, field, maxLength = 200) {
  if (value === null || value === undefined || value === '') return null;
  const normalized = String(value).trim();
  if (!normalized || normalized.length > maxLength || /[\u0000-\u001F\u007F]/.test(normalized)) {
    fail('INVALID_WITHDRAWAL_DELIVERY_METADATA', `${field} is invalid.`, { field });
  }
  return normalized;
}

function confirmationCode(reference, withdrawnAt) {
  const digest = createHash('sha256')
    .update(`${reference}:${withdrawnAt}`)
    .digest('hex')
    .slice(0, 16)
    .toUpperCase();
  return `LM-WD-${digest}`;
}

function rowToWithdrawal(row) {
  if (!row) return null;
  const reference = String(row.order_reference || '').toLowerCase();
  const paymentSessionId = String(row.payment_session_id || '');
  const confirmation = String(row.confirmation_code || '');
  const withdrawnAt = Number(row.withdrawn_at);
  if (!REFERENCE_PATTERN.test(reference)
    || !PAYPAL_ORDER_ID_PATTERN.test(paymentSessionId)
    || !CONFIRMATION_CODE_PATTERN.test(confirmation)
    || !Number.isInteger(withdrawnAt) || withdrawnAt < 0) {
    fail('INVALID_WITHDRAWAL_STORE_RESULT', 'Stored withdrawal record is invalid.');
  }
  return Object.freeze({
    reference,
    orderId: paymentSessionId,
    confirmationCode: confirmation,
    withdrawnAt,
  });
}

function rowToAcknowledgement(row) {
  if (!row) return null;
  const reference = String(row.order_reference || '').toLowerCase();
  const orderId = String(row.payment_session_id || '');
  const code = String(row.confirmation_code || '');
  const consumerName = String(row.consumer_name || '').trim();
  const confirmationEmail = String(row.confirmation_email || '').trim().toLowerCase();
  const declaration = String(row.declaration || '').trim();
  const deliveryStatus = String(row.delivery_status || '');
  const deliveryAttempts = Number(row.delivery_attempts);
  const withdrawnAt = Number(row.withdrawn_at);
  const lastAttemptAt = row.last_attempt_at === null ? null : Number(row.last_attempt_at);
  const sentAt = row.sent_at === null ? null : Number(row.sent_at);

  if (!REFERENCE_PATTERN.test(reference)
    || !PAYPAL_ORDER_ID_PATTERN.test(orderId)
    || !CONFIRMATION_CODE_PATTERN.test(code)
    || !consumerName || consumerName.length > 200
    || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(confirmationEmail)
    || !declaration || declaration.length > 500
    || !DELIVERY_STATUSES.has(deliveryStatus)
    || !Number.isInteger(deliveryAttempts) || deliveryAttempts < 0
    || !Number.isInteger(withdrawnAt) || withdrawnAt < 0
    || (lastAttemptAt !== null && (!Number.isInteger(lastAttemptAt) || lastAttemptAt < 0))
    || (sentAt !== null && (!Number.isInteger(sentAt) || sentAt < 0))) {
    fail('INVALID_WITHDRAWAL_STORE_RESULT', 'Stored withdrawal acknowledgement is invalid.');
  }

  return Object.freeze({
    reference,
    orderId,
    confirmationCode: code,
    consumerName,
    confirmationEmail,
    declaration,
    withdrawnAt,
    deliveryStatus,
    deliveryAttempts,
    lastAttemptAt,
    sentAt,
    providerMessageId: row.provider_message_id ? String(row.provider_message_id) : null,
    lastErrorCode: row.last_error_code ? String(row.last_error_code) : null,
  });
}

const ACKNOWLEDGEMENT_COLUMNS = `
  order_reference, payment_session_id, confirmation_code,
  consumer_name, confirmation_email, declaration, withdrawn_at,
  delivery_status, delivery_attempts, last_attempt_at, sent_at,
  provider_message_id, last_error_code, created_at, updated_at
`;

const SELECT_ORDER_FOR_WITHDRAWAL = `
  SELECT reference, payment_session_id, customer
  FROM legend_commerce.orders
  WHERE payment_session_id = $1
`;

const SELECT_WITHDRAWAL = `
  SELECT order_reference, payment_session_id, confirmation_code, withdrawn_at
  FROM legend_commerce.withdrawal_requests
  WHERE order_reference = $1
`;

const INSERT_WITHDRAWAL = `
  INSERT INTO legend_commerce.withdrawal_requests (
    order_reference,
    payment_session_id,
    confirmation_code,
    withdrawn_at,
    created_at
  ) VALUES ($1, $2, $3, $4, $4)
  ON CONFLICT (order_reference) DO NOTHING
  RETURNING order_reference, payment_session_id, confirmation_code, withdrawn_at
`;

const INSERT_ACKNOWLEDGEMENT = `
  INSERT INTO legend_commerce.withdrawal_acknowledgements (
    order_reference,
    payment_session_id,
    confirmation_code,
    consumer_name,
    confirmation_email,
    declaration,
    withdrawn_at,
    delivery_status,
    delivery_attempts,
    created_at,
    updated_at
  ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'pending', 0, $7, $7)
  ON CONFLICT (order_reference) DO NOTHING
  RETURNING ${ACKNOWLEDGEMENT_COLUMNS}
`;

const SELECT_ACKNOWLEDGEMENT_BY_REFERENCE = `
  SELECT ${ACKNOWLEDGEMENT_COLUMNS}
  FROM legend_commerce.withdrawal_acknowledgements
  WHERE order_reference = $1
`;

const SELECT_ACKNOWLEDGEMENT_BY_CODE = `
  SELECT ${ACKNOWLEDGEMENT_COLUMNS}
  FROM legend_commerce.withdrawal_acknowledgements
  WHERE confirmation_code = $1
`;

const UPDATE_ACKNOWLEDGEMENT_DELIVERY = `
  UPDATE legend_commerce.withdrawal_acknowledgements
  SET
    delivery_status = $2,
    delivery_attempts = delivery_attempts + 1,
    last_attempt_at = $3,
    sent_at = CASE WHEN $2 = 'sent' THEN COALESCE(sent_at, $3) ELSE sent_at END,
    provider_message_id = CASE WHEN $2 = 'sent' THEN $4 ELSE provider_message_id END,
    last_error_code = $5,
    updated_at = $3
  WHERE confirmation_code = $1
  RETURNING ${ACKNOWLEDGEMENT_COLUMNS}
`;

export function createNeonWithdrawalStore({
  connectionString = process.env.DATABASE_URL,
  clientFactory = createDefaultNeonClient,
} = {}) {
  const databaseUrl = validateNeonConnectionString(connectionString);
  if (typeof clientFactory !== 'function') {
    fail('INVALID_NEON_CLIENT_FACTORY', 'A Neon client factory is required.');
  }

  return Object.freeze({
    async createWithdrawal({
      orderId: orderIdInput,
      email: emailInput,
      consumerName: consumerNameInput,
      withdrawnAt,
    }) {
      const orderId = normalizeOrderId(orderIdInput);
      const email = normalizeEmail(emailInput);
      const consumerName = normalizeConsumerName(consumerNameInput);
      const timestamp = Number(withdrawnAt);
      if (!Number.isInteger(timestamp) || timestamp < 0) {
        fail('INVALID_WITHDRAWAL_TIMESTAMP', 'Withdrawal timestamp is invalid.');
      }

      const client = validateClient(await clientFactory(databaseUrl));
      let transactionStarted = false;
      try {
        await client.connect();
        await client.query('BEGIN');
        transactionStarted = true;

        const orderResult = await client.query(SELECT_ORDER_FOR_WITHDRAWAL, [orderId]);
        const order = orderResult.rows?.[0];
        const storedEmail = String(order?.customer?.email || '').trim().toLowerCase();
        if (!order || storedEmail !== email) {
          fail('WITHDRAWAL_ORDER_NOT_FOUND', 'No matching order was found.');
        }

        const reference = String(order.reference || '').toLowerCase();
        if (!REFERENCE_PATTERN.test(reference)) {
          fail('INVALID_WITHDRAWAL_STORE_RESULT', 'Stored order reference is invalid.');
        }

        const proposedCode = confirmationCode(reference, timestamp);
        const inserted = await client.query(INSERT_WITHDRAWAL, [
          reference,
          orderId,
          proposedCode,
          timestamp,
        ]);

        const created = inserted.rows?.length === 1;
        let withdrawal = rowToWithdrawal(inserted.rows?.[0]);
        if (!withdrawal) {
          const existing = await client.query(SELECT_WITHDRAWAL, [reference]);
          withdrawal = rowToWithdrawal(existing.rows?.[0]);
        }
        if (!withdrawal || withdrawal.orderId !== orderId) {
          fail('WITHDRAWAL_STORE_CONFLICT', 'Existing withdrawal record conflicts with this order.');
        }

        const acknowledgementInsert = await client.query(INSERT_ACKNOWLEDGEMENT, [
          reference,
          orderId,
          withdrawal.confirmationCode,
          consumerName,
          email,
          WITHDRAWAL_DECLARATION,
          withdrawal.withdrawnAt,
        ]);
        let acknowledgement = rowToAcknowledgement(acknowledgementInsert.rows?.[0]);
        if (!acknowledgement) {
          const existingAck = await client.query(SELECT_ACKNOWLEDGEMENT_BY_REFERENCE, [reference]);
          acknowledgement = rowToAcknowledgement(existingAck.rows?.[0]);
        }
        if (!acknowledgement
          || acknowledgement.orderId !== orderId
          || acknowledgement.confirmationCode !== withdrawal.confirmationCode
          || acknowledgement.confirmationEmail !== email) {
          fail('WITHDRAWAL_STORE_CONFLICT', 'Existing acknowledgement record conflicts with this withdrawal.');
        }

        await client.query('COMMIT');
        transactionStarted = false;
        return Object.freeze({ created, withdrawal, acknowledgement });
      } catch (error) {
        if (transactionStarted) {
          try {
            await client.query('ROLLBACK');
          } catch {
            // Preserve the original transaction failure.
          }
        }
        throw normalizeDatabaseError(error);
      } finally {
        await closeClient(client);
      }
    },

    async getAcknowledgementByConfirmationCode(confirmationCodeInput) {
      const code = normalizeConfirmationCode(confirmationCodeInput);
      return withClient(clientFactory, databaseUrl, async (client) => {
        const result = await client.query(SELECT_ACKNOWLEDGEMENT_BY_CODE, [code]);
        return rowToAcknowledgement(result.rows?.[0]);
      });
    },

    async recordAcknowledgementDelivery({
      confirmationCode: confirmationCodeInput,
      status,
      attemptedAt,
      providerMessageId = null,
      errorCode = null,
    }) {
      const code = normalizeConfirmationCode(confirmationCodeInput);
      const normalizedStatus = String(status || '').trim().toLowerCase();
      if (!['sent', 'failed'].includes(normalizedStatus)) {
        fail('INVALID_WITHDRAWAL_DELIVERY_STATUS', 'Acknowledgement delivery status is invalid.');
      }
      const timestamp = Number(attemptedAt);
      if (!Number.isInteger(timestamp) || timestamp < 0) {
        fail('INVALID_WITHDRAWAL_TIMESTAMP', 'Acknowledgement attempt timestamp is invalid.');
      }
      const normalizedProviderMessageId = normalizedStatus === 'sent'
        ? normalizeOptionalText(providerMessageId, 'providerMessageId', 200)
        : null;
      const normalizedErrorCode = normalizedStatus === 'failed'
        ? normalizeOptionalText(errorCode || 'UNKNOWN', 'errorCode', 120)
        : null;

      return withClient(clientFactory, databaseUrl, async (client) => {
        const result = await client.query(UPDATE_ACKNOWLEDGEMENT_DELIVERY, [
          code,
          normalizedStatus,
          timestamp,
          normalizedProviderMessageId,
          normalizedErrorCode,
        ]);
        const acknowledgement = rowToAcknowledgement(result.rows?.[0]);
        if (!acknowledgement) {
          fail('WITHDRAWAL_ACKNOWLEDGEMENT_NOT_FOUND', 'Withdrawal acknowledgement was not found.');
        }
        return acknowledgement;
      });
    },
  });
}
