import { createHash } from 'node:crypto';

import {
  createDefaultNeonClient,
  validateNeonConnectionString,
} from './neon-order-store.mjs';

const PAYPAL_ORDER_ID_PATTERN = /^[A-Z0-9]{1,36}$/;
const REFERENCE_PATTERN = /^[a-f0-9]{64}$/;

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
      'A withdrawal record already exists for this order.',
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
    || !/^LM-WD-[A-F0-9]{16}$/.test(confirmation)
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

export function createNeonWithdrawalStore({
  connectionString = process.env.DATABASE_URL,
  clientFactory = createDefaultNeonClient,
} = {}) {
  const databaseUrl = validateNeonConnectionString(connectionString);
  if (typeof clientFactory !== 'function') {
    fail('INVALID_NEON_CLIENT_FACTORY', 'A Neon client factory is required.');
  }

  return Object.freeze({
    async createWithdrawal({ orderId: orderIdInput, email: emailInput, withdrawnAt }) {
      const orderId = normalizeOrderId(orderIdInput);
      const email = normalizeEmail(emailInput);
      const timestamp = Number(withdrawnAt);
      if (!Number.isInteger(timestamp) || timestamp < 0) {
        fail('INVALID_WITHDRAWAL_TIMESTAMP', 'Withdrawal timestamp is invalid.');
      }

      return withClient(clientFactory, databaseUrl, async (client) => {
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

        const code = confirmationCode(reference, timestamp);
        const inserted = await client.query(INSERT_WITHDRAWAL, [
          reference,
          orderId,
          code,
          timestamp,
        ]);
        if (inserted.rows?.length === 1) {
          return Object.freeze({ created: true, withdrawal: rowToWithdrawal(inserted.rows[0]) });
        }

        const existing = await client.query(SELECT_WITHDRAWAL, [reference]);
        const withdrawal = rowToWithdrawal(existing.rows?.[0]);
        if (!withdrawal || withdrawal.orderId !== orderId) {
          fail('WITHDRAWAL_STORE_CONFLICT', 'Existing withdrawal record conflicts with this order.');
        }
        return Object.freeze({ created: false, withdrawal });
      });
    },
  });
}
