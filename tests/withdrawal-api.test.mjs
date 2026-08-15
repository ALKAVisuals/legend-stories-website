import assert from 'node:assert/strict';
import test from 'node:test';

import { handleCreateWithdrawal } from '../server/api/create-withdrawal.mjs';
import { NeonWithdrawalStoreError } from '../server/adapters/neon-withdrawal-store.mjs';

function request(body, origin = 'https://legendmural.test') {
  return new Request('https://legendmural.test/.netlify/functions/create-withdrawal', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Origin: origin,
    },
    body: JSON.stringify(body),
  });
}

test('withdrawal API records server-timestamped confirmed request', async () => {
  const calls = [];
  const withdrawalStore = {
    async createWithdrawal(input) {
      calls.push(input);
      return {
        created: true,
        withdrawal: {
          orderId: '5O190127TN364715T',
          confirmationCode: 'LM-WD-0123456789ABCDEF',
          withdrawnAt: 1786800000,
        },
      };
    },
  };

  const response = await handleCreateWithdrawal(request({
    orderId: '5O190127TN364715T',
    email: 'buyer@example.com',
    confirm: true,
  }), {
    withdrawalStore,
    allowedOrigins: 'https://legendmural.test',
    now: () => 1786800000,
  });

  assert.equal(response.status, 201);
  assert.deepEqual(calls, [{
    orderId: '5O190127TN364715T',
    email: 'buyer@example.com',
    withdrawnAt: 1786800000,
  }]);
  const body = await response.json();
  assert.equal(body.orderId, '5O190127TN364715T');
  assert.equal(body.confirmationCode, 'LM-WD-0123456789ABCDEF');
  assert.equal(body.withdrawnAt, 1786800000);
  assert.equal(body.withdrawnAtIso, new Date(1786800000 * 1000).toISOString());
  assert.equal(body.alreadyReceived, false);
  assert.equal(body.email, undefined);
});

test('withdrawal API requires explicit final confirmation', async () => {
  let called = false;
  const response = await handleCreateWithdrawal(request({
    orderId: '5O190127TN364715T',
    email: 'buyer@example.com',
    confirm: false,
  }), {
    withdrawalStore: { async createWithdrawal() { called = true; } },
    allowedOrigins: 'https://legendmural.test',
  });

  assert.equal(response.status, 400);
  assert.equal(called, false);
  const body = await response.json();
  assert.equal(body.error.code, 'WITHDRAWAL_CONFIRMATION_REQUIRED');
});

test('withdrawal API does not disclose order data when lookup does not match', async () => {
  const response = await handleCreateWithdrawal(request({
    orderId: '5O190127TN364715T',
    email: 'wrong@example.com',
    confirm: true,
  }), {
    withdrawalStore: {
      async createWithdrawal() {
        throw new NeonWithdrawalStoreError(
          'WITHDRAWAL_ORDER_NOT_FOUND',
          'No matching order was found.',
        );
      },
    },
    allowedOrigins: 'https://legendmural.test',
  });

  assert.equal(response.status, 404);
  const body = await response.json();
  assert.deepEqual(body, {
    error: {
      code: 'WITHDRAWAL_ORDER_NOT_FOUND',
      message: 'No matching order was found.',
    },
  });
});

test('withdrawal API blocks unapproved browser origins', async () => {
  const response = await handleCreateWithdrawal(request({
    orderId: '5O190127TN364715T',
    email: 'buyer@example.com',
    confirm: true,
  }, 'https://attacker.example'), {
    withdrawalStore: { async createWithdrawal() { throw new Error('must not run'); } },
    allowedOrigins: 'https://legendmural.test',
  });

  assert.equal(response.status, 403);
});
