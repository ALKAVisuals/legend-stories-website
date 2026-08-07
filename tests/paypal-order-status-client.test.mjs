import test from 'node:test';
import assert from 'node:assert/strict';

import {
  OrderStatusClientError,
  requestVerifiedOrderStatus,
} from '../js/commerce/order-status-client.mjs';

const reference = 'a'.repeat(64);
const orderId = '5O190127TN364715T';

test('browser verifies a PayPal order ID against the stored server order', async () => {
  let sentBody;
  const status = await requestVerifiedOrderStatus({
    endpoint: '/api/order-status',
    baseUrl: 'https://shop.example',
    reference,
    sessionId: orderId,
    fetchImpl: async (_url, options) => {
      sentBody = JSON.parse(options.body);
      return new Response(JSON.stringify({
        reference,
        sessionId: orderId,
        mode: 'test',
        status: 'paid',
        paid: true,
        terminal: true,
        updatedAt: 1_786_104_000,
        version: 1,
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    },
  });

  assert.deepEqual(sentBody, { reference, sessionId: orderId });
  assert.equal(status.mode, 'test');
  assert.equal(status.status, 'paid');
  assert.equal(status.paid, true);
});

test('browser rejects a PayPal status response for another order ID', async () => {
  await assert.rejects(
    () => requestVerifiedOrderStatus({
      endpoint: '/api/order-status',
      baseUrl: 'https://shop.example',
      reference,
      sessionId: orderId,
      fetchImpl: async () => new Response(JSON.stringify({
        reference,
        sessionId: '1AB23456CD789012E',
        mode: 'test',
        status: 'paid',
        paid: true,
        terminal: true,
        updatedAt: 1_786_104_000,
        version: 1,
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    }),
    (error) => error instanceof OrderStatusClientError
      && error.code === 'INVALID_ORDER_STATUS_RESPONSE',
  );
});
