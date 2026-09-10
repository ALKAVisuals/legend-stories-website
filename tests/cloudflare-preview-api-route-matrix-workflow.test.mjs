import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const workflow = await readFile(
  new URL('../.github/workflows/cloudflare-preview-api-route-matrix.yml', import.meta.url),
  'utf8',
);
const verifier = await readFile(
  new URL('../scripts/verify-cloudflare-preview-api-route-matrix.mjs', import.meta.url),
  'utf8',
);

const expectedOrigin = 'https://legendmural-cloudflare-preview.lively-bonus-08da.workers.dev';
const expectedRoutes = [
  '/api/paypal/checkout',
  '/api/paypal/capture',
  '/api/paypal/webhook',
  '/api/order-status',
  '/api/invoice-download',
  '/api/internal/dashboard-invoice',
];

test('preview API matrix proof is manual and exact-confirmation only', () => {
  assert.match(workflow, /workflow_dispatch:/);
  assert.doesNotMatch(workflow, /\npush:/);
  assert.doesNotMatch(workflow, /\npull_request:/);
  assert.match(workflow, /PREVIEW_API_MATRIX_ONLY/);
});

test('preview API matrix proof is fixed to the canonical workers.dev preview origin', () => {
  assert.match(workflow, new RegExp(expectedOrigin.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  assert.match(verifier, new RegExp(expectedOrigin.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  assert.doesNotMatch(workflow, /legendmural\.com/);
});

test('preview API matrix proof uses no provider secrets and performs no deploy', () => {
  for (const forbidden of [
    'CLOUDFLARE_API_TOKEN',
    'CLOUDFLARE_ACCOUNT_ID',
    'NEON_DATABASE_URL',
    'PAYPAL_CLIENT_ID',
    'PAYPAL_CLIENT_SECRET',
    'PAYPAL_WEBHOOK_ID',
    'RESEND_API_KEY',
    'LEGENDMURAL_DASHBOARD_INVOICE_TOKEN',
    'wrangler deploy',
    'wrangler-action',
  ]) {
    assert.doesNotMatch(workflow, new RegExp(forbidden));
  }
});

test('remote verifier covers exactly the six intended API routes with GET only', () => {
  for (const route of expectedRoutes) {
    assert.match(verifier, new RegExp(route.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }
  assert.equal((verifier.match(/path:\s*'\/api\//g) || []).length, 6);
  assert.match(verifier, /method:\s*'GET'/);
  assert.doesNotMatch(verifier, /method:\s*'POST'/);
});

test('remote verifier locks fail-closed expected responses', () => {
  assert.match(verifier, /CHECKOUT_PAUSED/);
  assert.equal((verifier.match(/METHOD_NOT_ALLOWED/g) || []).length, 5);
  assert.match(verifier, /no-store/);
});
