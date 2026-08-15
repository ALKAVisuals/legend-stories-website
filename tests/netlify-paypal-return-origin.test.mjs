import test from 'node:test';
import assert from 'node:assert/strict';

import { resolveNetlifyPayPalReturnUrls } from '../netlify/functions/create-paypal-order.mjs';

const env = {
  CHECKOUT_SUCCESS_URL: 'https://deploy-preview-85--legendmural.netlify.app/order-success.html',
  CHECKOUT_CANCEL_URL: 'https://deploy-preview-85--legendmural.netlify.app/order-cancelled.html',
};

function request(url, origin = '') {
  return new Request(url, {
    method: 'POST',
    headers: origin ? { Origin: origin } : {},
  });
}

test('same-origin browser checkout returns to the exact deploy origin that initiated it', () => {
  const origin = 'https://deploy-preview-86--legendmural.netlify.app';
  const urls = resolveNetlifyPayPalReturnUrls(
    request(`${origin}/.netlify/functions/create-paypal-order`, origin),
    env,
  );

  assert.equal(urls.successUrl, `${origin}/order-success.html`);
  assert.equal(urls.cancelUrl, `${origin}/order-cancelled.html`);
});

test('server-side checkout without a browser Origin keeps the configured fallback URLs', () => {
  const urls = resolveNetlifyPayPalReturnUrls(
    request('https://deploy-preview-86--legendmural.netlify.app/.netlify/functions/create-paypal-order'),
    env,
  );

  assert.equal(urls.successUrl, env.CHECKOUT_SUCCESS_URL);
  assert.equal(urls.cancelUrl, env.CHECKOUT_CANCEL_URL);
});

test('a different browser Origin can never rewrite the PayPal return destination', () => {
  const urls = resolveNetlifyPayPalReturnUrls(
    request(
      'https://deploy-preview-86--legendmural.netlify.app/.netlify/functions/create-paypal-order',
      'https://example.invalid',
    ),
    env,
  );

  assert.equal(urls.successUrl, env.CHECKOUT_SUCCESS_URL);
  assert.equal(urls.cancelUrl, env.CHECKOUT_CANCEL_URL);
});
