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

const validBody = {
  name: 'Ada Example',
  orderId: '5O190127TN364715T',
  email: 'buyer@example.com',
  confirm: true,
};

function storedWithdrawal() {
  return {
    created: true,
    withdrawal: {
      orderId: '5O190127TN364715T',
      confirmationCode: 'LM-WD-0123456789ABCDEF',
      withdrawnAt: 1786800000,
    },
  };
}

test('withdrawal API records the request and sends the acknowledgement after persistence', async () => {
  const storeCalls = [];
  const notificationCalls = [];
  const withdrawalStore = {
    async createWithdrawal(input) {
      storeCalls.push(input);
      return storedWithdrawal();
    },
  };
  const withdrawalNotifier = {
    async sendWithdrawalConfirmation(message) {
      notificationCalls.push(message);
      return { accepted: true, providerMessageId: 'msg-1' };
    },
  };

  const response = await handleCreateWithdrawal(request(validBody), {
    withdrawalStore,
    withdrawalNotifier,
    allowedOrigins: 'https://legendmural.test',
    now: () => 1786800000,
  });

  assert.equal(response.status, 201);
  assert.deepEqual(storeCalls, [{
    orderId: '5O190127TN364715T',
    email: 'buyer@example.com',
    withdrawnAt: 1786800000,
  }]);
  assert.equal(notificationCalls.length, 1);
  assert.equal(notificationCalls[0].to, 'buyer@example.com');
  assert.equal(notificationCalls[0].data.consumerName, 'Ada Example');
  assert.equal(notificationCalls[0].data.confirmationCode, 'LM-WD-0123456789ABCDEF');

  const body = await response.json();
  assert.equal(body.orderId, '5O190127TN364715T');
  assert.equal(body.confirmationCode, 'LM-WD-0123456789ABCDEF');
  assert.equal(body.withdrawnAt, 1786800000);
  assert.equal(body.withdrawnAtIso, new Date(1786800000 * 1000).toISOString());
  assert.equal(body.alreadyReceived, false);
  assert.equal(body.confirmationDelivery, 'sent');
  assert.equal(body.email, undefined);
  assert.equal(body.name, undefined);
});

test('withdrawal API requires consumer name before storing the request', async () => {
  let called = false;
  const response = await handleCreateWithdrawal(request({ ...validBody, name: '' }), {
    withdrawalStore: { async createWithdrawal() { called = true; } },
    allowedOrigins: 'https://legendmural.test',
  });

  assert.equal(response.status, 400);
  assert.equal(called, false);
  const body = await response.json();
  assert.equal(body.error.code, 'INVALID_WITHDRAWAL_NAME');
});

test('withdrawal API requires explicit final confirmation', async () => {
  let called = false;
  const response = await handleCreateWithdrawal(request({ ...validBody, confirm: false }), {
    withdrawalStore: { async createWithdrawal() { called = true; } },
    allowedOrigins: 'https://legendmural.test',
  });

  assert.equal(response.status, 400);
  assert.equal(called, false);
  const body = await response.json();
  assert.equal(body.error.code, 'WITHDRAWAL_CONFIRMATION_REQUIRED');
});

test('withdrawal registration remains valid when acknowledgement delivery fails', async () => {
  let stored = 0;
  const response = await handleCreateWithdrawal(request(validBody), {
    withdrawalStore: {
      async createWithdrawal() {
        stored += 1;
        return storedWithdrawal();
      },
    },
    withdrawalNotifier: {
      async sendWithdrawalConfirmation() {
        throw new Error('provider unavailable');
      },
    },
    allowedOrigins: 'https://legendmural.test',
    now: () => 1786800000,
  });

  assert.equal(stored, 1);
  assert.equal(response.status, 201);
  const body = await response.json();
  assert.equal(body.confirmationDelivery, 'failed');
  assert.equal(body.confirmationCode, 'LM-WD-0123456789ABCDEF');
});

test('withdrawal API reports unavailable delivery when no notifier is configured', async () => {
  const response = await handleCreateWithdrawal(request(validBody), {
    withdrawalStore: { async createWithdrawal() { return storedWithdrawal(); } },
    allowedOrigins: 'https://legendmural.test',
    now: () => 1786800000,
  });

  assert.equal(response.status, 201);
  const body = await response.json();
  assert.equal(body.confirmationDelivery, 'unavailable');
});

test('withdrawal API does not disclose order data when lookup does not match', async () => {
  const response = await handleCreateWithdrawal(request({ ...validBody, email: 'wrong@example.com' }), {
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
  const response = await handleCreateWithdrawal(request(validBody, 'https://attacker.example'), {
    withdrawalStore: { async createWithdrawal() { throw new Error('must not run'); } },
    allowedOrigins: 'https://legendmural.test',
  });

  assert.equal(response.status, 403);
});
