import test from 'node:test';
import assert from 'node:assert/strict';

import { handleOrderStatus } from '../server/api/order-status.mjs';

const reference = 'f'.repeat(64);
const sessionId = 'cs_test_order_status_lookup';
const storedOrder = Object.freeze({
  reference,
  paymentSessionId: sessionId,
  mode: 'test',
  status: 'paid',
  updatedAt: 1_800_000_000,
  version: 2,
  amountTotal: 5390,
  currency: 'EUR',
  customer: {
    email: 'private@example.com',
    street: 'Private Street 10',
  },
  items: [{ name: 'Private Product', unitPrice: 49.95 }],
});

function requestFor(body = { reference, sessionId }, {
  method = 'POST',
  origin = 'https://shop.example',
  contentType = 'application/json',
} = {}) {
  return new Request('https://payments.example/api/order-status', {
    method,
    headers: {
      ...(origin ? { Origin: origin } : {}),
      ...(contentType ? { 'Content-Type': contentType } : {}),
    },
    ...(method === 'POST' ? { body: JSON.stringify(body) } : {}),
  });
}

function orderStore(order = storedOrder) {
  return {
    async getOrderByReference(requestedReference) {
      return requestedReference === reference ? order : null;
    },
  };
}

test('returns only the privacy-minimal status for the exact reference and session pair', async () => {
  const response = await handleOrderStatus(requestFor(), {
    orderStore: orderStore(),
    allowedOrigins: 'https://shop.example',
  });
  const result = await response.json();

  assert.equal(response.status, 200);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.equal(response.headers.get('access-control-allow-origin'), 'https://shop.example');
  assert.deepEqual(Object.keys(result).sort(), [
    'mode',
    'paid',
    'reference',
    'sessionId',
    'status',
    'terminal',
    'updatedAt',
    'version',
  ]);
  assert.equal(result.reference, reference);
  assert.equal(result.sessionId, sessionId);
  assert.equal(result.status, 'paid');
  assert.equal(result.paid, true);
  assert.equal(JSON.stringify(result).includes('private@example.com'), false);
  assert.equal(JSON.stringify(result).includes('5390'), false);
});

test('wrong session identity returns the same not-found response as an unknown order', async () => {
  for (const body of [
    { reference, sessionId: 'cs_test_wrong_session' },
    { reference: 'a'.repeat(64), sessionId },
  ]) {
    const response = await handleOrderStatus(requestFor(body), {
      orderStore: orderStore(),
      allowedOrigins: 'https://shop.example',
    });
    const result = await response.json();
    assert.equal(response.status, 404);
    assert.equal(result.error.code, 'ORDER_NOT_FOUND');
  }
});

test('fails closed when order storage is missing', async () => {
  const response = await handleOrderStatus(requestFor(), {
    allowedOrigins: 'https://shop.example',
  });
  const result = await response.json();

  assert.equal(response.status, 503);
  assert.equal(result.error.code, 'ORDER_STORE_NOT_CONFIGURED');
});

test('rejects corrupt stored status metadata as a server error', async () => {
  const response = await handleOrderStatus(requestFor(), {
    orderStore: orderStore({ ...storedOrder, status: 'invented' }),
    allowedOrigins: 'https://shop.example',
  });
  const result = await response.json();

  assert.equal(response.status, 500);
  assert.equal(result.error.code, 'INVALID_ORDER_STORE_RESULT');
  assert.equal(JSON.stringify(result).includes('invented'), false);
});

test('rejects unapproved origins, unsupported methods and content types', async () => {
  const originResponse = await handleOrderStatus(requestFor(undefined, {
    origin: 'https://attacker.example',
  }), {
    orderStore: orderStore(),
    allowedOrigins: 'https://shop.example',
  });
  assert.equal(originResponse.status, 403);

  const methodResponse = await handleOrderStatus(requestFor(undefined, {
    method: 'GET',
  }), {
    orderStore: orderStore(),
    allowedOrigins: 'https://shop.example',
  });
  assert.equal(methodResponse.status, 405);

  const contentResponse = await handleOrderStatus(requestFor(undefined, {
    contentType: 'text/plain',
  }), {
    orderStore: orderStore(),
    allowedOrigins: 'https://shop.example',
  });
  const contentResult = await contentResponse.json();
  assert.equal(contentResponse.status, 400);
  assert.equal(contentResult.error.code, 'UNSUPPORTED_CONTENT_TYPE');
});
