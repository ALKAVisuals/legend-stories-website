import test from 'node:test';
import assert from 'node:assert/strict';

import {
  OrderStatusClientError,
  isOrderStatusConfigured,
  normalizeOrderStatusEndpoint,
  requestVerifiedOrderStatus,
} from '../js/commerce/order-status-client.mjs';

const reference = 'a'.repeat(64);
const sessionId = 'cs_test_status_client';

function validStatus(overrides = {}) {
  return {
    reference,
    sessionId,
    mode: 'test',
    status: 'paid',
    paid: true,
    terminal: true,
    updatedAt: 1_800_000_000,
    version: 2,
    ...overrides,
  };
}

test('order status verification remains disabled without an endpoint', () => {
  assert.equal(normalizeOrderStatusEndpoint('', 'https://shop.example'), '');
  assert.equal(isOrderStatusConfigured('', 'https://shop.example'), false);
});

test('status endpoint requires HTTPS outside local development', () => {
  assert.equal(
    normalizeOrderStatusEndpoint('/api/order-status', 'https://shop.example'),
    'https://shop.example/api/order-status',
  );
  assert.equal(
    normalizeOrderStatusEndpoint('http://localhost:8888/api/order-status'),
    'http://localhost:8888/api/order-status',
  );
  assert.throws(
    () => normalizeOrderStatusEndpoint('http://payments.example/api/order-status'),
    (error) => error instanceof OrderStatusClientError
      && error.code === 'INVALID_ORDER_STATUS_ENDPOINT',
  );
});

test('browser sends only the reference and Checkout Session ID', async () => {
  const capture = {};
  const status = await requestVerifiedOrderStatus({
    endpoint: '/api/order-status',
    baseUrl: 'https://shop.example',
    reference,
    sessionId,
    fetchImpl: async (url, options) => {
      capture.url = url;
      capture.options = options;
      return new Response(JSON.stringify(validStatus()), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    },
  });

  assert.equal(capture.url, 'https://shop.example/api/order-status');
  assert.equal(capture.options.method, 'POST');
  assert.equal(capture.options.credentials, 'omit');
  assert.equal(capture.options.redirect, 'error');
  assert.deepEqual(JSON.parse(capture.options.body), { reference, sessionId });
  assert.equal(status.status, 'paid');
  assert.equal(status.paid, true);
});

test('browser rejects responses for another order, session or mode', async () => {
  for (const responseBody of [
    validStatus({ reference: 'b'.repeat(64) }),
    validStatus({ sessionId: 'cs_test_other' }),
    validStatus({ mode: 'live' }),
  ]) {
    await assert.rejects(
      () => requestVerifiedOrderStatus({
        endpoint: 'https://payments.example/api/order-status',
        reference,
        sessionId,
        fetchImpl: async () => new Response(JSON.stringify(responseBody), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      }),
      (error) => error instanceof OrderStatusClientError
        && error.code === 'INVALID_ORDER_STATUS_RESPONSE',
    );
  }
});

test('browser rejects inconsistent paid and terminal flags', async () => {
  for (const responseBody of [
    validStatus({ paid: false }),
    validStatus({ status: 'payment_processing', paid: false, terminal: true }),
  ]) {
    await assert.rejects(
      () => requestVerifiedOrderStatus({
        endpoint: 'https://payments.example/api/order-status',
        reference,
        sessionId,
        fetchImpl: async () => new Response(JSON.stringify(responseBody), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      }),
      (error) => error instanceof OrderStatusClientError
        && error.code === 'INVALID_ORDER_STATUS_RESPONSE',
    );
  }
});

test('browser rejects invalid lookup identifiers before network access', async () => {
  let called = false;
  await assert.rejects(
    () => requestVerifiedOrderStatus({
      endpoint: 'https://payments.example/api/order-status',
      reference: 'wrong',
      sessionId,
      fetchImpl: async () => {
        called = true;
      },
    }),
    (error) => error instanceof OrderStatusClientError
      && error.code === 'INVALID_ORDER_LOOKUP',
  );
  assert.equal(called, false);
});
