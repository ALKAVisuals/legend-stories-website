import assert from 'node:assert/strict';
import test from 'node:test';

import {
  CLOUDFLARE_API_ROUTES,
  handleCloudflareFetch,
  handleCloudflareScheduled,
  isCloudflareApiRoute,
  resolveCloudflarePayPalReturnUrls,
  routeCloudflareApi,
} from '../cloudflare/worker.mjs';

const EXPECTED_ROUTES = Object.freeze([
  '/api/paypal/checkout',
  '/api/paypal/capture',
  '/api/paypal/webhook',
  '/api/order-status',
  '/api/invoice-download',
  '/api/internal/dashboard-invoice',
]);

test('Cloudflare Worker exposes exactly the existing public API contract', () => {
  assert.deepEqual(CLOUDFLARE_API_ROUTES, EXPECTED_ROUTES);
  for (const route of EXPECTED_ROUTES) assert.equal(isCloudflareApiRoute(route), true);
  assert.equal(isCloudflareApiRoute('/api/create-withdrawal'), false);
  assert.equal(CLOUDFLARE_API_ROUTES.some((route) => route.includes('withdrawal')), false);
});

test('unknown API paths fail closed and never fall through to static assets', async () => {
  let staticFetches = 0;
  const env = {
    ASSETS: {
      async fetch() {
        staticFetches += 1;
        return new Response('static');
      },
    },
  };
  const response = await handleCloudflareFetch(
    new Request('https://preview.example/api/not-real'),
    env,
  );
  assert.equal(response.status, 404);
  assert.equal(staticFetches, 0);
  const payload = await response.json();
  assert.equal(payload.error.code, 'API_ROUTE_NOT_FOUND');
  assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
});

test('non-API requests are delegated to Cloudflare Static Assets binding', async () => {
  const seen = [];
  const env = {
    ASSETS: {
      async fetch(request) {
        seen.push(request.url);
        return new Response('asset-ok', { status: 200 });
      },
    },
  };
  const response = await handleCloudflareFetch(
    new Request('https://preview.example/shop.html'),
    env,
  );
  assert.equal(response.status, 200);
  assert.equal(await response.text(), 'asset-ok');
  assert.deepEqual(seen, ['https://preview.example/shop.html']);
});

test('checkout is fail-closed while the migration configuration keeps checkout paused', async () => {
  const response = await routeCloudflareApi(
    new Request('https://preview.example/api/paypal/checkout', {
      method: 'POST',
      headers: {
        origin: 'https://preview.example',
        'content-type': 'application/json',
      },
      body: '{}',
    }),
    {
      LEGENDMURAL_DEPLOY_CONTEXT: 'preview',
      LEGENDMURAL_CHECKOUT_PAUSED: 'true',
      V3_PROFILE1_ORDER_CREATION_ENABLED: 'false',
    },
  );
  assert.equal(response.status, 503);
  assert.equal(response.headers.get('retry-after'), '300');
  const payload = await response.json();
  assert.equal(payload.error.code, 'CHECKOUT_PAUSED');
});

test('dashboard invoice API cannot be activated by a preview context flag', async () => {
  const token = 'x'.repeat(48);
  const response = await routeCloudflareApi(
    new Request('https://preview.example/api/internal/dashboard-invoice', {
      method: 'POST',
      headers: {
        authorization: `Bearer ${token}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ reference: 'a'.repeat(64), action: 'metadata' }),
    }),
    {
      LEGENDMURAL_DEPLOY_CONTEXT: 'preview',
      V3_DASHBOARD_INVOICE_API_ENABLED: 'true',
      V3_INVOICE_STORAGE_ENABLED: 'false',
      LEGENDMURAL_DASHBOARD_INVOICE_TOKEN: token,
    },
  );
  assert.equal(response.status, 503);
  const payload = await response.json();
  assert.equal(payload.error.code, 'DASHBOARD_INVOICE_API_DISABLED');
});

test('same-origin checkout return URLs follow the active Cloudflare preview origin', () => {
  const request = new Request('https://preview.example/api/paypal/checkout', {
    headers: { origin: 'https://preview.example' },
  });
  assert.deepEqual(resolveCloudflarePayPalReturnUrls(request, {}), {
    successUrl: 'https://preview.example/order-success.html',
    cancelUrl: 'https://preview.example/order-cancelled.html',
  });
});

test('cross-origin server request uses configured canonical return URLs', () => {
  const env = {
    CHECKOUT_SUCCESS_URL: 'https://legendmural.com/order-success.html',
    CHECKOUT_CANCEL_URL: 'https://legendmural.com/order-cancelled.html',
  };
  const request = new Request('https://worker.example/api/paypal/checkout', {
    headers: { origin: 'https://legendmural.com' },
  });
  assert.deepEqual(resolveCloudflarePayPalReturnUrls(request, env), {
    successUrl: env.CHECKOUT_SUCCESS_URL,
    cancelUrl: env.CHECKOUT_CANCEL_URL,
  });
});

test('www requests redirect to canonical HTTPS apex', async () => {
  const response = await handleCloudflareFetch(
    new Request('https://www.legendmural.com/shop.html?from=test'),
    { ASSETS: { fetch: async () => new Response('unexpected') } },
  );
  assert.equal(response.status, 301);
  assert.equal(response.headers.get('location'), 'https://legendmural.com/shop.html?from=test');
});

test('scheduled reconciliation is harmless while reconciliation remains disabled', async () => {
  await assert.doesNotReject(() => handleCloudflareScheduled(
    { cron: '*/5 * * * *' },
    {
      LEGENDMURAL_DEPLOY_CONTEXT: 'production',
      V3_INVOICE_RECONCILIATION_ENABLED: 'false',
      ORDER_EMAILS_ENABLED: 'false',
      V3_INVOICE_STORAGE_ENABLED: 'false',
    },
  ));
});
