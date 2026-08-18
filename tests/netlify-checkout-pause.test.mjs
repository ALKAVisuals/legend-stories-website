import test from 'node:test';
import assert from 'node:assert/strict';

import {
  createNetlifyPayPalCheckoutHandler,
  isLegendMuralCheckoutPaused,
} from '../netlify/functions/create-paypal-order.mjs';

test('checkout pause flag is explicit and fail-closed only when true', () => {
  assert.equal(isLegendMuralCheckoutPaused({}), false);
  assert.equal(isLegendMuralCheckoutPaused({ LEGENDMURAL_CHECKOUT_PAUSED: 'false' }), false);
  assert.equal(isLegendMuralCheckoutPaused({ LEGENDMURAL_CHECKOUT_PAUSED: 'TRUE' }), true);
  assert.equal(isLegendMuralCheckoutPaused({ LEGENDMURAL_CHECKOUT_PAUSED: ' true ' }), true);
});

test('paused checkout returns 503 before database or PayPal bootstrap', async () => {
  let storeFactoryCalled = false;
  const handler = createNetlifyPayPalCheckoutHandler({
    env: { LEGENDMURAL_CHECKOUT_PAUSED: 'true' },
    storeFactory() {
      storeFactoryCalled = true;
      throw new Error('storeFactory must not be called while checkout is paused');
    },
  });

  const response = await handler(new Request('https://legendmural.example/api/paypal/checkout', {
    method: 'POST',
    headers: { origin: 'https://legendmural.example' },
  }));

  assert.equal(response.status, 503);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.equal(response.headers.get('retry-after'), '300');
  assert.equal(storeFactoryCalled, false);

  const body = await response.json();
  assert.deepEqual(body, {
    error: {
      code: 'CHECKOUT_PAUSED',
      message: 'Checkout is temporarily unavailable. Please try again later.',
    },
  });
});
