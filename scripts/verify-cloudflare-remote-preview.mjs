import assert from 'node:assert/strict';

function normalizePreviewOrigin(rawValue) {
  const raw = String(rawValue || '').trim();
  assert.ok(raw, 'LEGENDMURAL_PREVIEW_ORIGIN is required.');

  // wrangler-action has historically returned a URL plus an optional suffix.
  const firstToken = raw.split(/\s+/)[0];
  const candidate = /^https?:\/\//i.test(firstToken)
    ? firstToken
    : `https://${firstToken}`;
  const url = new URL(candidate);

  assert.equal(url.protocol, 'https:', 'Remote Cloudflare preview must use HTTPS.');
  assert.match(
    url.hostname,
    /\.workers\.dev$/i,
    `Remote preview must use workers.dev, received ${url.hostname}.`,
  );
  assert.notEqual(
    url.hostname.toLowerCase(),
    'legendmural.com',
    'Preview proof must never target the Production domain.',
  );

  return url.origin;
}

const ORIGIN = normalizePreviewOrigin(process.env.LEGENDMURAL_PREVIEW_ORIGIN);

async function readResponse(response) {
  const text = await response.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {}
  return { text, json };
}

function report(label, response, body) {
  const compact = body.text.replace(/\s+/g, ' ').slice(0, 500);
  console.log(`[remote-preview] ${label}: status=${response.status} body=${compact}`);
}

async function verifyStaticRoot() {
  const response = await fetch(`${ORIGIN}/`, { redirect: 'manual' });
  const body = await readResponse(response);
  report('static-root', response, body);
  assert.equal(response.status, 200);
  assert.match(body.text, /<html/i);
}

async function verifyStaticShop() {
  const response = await fetch(`${ORIGIN}/shop.html`, { redirect: 'manual' });
  const body = await readResponse(response);
  report('static-shop', response, body);
  assert.equal(response.status, 200);
  assert.match(body.text, /<html/i);
}

async function verifyUnknownApiFailsClosed() {
  const response = await fetch(`${ORIGIN}/api/not-real`);
  const body = await readResponse(response);
  report('unknown-api', response, body);
  assert.equal(response.status, 404);
  assert.equal(body.json?.error?.code, 'API_ROUTE_NOT_FOUND');
}

async function verifyCheckoutPaused() {
  const response = await fetch(`${ORIGIN}/api/paypal/checkout`, {
    method: 'POST',
    headers: {
      Origin: ORIGIN,
      'Content-Type': 'application/json',
    },
    body: '{}',
  });
  const body = await readResponse(response);
  report('checkout-paused', response, body);
  assert.equal(response.status, 503);
  assert.equal(body.json?.error?.code, 'CHECKOUT_PAUSED');
}

async function verifyDashboardDisabled() {
  const response = await fetch(`${ORIGIN}/api/internal/dashboard-invoice`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      reference: 'a'.repeat(64),
      action: 'metadata',
    }),
  });
  const body = await readResponse(response);
  report('dashboard-disabled', response, body);
  assert.equal(response.status, 503);
  assert.equal(body.json?.error?.code, 'DASHBOARD_INVOICE_API_DISABLED');
}

await verifyStaticRoot();
await verifyStaticShop();
await verifyUnknownApiFailsClosed();
await verifyCheckoutPaused();
await verifyDashboardDisabled();

console.log(`[remote-preview] Cloudflare preview smoke proof passed at ${ORIGIN}.`);
