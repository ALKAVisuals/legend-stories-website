import assert from 'node:assert/strict';

const EXPECTED_ORIGIN = 'https://legendmural-cloudflare-preview.lively-bonus-08da.workers.dev';
const origin = String(process.env.LEGENDMURAL_PREVIEW_ORIGIN || '').replace(/\/+$/, '');

assert.equal(
  origin,
  EXPECTED_ORIGIN,
  'Refusing to probe any origin other than the canonical non-production Cloudflare preview Worker.',
);

const matrix = Object.freeze([
  Object.freeze({ path: '/api/paypal/checkout', status: 503, code: 'CHECKOUT_PAUSED' }),
  Object.freeze({ path: '/api/paypal/capture', status: 405, code: 'METHOD_NOT_ALLOWED' }),
  Object.freeze({ path: '/api/paypal/webhook', status: 405, code: 'METHOD_NOT_ALLOWED' }),
  Object.freeze({ path: '/api/order-status', status: 405, code: 'METHOD_NOT_ALLOWED' }),
  Object.freeze({ path: '/api/invoice-download', status: 405, code: 'METHOD_NOT_ALLOWED' }),
  Object.freeze({ path: '/api/internal/dashboard-invoice', status: 405, code: 'METHOD_NOT_ALLOWED' }),
]);

for (const entry of matrix) {
  const url = `${origin}${entry.path}`;
  const response = await fetch(url, {
    method: 'GET',
    redirect: 'manual',
    headers: { Accept: 'application/json' },
  });

  const contentType = String(response.headers.get('content-type') || '').toLowerCase();
  const cacheControl = String(response.headers.get('cache-control') || '').toLowerCase();
  const text = await response.text();

  let body;
  try {
    body = JSON.parse(text);
  } catch {
    throw new Error(`${entry.path} did not return JSON. status=${response.status} body=${text.slice(0, 240)}`);
  }

  assert.equal(response.status, entry.status, `${entry.path} returned unexpected HTTP status.`);
  assert.equal(body?.error?.code, entry.code, `${entry.path} returned unexpected error code.`);
  assert.match(contentType, /application\/json/, `${entry.path} must return JSON.`);
  assert.match(cacheControl, /no-store/, `${entry.path} must remain non-cacheable.`);

  console.log(`[preview-api-matrix] GET ${entry.path} -> ${response.status} ${body.error.code}`);
}

console.log(`[preview-api-matrix] all ${matrix.length} intended API routes reached the canonical preview Worker through read-only GET probes.`);
