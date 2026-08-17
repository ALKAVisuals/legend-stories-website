import assert from 'node:assert/strict';
import test from 'node:test';

import { createNetlifyWithdrawalHandler } from '../netlify/functions/create-withdrawal.mjs';

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
      };
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
  });
  assert.equal(delivered.data.consumerName, 'Ada Example');
  const body = await response.json();
  assert.equal(body.confirmationDelivery, 'sent');
});

test('Netlify withdrawal handler keeps registration available but marks acknowledgement unavailable without Resend config', async () => {
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
