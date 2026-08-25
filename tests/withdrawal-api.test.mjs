import assert from 'node:assert/strict';
import test from 'node:test';

import { handleCreateWithdrawal } from '../server/api/create-withdrawal.mjs';
import { NeonWithdrawalStoreError } from '../server/adapters/neon-withdrawal-store.mjs';
import { WITHDRAWAL_DECLARATION } from '../server/withdrawals/statement.mjs';

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

function storedWithdrawal({ created = true, deliveryStatus = 'pending' } = {}) {
  return {
    created,
    withdrawal: {
      orderId: '5O190127TN364715T',
      confirmationCode: 'LM-WD-0123456789ABCDEF',
      withdrawnAt: 1786800000,
    },
    acknowledgement: {
      orderId: '5O190127TN364715T',
      consumerName: 'Ada Example',
      confirmationEmail: 'buyer@example.com',
      declaration: WITHDRAWAL_DECLARATION,
      confirmationCode: 'LM-WD-0123456789ABCDEF',
      withdrawnAt: 1786800000,
      deliveryStatus,
      deliveryAttempts: deliveryStatus === 'pending' ? 0 : 1,
    },
  };
}

function storeWithDelivery(result = storedWithdrawal()) {
  const storeCalls = [];
  const deliveryCalls = [];
  return {
    storeCalls,
    deliveryCalls,
    store: {
      async createWithdrawal(input) {
        storeCalls.push(input);
        return result;
      },
      async recordAcknowledgementDelivery(input) {
        deliveryCalls.push(input);
        return { ...result.acknowledgement, deliveryStatus: input.status };
      },
    },
  };
}

test('withdrawal API durably snapshots the statement before sending the acknowledgement', async () => {
  const notificationCalls = [];
  const { store, storeCalls, deliveryCalls } = storeWithDelivery();
  const withdrawalNotifier = {
    async sendWithdrawalConfirmation(message) {
      notificationCalls.push(message);
      return { accepted: true, providerMessageId: 'msg-1' };
    },
  };

  const response = await handleCreateWithdrawal(request(validBody), {
    withdrawalStore: store,
    withdrawalNotifier,
    allowedOrigins: 'https://legendmural.test',
    now: () => 1786800000,
  });

  assert.equal(response.status, 201);
  assert.deepEqual(storeCalls, [{
    orderId: '5O190127TN364715T',
    email: 'buyer@example.com',
    consumerName: 'Ada Example',
    withdrawnAt: 1786800000,
  }]);
  assert.equal(notificationCalls.length, 1);
  assert.equal(notificationCalls[0].to, 'buyer@example.com');
  assert.equal(notificationCalls[0].data.consumerName, 'Ada Example');
  assert.equal(notificationCalls[0].data.declaration, WITHDRAWAL_DECLARATION);
  assert.equal(notificationCalls[0].data.confirmationCode, 'LM-WD-0123456789ABCDEF');
  assert.deepEqual(deliveryCalls, [{
    confirmationCode: 'LM-WD-0123456789ABCDEF',
    status: 'sent',
    attemptedAt: 1786800000,
    providerMessageId: 'msg-1',
  }]);

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

test('withdrawal registration remains valid and delivery failure is persisted when email delivery fails', async () => {
  const { store, storeCalls, deliveryCalls } = storeWithDelivery();
  const response = await handleCreateWithdrawal(request(validBody), {
    withdrawalStore: store,
    withdrawalNotifier: {
      async sendWithdrawalConfirmation() {
        const error = new Error('provider unavailable');
        error.code = 'PROVIDER_UNAVAILABLE';
        throw error;
      },
    },
    allowedOrigins: 'https://legendmural.test',
    now: () => 1786800000,
  });

  assert.equal(storeCalls.length, 1);
  assert.equal(response.status, 201);
  assert.deepEqual(deliveryCalls, [{
    confirmationCode: 'LM-WD-0123456789ABCDEF',
    status: 'failed',
    attemptedAt: 1786800000,
    errorCode: 'WITHDRAWAL_NOTIFICATION_FAILED',
  }]);
  const body = await response.json();
  assert.equal(body.confirmationDelivery, 'failed');
  assert.equal(body.confirmationCode, 'LM-WD-0123456789ABCDEF');
});

test('withdrawal API reports unavailable delivery when acknowledgement is pending and no notifier is configured', async () => {
  const { store } = storeWithDelivery(storedWithdrawal({ deliveryStatus: 'pending' }));
  const response = await handleCreateWithdrawal(request(validBody), {
    withdrawalStore: store,
    allowedOrigins: 'https://legendmural.test',
    now: () => 1786800000,
  });

  assert.equal(response.status, 201);
  const body = await response.json();
  assert.equal(body.confirmationDelivery, 'unavailable');
});

test('withdrawal API does not resend an acknowledgement already recorded as sent', async () => {
  let notificationCalls = 0;
  const result = storedWithdrawal({ created: false, deliveryStatus: 'sent' });
  const { store, deliveryCalls } = storeWithDelivery(result);
  const response = await handleCreateWithdrawal(request({ ...validBody, name: 'Changed Name' }), {
    withdrawalStore: store,
    withdrawalNotifier: {
      async sendWithdrawalConfirmation() {
        notificationCalls += 1;
        throw new Error('must not send twice');
      },
    },
    allowedOrigins: 'https://legendmural.test',
    now: () => 1786800100,
  });

  assert.equal(response.status, 200);
  assert.equal(notificationCalls, 0);
  assert.equal(deliveryCalls.length, 0);
  const body = await response.json();
  assert.equal(body.alreadyReceived, true);
  assert.equal(body.confirmationDelivery, 'sent');
});

test('withdrawal API retries a failed acknowledgement using the original durable statement snapshot', async () => {
  const result = storedWithdrawal({ created: false, deliveryStatus: 'failed' });
  result.acknowledgement.consumerName = 'Original Consumer';
  const { store, deliveryCalls } = storeWithDelivery(result);
  let delivered;

  const response = await handleCreateWithdrawal(request({ ...validBody, name: 'Changed Name' }), {
    withdrawalStore: store,
    withdrawalNotifier: {
      async sendWithdrawalConfirmation(message) {
        delivered = message;
        return { accepted: true, providerMessageId: 'retry-msg' };
      },
    },
    allowedOrigins: 'https://legendmural.test',
    now: () => 1786800200,
  });

  assert.equal(response.status, 200);
  assert.equal(delivered.data.consumerName, 'Original Consumer');
  assert.equal(delivered.data.confirmationEmail, 'buyer@example.com');
  assert.equal(delivered.data.declaration, WITHDRAWAL_DECLARATION);
  assert.equal(deliveryCalls[0].status, 'sent');
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
