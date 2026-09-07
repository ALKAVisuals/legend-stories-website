import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const configUrl = new URL('../wrangler.jsonc', import.meta.url);
const pdfKitProbeConfigUrl = new URL('./fixtures/wrangler.pdfkit-probe.jsonc', import.meta.url);
const SENSITIVE_BINDING_NAMES = Object.freeze([
  'NEON_DATABASE_URL',
  'PAYPAL_CLIENT_ID',
  'PAYPAL_CLIENT_SECRET',
  'PAYPAL_WEBHOOK_ID',
  'RESEND_API_KEY',
  'LEGENDMURAL_DASHBOARD_INVOICE_TOKEN',
]);

async function config() {
  return JSON.parse(await readFile(configUrl, 'utf8'));
}

function assertFailClosed(vars) {
  assert.equal(vars.LEGENDMURAL_CHECKOUT_PAUSED, 'true');
  assert.equal(vars.PAYPAL_ALLOW_LIVE, 'false');
  assert.equal(vars.ORDER_EMAILS_ENABLED, 'false');
  assert.equal(vars.V3_PROFILE1_ORDER_CREATION_ENABLED, 'false');
  assert.equal(vars.V3_INVOICE_RECONCILIATION_ENABLED, 'false');
  assert.equal(vars.V3_INVOICE_STORAGE_ENABLED, 'false');
  assert.equal(vars.V3_DASHBOARD_INVOICE_API_ENABLED, 'false');
}

function assertNoSecretsInVars(vars) {
  for (const name of SENSITIVE_BINDING_NAMES) {
    assert.equal(
      Object.hasOwn(vars, name),
      false,
      `${name} must be configured as a Cloudflare Secret, never committed under vars`,
    );
  }
}

test('Wrangler uses Worker + Static Assets with worker-first API routing only', async () => {
  const value = await config();
  assert.equal(value.main, 'cloudflare/worker.mjs');
  assert.equal(value.compatibility_date, '2026-09-07');
  assert.ok(value.compatibility_flags.includes('nodejs_compat'));
  assert.equal(value.assets.directory, './dist');
  assert.equal(value.assets.binding, 'ASSETS');
  assert.deepEqual(value.assets.run_worker_first, ['/api/*']);
});

test('preview environment is isolated, fail-closed and has no scheduled reconciliation', async () => {
  const value = await config();
  assert.equal(value.name, 'legendmural-cloudflare-preview');
  assert.equal(value.vars.LEGENDMURAL_DEPLOY_CONTEXT, 'preview');
  assertFailClosed(value.vars);
  assertNoSecretsInVars(value.vars);
  assert.deepEqual(value.triggers.crons, []);
  assert.equal(value.r2_buckets.length, 1);
  assert.equal(value.r2_buckets[0].binding, 'V3_INVOICE_PDFS');
  assert.equal(value.r2_buckets[0].bucket_name, 'legendmural-v3-invoice-pdfs-preview');
  assert.equal(value.r2_buckets[0].preview_bucket_name, 'legendmural-v3-invoice-pdfs-preview');
});

test('production environment is explicitly separate and still fail-closed before cutover', async () => {
  const value = await config();
  const production = value.env.production;
  assert.equal(production.name, 'legendmural-cloudflare-production');
  assert.equal(production.vars.LEGENDMURAL_DEPLOY_CONTEXT, 'production');
  assertFailClosed(production.vars);
  assertNoSecretsInVars(production.vars);
  assert.deepEqual(production.triggers.crons, ['*/5 * * * *']);
  assert.equal(production.r2_buckets.length, 1);
  assert.equal(production.r2_buckets[0].binding, 'V3_INVOICE_PDFS');
  assert.equal(production.r2_buckets[0].bucket_name, 'legendmural-v3-invoice-pdfs-prod');
  assert.equal(production.r2_buckets[0].preview_bucket_name, 'legendmural-v3-invoice-pdfs-preview');
  assert.equal(production.vars.CHECKOUT_SUCCESS_URL, 'https://legendmural.com/order-success.html');
  assert.equal(production.vars.CHECKOUT_CANCEL_URL, 'https://legendmural.com/order-cancelled.html');
  assert.equal(production.vars.CHECKOUT_ALLOWED_ORIGINS, 'https://legendmural.com');
});

test('preview and production never point at the same writable invoice bucket', async () => {
  const value = await config();
  assert.notEqual(
    value.r2_buckets[0].bucket_name,
    value.env.production.r2_buckets[0].bucket_name,
  );
});

test('Netlify production context is not used as Cloudflare deployment truth', async () => {
  const value = await config();
  assert.equal(Object.hasOwn(value.vars, 'CONTEXT'), false);
  assert.equal(Object.hasOwn(value.env.production.vars, 'CONTEXT'), false);
  assert.equal(value.vars.LEGENDMURAL_DEPLOY_CONTEXT, 'preview');
  assert.equal(value.env.production.vars.LEGENDMURAL_DEPLOY_CONTEXT, 'production');
});

test('PDFKit workerd probe entry point resolves relative to its Wrangler config', async () => {
  const value = JSON.parse(await readFile(pdfKitProbeConfigUrl, 'utf8'));
  assert.equal(value.main, './cloudflare-pdfkit-probe-worker.mjs');
  const entryUrl = new URL(value.main, pdfKitProbeConfigUrl);
  const source = await readFile(entryUrl, 'utf8');
  assert.match(source, /renderV3InvoicePdf/);
});
