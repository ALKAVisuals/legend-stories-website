import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const paths = Object.freeze({
  config: new URL('../netlify.toml', import.meta.url),
  runtimeSource: new URL('../js/commerce/runtime-config.mjs', import.meta.url),
  checkoutClient: new URL('../js/commerce/checkout-client.mjs', import.meta.url),
  statusClient: new URL('../js/commerce/order-status-client.mjs', import.meta.url),
  paypalCaptureClient: new URL('../js/commerce/paypal-capture-client.mjs', import.meta.url),
  checkoutFunction: new URL('../netlify/functions/create-checkout-session.mjs', import.meta.url),
  paypalCheckoutFunction: new URL('../netlify/functions/create-paypal-order.mjs', import.meta.url),
  paypalCaptureFunction: new URL('../netlify/functions/capture-paypal-order.mjs', import.meta.url),
  paypalWebhookFunction: new URL('../netlify/functions/paypal-webhook.mjs', import.meta.url),
  webhookFunction: new URL('../netlify/functions/stripe-webhook.mjs', import.meta.url),
  statusFunction: new URL('../netlify/functions/order-status.mjs', import.meta.url),
});

async function sources() {
  return Object.fromEntries(await Promise.all(
    Object.entries(paths).map(async ([name, path]) => [name, await readFile(path, 'utf8')]),
  ));
}

test('Netlify config builds the validated site and selects PayPal Sandbox checkout', async () => {
  const { config } = await sources();

  assert.match(
    config,
    /command\s*=\s*"npm run build && node scripts\/generate-commerce-runtime-config\.mjs"/,
  );
  assert.match(config, /publish\s*=\s*"dist"/);
  assert.match(config, /functions\s*=\s*"netlify\/functions"/);
  assert.match(config, /NODE_VERSION\s*=\s*"22"/);
  assert.match(config, /included_files\s*=\s*\["data\/products\/catalog\.json"\]/);
  assert.match(config, /LEGENDMURAL_HOSTED_CHECKOUT_ENDPOINT\s*=\s*"\/api\/paypal\/checkout"/);
  assert.match(config, /LEGENDMURAL_ORDER_STATUS_ENDPOINT\s*=\s*"\/api\/order-status"/);
  assert.match(config, /LEGENDMURAL_PAYPAL_CAPTURE_ENDPOINT\s*=\s*"\/api\/paypal\/capture"/);

  for (const route of [
    '/api/checkout',
    '/api/paypal/checkout',
    '/api/paypal/capture',
    '/api/paypal/webhook',
    '/api/order-status',
    '/api/stripe-webhook',
  ]) {
    assert.match(config, new RegExp(`from\\s*=\\s*"${route.replaceAll('/', '\\/')}"`));
  }
  assert.doesNotMatch(config, /PAYPAL_ALLOW_LIVE\s*=\s*"?true"?/i);
  assert.doesNotMatch(config, /STRIPE_ALLOW_LIVE\s*=\s*"?true"?/i);
});

test('tracked browser config stays disabled and contains no credentials', async () => {
  const source = await sources();

  assert.match(source.runtimeSource, /hostedCheckoutEndpoint:\s*''/);
  assert.match(source.runtimeSource, /orderStatusEndpoint:\s*''/);
  assert.match(source.runtimeSource, /paypalCaptureEndpoint:\s*''/);
  assert.match(source.checkoutClient, /COMMERCE_RUNTIME_CONFIG\.hostedCheckoutEndpoint/);
  assert.match(source.statusClient, /COMMERCE_RUNTIME_CONFIG\.orderStatusEndpoint/);
  assert.match(source.paypalCaptureClient, /COMMERCE_RUNTIME_CONFIG\.paypalCaptureEndpoint/);

  const publicSources = [
    source.config,
    source.runtimeSource,
    source.checkoutClient,
    source.statusClient,
    source.paypalCaptureClient,
  ].join('\n');
  assert.doesNotMatch(publicSources, /postgres(?:ql)?:\/\//i);
  assert.doesNotMatch(publicSources, /sk_(?:test|live)_|whsec_|PAYPAL_CLIENT_SECRET\s*=/i);
});

test('each durable Netlify commerce function injects the shared Neon runtime', async () => {
  const source = await sources();

  assert.match(source.checkoutFunction, /getCommerceOrderStore/);
  assert.match(source.checkoutFunction, /checkoutStore/);
  assert.match(source.paypalCheckoutFunction, /getCommerceOrderStore/);
  assert.match(source.paypalCheckoutFunction, /checkoutStore/);
  assert.match(source.paypalCaptureFunction, /getCommerceOrderStore/);
  assert.match(source.paypalCaptureFunction, /orderStore/);
  assert.match(source.webhookFunction, /getCommerceOrderStore/);
  assert.match(source.webhookFunction, /paymentStore/);
  assert.match(source.statusFunction, /getCommerceOrderStore/);
  assert.match(source.statusFunction, /orderStore/);
});

test('PayPal webhook entrypoint verifies through the server API and remains fail-closed before reconciliation', async () => {
  const source = await sources();

  assert.match(source.paypalWebhookFunction, /handlePayPalWebhook/);
  assert.match(source.paypalWebhookFunction, /createPayPalApiClient/);
  assert.match(source.paypalWebhookFunction, /PAYPAL_WEBHOOK_ID/);
  assert.doesNotMatch(source.paypalWebhookFunction, /getCommerceOrderStore/);
});
