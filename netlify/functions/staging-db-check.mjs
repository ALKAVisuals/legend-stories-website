import { createHash } from 'node:crypto';

const EXPECTED_STAGING_HOST_SHA256 = '2a7de64a949d3bfc17bfd4b8f05d251678127ea63934135b7e730ef6bc69be29';
const SANDBOX_API_BASE = 'https://api-m.sandbox.paypal.com';

function sha256(value) {
  return createHash('sha256').update(String(value || ''), 'utf8').digest('hex');
}

function response(status, payload) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      'Content-Security-Policy': "default-src 'none'; frame-ancestors 'none'",
      'X-Content-Type-Options': 'nosniff',
    },
  });
}

export default async function stagingDbCheck(request) {
  const context = String(process.env.CONTEXT || '').trim();
  if (context !== 'deploy-preview') {
    return response(404, { available: false });
  }

  let stagingDatabase = false;
  try {
    const databaseUrl = new URL(String(process.env.NEON_DATABASE_URL || ''));
    stagingDatabase = sha256(databaseUrl.hostname) === EXPECTED_STAGING_HOST_SHA256;
  } catch {
    stagingDatabase = false;
  }

  const paypalApiBase = String(process.env.PAYPAL_API_BASE || SANDBOX_API_BASE).trim();
  const livePaymentsAllowed = String(process.env.PAYPAL_ALLOW_LIVE || '').trim() === 'true';
  const paypalSandboxConfigured = Boolean(
    String(process.env.PAYPAL_CLIENT_ID || '').trim()
    && String(process.env.PAYPAL_CLIENT_SECRET || '').trim()
    && String(process.env.PAYPAL_WEBHOOK_ID || '').trim()
    && paypalApiBase === SANDBOX_API_BASE
    && !livePaymentsAllowed,
  );

  const previewOrigin = new URL(request.url).origin;
  let checkoutUrlsMatchPreview = false;
  try {
    const success = new URL(String(process.env.CHECKOUT_SUCCESS_URL || ''));
    const cancel = new URL(String(process.env.CHECKOUT_CANCEL_URL || ''));
    checkoutUrlsMatchPreview = success.origin === previewOrigin && cancel.origin === previewOrigin;
  } catch {
    checkoutUrlsMatchPreview = false;
  }

  return response(200, {
    deployPreview: true,
    stagingDatabase,
    paypalSandboxConfigured,
    checkoutUrlsMatchPreview,
    livePaymentsAllowed,
  });
}
