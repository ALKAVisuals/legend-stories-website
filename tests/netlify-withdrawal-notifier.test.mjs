import assert from 'node:assert/strict';
import test from 'node:test';

import { createNetlifyWithdrawalHandler } from '../netlify/functions/create-withdrawal.mjs';
import { WITHDRAWAL_DECLARATION } from '../server/withdrawals/statement.mjs';

function request() {
  return new Request('https://legendmural.test/.netlify/functions/create-withdrawal', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Origin: 'https://legendmural.test',
    },
    body: JSON.stringify({
      name: 'Ada Example',
      orderId: '5O190127TN364715T',
      email: 'buyer@example.com',
      confirm: true,
    }),
  });
}

function storeFactory() {
  return {
    async createWithdrawal() {
      return {
        created: true,
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
          deliveryStatus: 'pending',
          deliveryAttempts: 0,
        },
      };
    },
    async recordAcknowledgementDelivery(input) {
      return { confirmationCode: input.confirmationCode, deliveryStatus: input.status };
    },
  };
}

test('Netlify withdrawal handler wires Resend only when both production values are configured', async () => {
  let notifierConfig;
  let delivered;
  const handler = createNetlifyWithdrawalHandler({
    env: {
      NEON_DATABASE_URL: 'postgresql://example.invalid/db',
      CHECKOUT_ALLOWED_ORIGINS: 'https://legendmural.test',
      RESEND_API_KEY: 're_test_key',
      RESEND_FROM: 'LegendMural <orders@example.com>',
      RESEND_REPLY_TO: 'support@example.com',
    },
    storeFactory,
    notifierFactory(config) {
      notifierConfig = config;
      return {
        async sendWithdrawalConfirmation(message) {
          delivered = message;
          return { accepted: true, providerMessageId: 'msg-1' };
        },
      };
    },
    handlerOptions: { now: () => 1786800000 },
  });

  const response = await handler(request());
  assert.equal(response.status, 201);
  assert.deepEqual(notifierConfig, {
    apiKey: 're_test_key',
    from: 'LegendMural <orders@example.com>',
    replyTo: 'support@example.com',
  });
  assert.equal(delivered.data.consumerName, 'Ada Example');
  assert.equal(delivered.data.declaration, WITHDRAWAL_DECLARATION);
  const body = await response.json();
  assert.equal(body.confirmationDelivery, 'sent');
});

test('Netlify withdrawal handler does not require a Reply-To value', async () => {
  let notifierConfig;
  const handler = createNetlifyWithdrawalHandler({
    env: {
      NEON_DATABASE_URL: 'postgresql://example.invalid/db',
      CHECKOUT_ALLOWED_ORIGINS: 'https://legendmural.test',
      RESEND_API_KEY: 're_test_key',
      RESEND_FROM: 'LegendMural <orders@example.com>',
    },
    storeFactory,
    notifierFactory(config) {
      notifierConfig = config;
      return {
        async sendWithdrawalConfirmation() {
          return { accepted: true, providerMessageId: 'msg-no-reply' };
        },
      };
    },
    handlerOptions: { now: () => 1786800000 },
  });

  const response = await handler(request());
  assert.equal(response.status, 201);
  assert.deepEqual(notifierConfig, {
    apiKey: 're_test_key',
    from: 'LegendMural <orders@example.com>',
  });
});

test('Netlify withdrawal handler keeps registration available but leaves acknowledgement pending without Resend config', async () => {
  let notifierFactoryCalls = 0;
  const handler = createNetlifyWithdrawalHandler({
    env: {
      NEON_DATABASE_URL: 'postgresql://example.invalid/db',
      CHECKOUT_ALLOWED_ORIGINS: 'https://legendmural.test',
    },
    storeFactory,
    notifierFactory() {
      notifierFactoryCalls += 1;
      throw new Error('must not run');
    },
    handlerOptions: { now: () => 1786800000 },
  });

  const response = await handler(request());
  assert.equal(response.status, 201);
  assert.equal(notifierFactoryCalls, 0);
  const body = await response.json();
  assert.equal(body.confirmationDelivery, 'unavailable');
});
