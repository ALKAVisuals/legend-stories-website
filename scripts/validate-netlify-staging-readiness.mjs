const source = String(process.env.LEGENDMURAL_STAGING_BASE_URL || '').trim();

if (!source) {
  console.error('LEGENDMURAL_STAGING_BASE_URL is required.');
  process.exit(1);
}

let baseUrl;
try {
  baseUrl = new URL(source);
} catch {
  console.error('LEGENDMURAL_STAGING_BASE_URL must be a valid absolute URL.');
  process.exit(1);
}

if (baseUrl.protocol !== 'https:' || baseUrl.username || baseUrl.password) {
  console.error('LEGENDMURAL_STAGING_BASE_URL must be an HTTPS URL without credentials.');
  process.exit(1);
}

baseUrl.pathname = '/';
baseUrl.search = '';
baseUrl.hash = '';

const origin = baseUrl.origin;
const retryAttempts = Number(process.env.LEGENDMURAL_STAGING_RETRY_ATTEMPTS || 24);
const retryDelayMs = Number(process.env.LEGENDMURAL_STAGING_RETRY_DELAY_MS || 10000);

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function request(path, options = {}) {
  const url = new URL(path, baseUrl);
  const response = await fetch(url, {
    redirect: 'follow',
    signal: AbortSignal.timeout(15000),
    ...options,
    headers: {
      Origin: origin,
      ...(options.headers || {}),
    },
  });

  const text = await response.text();
  let body = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = null;
  }

  return { response, text, body, url };
}

function failure(label, result, expectation) {
  const code = result.body?.error?.code || 'NO_ERROR_CODE';
  const message = result.body?.error?.message || result.text.slice(0, 160) || 'empty response';
  throw new Error(
    `${label} failed: expected ${expectation}; received HTTP ${result.response.status} ${code}: ${message}`,
  );
}

async function waitForStorefront() {
  let lastStatus = 0;
  let lastError = null;

  for (let attempt = 1; attempt <= retryAttempts; attempt += 1) {
    try {
      const result = await request('/');
      lastStatus = result.response.status;
      if (result.response.ok) {
        if (!/Legend Stories|LegendMural/i.test(result.text)) {
          throw new Error('Storefront response does not contain a LegendMural marker.');
        }
        console.log(`Storefront ready at ${origin} (HTTP ${result.response.status}).`);
        return;
      }
    } catch (error) {
      lastError = error;
    }

    if (attempt < retryAttempts) {
      console.log(`Storefront not ready yet (attempt ${attempt}/${retryAttempts}, status ${lastStatus || 'network'}).`);
      await sleep(retryDelayMs);
    }
  }

  throw lastError || new Error(`Storefront did not become ready; last HTTP status ${lastStatus || 'unknown'}.`);
}

async function expectJsonError({ label, path, options, status, code }) {
  const result = await request(path, options);
  if (result.response.status !== status || result.body?.error?.code !== code) {
    failure(label, result, `HTTP ${status} ${code}`);
  }
  console.log(`${label}: HTTP ${status} ${code}.`);
  return result;
}

await waitForStorefront();

await expectJsonError({
  label: 'Checkout function bootstrap',
  path: '/api/checkout',
  options: { method: 'GET' },
  status: 405,
  code: 'METHOD_NOT_ALLOWED',
});

await expectJsonError({
  label: 'Checkout URL configuration',
  path: '/api/checkout',
  options: {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: '{',
  },
  status: 400,
  code: 'INVALID_JSON',
});

await expectJsonError({
  label: 'Stripe test-key configuration',
  path: '/api/checkout',
  options: {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      request: { items: [], countryCode: 'NL' },
      customer: {},
    }),
  },
  status: 400,
  code: 'EMPTY_CART',
});

await expectJsonError({
  label: 'Order-status function bootstrap',
  path: '/api/order-status',
  options: { method: 'GET' },
  status: 405,
  code: 'METHOD_NOT_ALLOWED',
});

await expectJsonError({
  label: 'Stripe-webhook function bootstrap',
  path: '/api/stripe-webhook',
  options: { method: 'GET' },
  status: 405,
  code: 'METHOD_NOT_ALLOWED',
});

const webhookTimestamp = Math.floor(Date.now() / 1000);
const webhookProbe = await request('/api/stripe-webhook', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Stripe-Signature': `t=${webhookTimestamp},v1=0000000000000000000000000000000000000000000000000000000000000000`,
  },
  body: '{}',
});

if (webhookProbe.response.status === 503
  || webhookProbe.body?.error?.code === 'WEBHOOK_NOT_CONFIGURED') {
  failure('Stripe webhook-secret configuration', webhookProbe, 'a configured test webhook secret');
}
if (webhookProbe.response.status !== 400) {
  failure('Stripe webhook-secret configuration', webhookProbe, 'HTTP 400 for an intentionally invalid signature');
}
console.log(`Stripe webhook-secret configuration: HTTP 400 ${webhookProbe.body?.error?.code || 'INVALID_SIGNATURE'}.`);

console.log('Netlify staging readiness probe passed without creating an order or Stripe Checkout Session.');
