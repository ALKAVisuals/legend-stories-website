import assert from 'node:assert/strict';
import test from 'node:test';

import { createNeonWithdrawalStore } from '../server/adapters/neon-withdrawal-store.mjs';
import { WITHDRAWAL_DECLARATION } from '../server/withdrawals/statement.mjs';

const reference = 'a'.repeat(64);
const orderId = '5O190127TN364715T';
const confirmationCode = 'LM-WD-0123456789ABCDEF';
const withdrawnAt = 1786800000;

function acknowledgementRow(overrides = {}) {
  return {
    order_reference: reference,
    payment_session_id: orderId,
    confirmation_code: confirmationCode,
    consumer_name: 'Ada Example',
    confirmation_email: 'buyer@example.com',
    declaration: WITHDRAWAL_DECLARATION,
    withdrawn_at: withdrawnAt,
    delivery_status: 'pending',
    delivery_attempts: 0,
    last_attempt_at: null,
    sent_at: null,
    provider_message_id: null,
    last_error_code: null,
    created_at: withdrawnAt,
    updated_at: withdrawnAt,
    ...overrides,
  };
}

function clientFactory({ existingWithdrawal = false } = {}) {
  const queries = [];
  const client = {
    async connect() {},
    async end() {},
    async query(sql, values = []) {
      const text = String(sql);
      queries.push({ text, values });
      if (text === 'BEGIN' || text === 'COMMIT' || text === 'ROLLBACK') return { rows: [] };
      if (text.includes('FROM legend_commerce.orders')) {
        return { rows: [{ reference, payment_session_id: orderId, customer: { email: 'buyer@example.com' } }] };
      }
      if (text.includes('INSERT INTO legend_commerce.withdrawal_requests')) {
        return existingWithdrawal
          ? { rows: [] }
          : { rows: [{ order_reference: reference, payment_session_id: orderId, confirmation_code: confirmationCode, withdrawn_at: withdrawnAt }] };
      }
      if (text.includes('FROM legend_commerce.withdrawal_requests')) {
        return { rows: [{ order_reference: reference, payment_session_id: orderId, confirmation_code: confirmationCode, withdrawn_at: withdrawnAt }] };
      }
      if (text.includes('INSERT INTO legend_commerce.withdrawal_acknowledgements')) {
        return { rows: [acknowledgementRow()] };
      }
      if (text.includes('UPDATE legend_commerce.withdrawal_acknowledgements')) {
        return { rows: [acknowledgementRow({
          delivery_status: values[1],
          delivery_attempts: 1,
          last_attempt_at: values[2],
          sent_at: values[1] === 'sent' ? values[2] : null,
          provider_message_id: values[3],
          last_error_code: values[4],
          updated_at: values[2],
        })] };
      }
      if (text.includes('FROM legend_commerce.withdrawal_acknowledgements')) {
        return { rows: [acknowledgementRow()] };
      }
      throw new Error(`Unexpected query: ${text}`);
    },
  };
  return { client, queries };
}

const connectionString = 'postgresql://runtime:secret@ep-test.neon.tech/neondb?sslmode=require';

test('creates withdrawal and acknowledgement snapshot in one transaction', async () => {
  const fake = clientFactory();
  const store = createNeonWithdrawalStore({
    connectionString,
    clientFactory: async () => fake.client,
  });

  const result = await store.createWithdrawal({
    orderId,
    email: 'Buyer@Example.com',
    consumerName: 'Ada Example',
    withdrawnAt,
  });

  assert.equal(result.created, true);
  assert.equal(result.withdrawal.confirmationCode, confirmationCode);
  assert.equal(result.acknowledgement.consumerName, 'Ada Example');
  assert.equal(result.acknowledgement.confirmationEmail, 'buyer@example.com');
  assert.equal(result.acknowledgement.declaration, WITHDRAWAL_DECLARATION);
  assert.equal(result.acknowledgement.deliveryStatus, 'pending');
  assert.equal(fake.queries[0].text, 'BEGIN');
  assert.equal(fake.queries.at(-1).text, 'COMMIT');
});

test('backfills a missing acknowledgement snapshot for an existing withdrawal without replacing the original timestamp', async () => {
  const fake = clientFactory({ existingWithdrawal: true });
  const store = createNeonWithdrawalStore({
    connectionString,
    clientFactory: async () => fake.client,
  });

  const result = await store.createWithdrawal({
    orderId,
    email: 'buyer@example.com',
    consumerName: 'Ada Example',
    withdrawnAt: withdrawnAt + 500,
  });

  assert.equal(result.created, false);
  assert.equal(result.withdrawal.withdrawnAt, withdrawnAt);
  const ackInsert = fake.queries.find((query) => query.text.includes('INSERT INTO legend_commerce.withdrawal_acknowledgements'));
  assert.equal(ackInsert.values[6], withdrawnAt);
});

test('records only acknowledgement delivery metadata after provider acceptance', async () => {
  const fake = clientFactory();
  const store = createNeonWithdrawalStore({
    connectionString,
    clientFactory: async () => fake.client,
  });

  const result = await store.recordAcknowledgementDelivery({
    confirmationCode,
    status: 'sent',
    attemptedAt: withdrawnAt + 10,
    providerMessageId: 'resend-123',
  });

  assert.equal(result.deliveryStatus, 'sent');
  assert.equal(result.deliveryAttempts, 1);
  assert.equal(result.sentAt, withdrawnAt + 10);
  assert.equal(result.providerMessageId, 'resend-123');
});

test('loads an acknowledgement by confirmation code for controlled retry', async () => {
  const fake = clientFactory();
  const store = createNeonWithdrawalStore({
    connectionString,
    clientFactory: async () => fake.client,
  });

  const result = await store.getAcknowledgementByConfirmationCode(confirmationCode);
  assert.equal(result.confirmationCode, confirmationCode);
  assert.equal(result.confirmationEmail, 'buyer@example.com');
  assert.equal(result.declaration, WITHDRAWAL_DECLARATION);
});
