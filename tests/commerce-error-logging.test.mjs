import assert from 'node:assert/strict';
import test from 'node:test';

import { handleCreatePayPalOrder } from '../server/api/create-paypal-order.mjs';
import { handleCapturePayPalOrder } from '../server/api/capture-paypal-order.mjs';
import { handleOrderStatus } from '../server/api/order-status.mjs';
import { handleCreateWithdrawal } from '../server/api/create-withdrawal.mjs';

function sensitiveError() {
  const error = new Error('NEON_DATABASE_URL=postgresql://user:super-secret@example.invalid/db');
  error.code = 'INJECTED_FAILURE';
  error.details = {
    customerEmail: 'customer@example.com',
    clientSecret: 'paypal-super-secret',
  };
  return error;
}

async function captureConsoleErrors(work) {
  const original = console.error;
  const calls = [];
  console.error = (...args) => calls.push(args);
  try {
    await work();
  } finally {
    console.error = original;
  }
  return calls;
}

function serialized(calls) {
  return JSON.stringify(calls);
}

test('unexpected commerce errors log only sanitized metadata', async () => {
  const calls = await captureConsoleErrors(async () => {
    const checkoutResponse = await handleCreatePayPalOrder(
      new Request('https://legendmural.test/api/paypal/checkout', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: '{}',
      }),
      {
        successUrl: 'https://legendmural.test/order-success.html',
        cancelUrl: 'https://legendmural.test/order-cancelled.html',
        paypalClientFactory() {
          throw sensitiveError();
        },
      },
    );
    assert.equal(checkoutResponse.status, 500);

    const reference = '0'.repeat(64);
    const captureResponse = await handleCapturePayPalOrder(
      new Request('https://legendmural.test/api/paypal/capture', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ reference, orderId: 'SMOKETEST123' }),
      }),
      {
        orderStore: {
          async getOrderByReference() {
            throw sensitiveError();
          },
          async processPaypalCapture() {
            throw new Error('must not run');
          },
        },
      },
    );
    assert.equal(captureResponse.status, 500);

    const statusResponse = await handleOrderStatus(
      new Request('https://legendmural.test/api/order-status', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ reference, sessionId: 'SMOKETEST123' }),
      }),
      {
        orderStore: {
          async getOrderByReference() {
            throw sensitiveError();
          },
        },
      },
    );
    assert.equal(statusResponse.status, 500);

    const withdrawalResponse = await handleCreateWithdrawal(
      new Request('https://legendmural.test/api/withdrawal', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          name: 'Ada Example',
          orderId: 'SMOKETEST123',
          email: 'customer@example.com',
          confirm: true,
        }),
      }),
      {
        withdrawalStore: {
          async createWithdrawal() {
            throw sensitiveError();
          },
        },
      },
    );
    assert.equal(withdrawalResponse.status, 500);
  });

  assert.equal(calls.length, 4);
  for (const call of calls) {
    assert.equal(call.length, 2);
    assert.equal(typeof call[0], 'string');
    assert.deepEqual(call[1], { name: 'Error', code: 'INJECTED_FAILURE' });
  }

  const output = serialized(calls);
  assert.doesNotMatch(output, /super-secret/i);
  assert.doesNotMatch(output, /customer@example\.com/i);
  assert.doesNotMatch(output, /NEON_DATABASE_URL/i);
  assert.doesNotMatch(output, /clientSecret/i);
});
