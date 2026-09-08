import assert from 'node:assert/strict';

const ORIGIN = process.env.LEGENDMURAL_WORKER_ORIGIN || 'http://127.0.0.1:8787';
const STARTUP_ATTEMPTS = 60;
const STARTUP_DELAY_MS = 500;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

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
  console.log(`[workerd-smoke] ${label}: status=${response.status} body=${compact}`);
}

async function waitUntilReady() {
  let lastError = null;
  for (let attempt = 1; attempt <= STARTUP_ATTEMPTS; attempt += 1) {
    try {
      const response = await fetch(`${ORIGIN}/shop.html`);
      if (response.ok) {
        const body = await readResponse(response);
        report('static-shop', response, body);
        assert.match(body.text, /<html/i, 'Static shop page did not contain an HTML document.');
        return;
      }
      lastError = new Error(`Worker returned ${response.status} while starting.`);
    } catch (error) {
      lastError = error;
    }
    await sleep(STARTUP_DELAY_MS);
  }
  throw new Error(`Local workerd did not become ready: ${lastError?.message || 'unknown startup failure'}`);
}

async function verifyUnknownApi() {
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

async function verifyScheduled() {
  const url = new URL('/cdn-cgi/handler/scheduled', ORIGIN);
  url.searchParams.set('cron', '*/5 * * * *');
  url.searchParams.set('format', 'json');
  const response = await fetch(url);
  const body = await readResponse(response);
  report('scheduled', response, body);
  assert.equal(response.status, 200);
  assert.equal(body.json?.outcome, 'ok');
}

await waitUntilReady();
await verifyUnknownApi();
await verifyCheckoutPaused();
await verifyDashboardDisabled();
await verifyScheduled();

console.log('[workerd-smoke] storefront Worker smoke proof passed.');
