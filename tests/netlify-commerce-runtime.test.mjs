import test from 'node:test';
import assert from 'node:assert/strict';

import { createNetlifyPayPalCheckoutHandler } from '../netlify/functions/create-paypal-order.mjs';
import { createNetlifyOrderStatusHandler } from '../netlify/functions/order-status.mjs';
import {
  NetlifyCommerceConfigurationError,
  commerceBootstrapErrorResponse,
  getCommerceOrderStore,
  resetCommerceRuntimeCache,
} from '../server/netlify/commerce-runtime.mjs';

const DATABASE_URL = 'postgresql://legend:secret@ep-example-pooler.eu-central-1.aws.neon.tech/neondb?sslmode=require';

test('Netlify commerce runtime fails closed without a Neon URL', () => {
  resetCommerceRuntimeCache();
  assert.throws(
    () => getCommerceOrderStore({ env: {} }),
    (error) => error instanceof NetlifyCommerceConfigurationError
      && error.code === 'NEON_DATABASE_URL_MISSING',
  );
});

test('Netlify commerce runtime caches one store without exposing credentials', async () => {
  resetCommerceRuntimeCache();
  let factoryCalls = 0;
  const store = Object.freeze({ getOrderByReference() {} });
  const storeFactory = ({ connectionString }) => {
    factoryCalls += 1;
    assert.equal(connectionString, DATABASE_URL);
    return store;
  };

  assert.equal(
    getCommerceOrderStore({ env: { NEON_DATABASE_URL: DATABASE_URL }, storeFactory }),
    store,
  );
  assert.equal(
    getCommerceOrderStore({ env: { NEON_DATABASE_URL: DATABASE_URL }, storeFactory }),
    store,
  );
  assert.equal(factoryCalls, 1);

  resetCommerceRuntimeCache();
  let capturedError;
  try {
    getCommerceOrderStore({
      env: { NEON_DATABASE_URL: DATABASE_URL },
      storeFactory: () => {
        throw new Error(`Could not connect to ${DATABASE_URL}`);
      },
    });
  } catch (error) {
    capturedError = error;
  }

  assert.ok(capturedError instanceof NetlifyCommerceConfigurationError);
  assert.equal(capturedError.code, 'NEON_DATABASE_URL_INVALID');
  assert.doesNotMatch(capturedError.message, /postgresql:|secret@/);

  const response = commerceBootstrapErrorResponse(capturedError);
  assert.equal(response.status, 503);
  assert.doesNotMatch(await response.text(), /postgresql:|secret@/);
});

test('PayPal checkout function returns a safe 503 before contacting PayPal when Neon is missing', async () => {
  resetCommerceRuntimeCache();
  let paypalCalled = false;
  const handler = createNetlifyPayPalCheckoutHandler({
    env: {},
    handlerOptions: {
      paypalClient: {
        mode: 'test',
        async createOrder() {
          paypalCalled = true;
        },
      },
    },
  });
  const response = await handler(new Request('https://preview.example/api/paypal/checkout', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ request: {}, customer: {} }),
  }));
  const payload = await response.json();

  assert.equal(response.status, 503);
  assert.equal(payload.error.code, 'PAYPAL_CHECKOUT_SERVICE_NOT_CONFIGURED');
  assert.equal(paypalCalled, false);
});

test('order-status function injects the shared Neon store into the existing API handler', async () => {
  resetCommerceRuntimeCache();
  const reference = 'a'.repeat(64);
  const sessionId = '5O190127TN364715T';
  const orderStore = {
    async getOrderByReference(receivedReference) {
      assert.equal(receivedReference, reference);
      return {
        reference,
        paymentSessionId: sessionId,
        mode: 'test',
        status: 'paid',
        updatedAt: 1_800_000_000,
        version: 2,
      };
    },
  };
  const handler = createNetlifyOrderStatusHandler({
    env: {
      NEON_DATABASE_URL: DATABASE_URL,
      CHECKOUT_ALLOWED_ORIGINS: 'https://preview.example',
    },
    storeFactory: () => orderStore,
  });
  const response = await handler(new Request('https://preview.example/api/order-status', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Origin: 'https://preview.example',
    },
    body: JSON.stringify({ reference, sessionId }),
  }));
  const payload = await response.json();

  assert.equal(response.status, 200);
  assert.equal(payload.reference, reference);
  assert.equal(payload.status, 'paid');
  assert.equal(payload.paid, true);
});
