import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import { writeCloudflareCommerceRuntimeConfig } from '../scripts/generate-cloudflare-commerce-runtime-config.mjs';

const configUrl = new URL('../wrangler.jsonc', import.meta.url);
const pdfKitProbeConfigUrl = new URL('./fixtures/wrangler.pdfkit-probe.jsonc', import.meta.url);
const workerPdfKitRuntimeUrl = new URL('../cloudflare/pdfkit-worker-runtime.mjs', import.meta.url);
const apiRuntimeUrl = new URL('../cloudflare/api-runtime.mjs', import.meta.url);
const PDFKIT_WORKER_IMPORT_META_URL = '"file:///legendmural-cloudflare-pdfkit-runtime.mjs"';
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

function assertPdfKitWorkerBoundary(value) {
  assert.equal(value.alias?.pdfkit, './cloudflare/pdfkit-worker-runtime.mjs');
  assert.equal(value.define?.['import.meta.url'], PDFKIT_WORKER_IMPORT_META_URL);
}

test('Wrangler uses Worker + Static Assets with worker-first API routing only', async () => {
  const value = await config();
  assert.equal(value.main, 'cloudflare/worker.mjs');
  assert.equal(value.compatibility_date, '2026-09-07');
  assert.ok(value.compatibility_flags.includes('nodejs_compat'));
  assert.equal(value.assets.directory, './dist');
  assert.equal(value.assets.binding, 'ASSETS');
  assert.equal(value.assets.html_handling, 'none');
  assert.deepEqual(value.assets.run_worker_first, ['/api/*']);
  assertPdfKitWorkerBoundary(value);
});

test('Wrangler deploy generates the public same-origin browser commerce runtime config', async () => {
  const value = await config();
  assert.equal(
    value.build?.command,
    'node scripts/generate-cloudflare-commerce-runtime-config.mjs',
  );

  const directory = await mkdtemp(join(tmpdir(), 'legendmural-cloudflare-runtime-config-'));
  const targetPath = join(directory, 'runtime-config.mjs');

  try {
    const generated = await writeCloudflareCommerceRuntimeConfig({ targetPath });
    const source = await readFile(targetPath, 'utf8');

    assert.deepEqual(generated, {
      hostedCheckoutEndpoint: '/api/paypal/checkout',
      orderStatusEndpoint: '/api/order-status',
      paypalCaptureEndpoint: '/api/paypal/capture',
    });
    assert.match(source, /hostedCheckoutEndpoint.*\/api\/paypal\/checkout/s);
    assert.match(source, /orderStatusEndpoint.*\/api\/order-status/s);
    assert.match(source, /paypalCaptureEndpoint.*\/api\/paypal\/capture/s);
    assert.doesNotMatch(source, /NEON_DATABASE_URL|PAYPAL_CLIENT_SECRET|PAYPAL_WEBHOOK_ID/);
    assert.doesNotMatch(source, /https?:\/\//);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
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

test('production environment is explicitly separate, non-public and fail-closed before cutover', async () => {
  const value = await config();
  const production = value.env.production;
  assert.equal(production.name, 'legendmural-cloudflare-production');
  assert.equal(production.workers_dev, false);
  assert.equal(production.preview_urls, false);
  assert.equal(Object.hasOwn(production, 'routes'), false);
  assert.equal(production.vars.LEGENDMURAL_DEPLOY_CONTEXT, 'production');
  assertFailClosed(production.vars);
  assertNoSecretsInVars(production.vars);
  assertPdfKitWorkerBoundary(production);
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

test('Cloudflare invoice download composition preserves durable access audit logging', async () => {
  const source = await readFile(apiRuntimeUrl, 'utf8');
  const auditImports = source.match(/neon-v3-invoice-access-audit-store\.mjs/g) || [];
  const auditFactories = source.match(/createNeonV3InvoiceAccessAuditStore/g) || [];
  assert.equal(auditImports.length, 2);
  assert.equal(auditFactories.length, 2);
  assert.match(source, /auditStore,/);
  assert.match(source, /V3_INVOICE_AUDIT_/);
  assert.match(source, /!apiEnabled \|\| !hasServiceToken\(serviceToken\)/);
});

test('PDFKit workerd probe aliases the browser ESM runtime and stabilizes import.meta.url', async () => {
  const value = JSON.parse(await readFile(pdfKitProbeConfigUrl, 'utf8'));
  assert.equal(value.main, './cloudflare-pdfkit-probe-worker.mjs');
  assert.equal(value.alias?.pdfkit, '../../cloudflare/pdfkit-worker-runtime.mjs');
  assert.equal(value.define?.['import.meta.url'], PDFKIT_WORKER_IMPORT_META_URL);

  const entryUrl = new URL(value.main, pdfKitProbeConfigUrl);
  const source = await readFile(entryUrl, 'utf8');
  assert.match(source, /renderV3InvoicePdf/);

  const aliasUrl = new URL(value.alias.pdfkit, pdfKitProbeConfigUrl);
  assert.equal(aliasUrl.href, workerPdfKitRuntimeUrl.href);
  const runtimeSource = await readFile(aliasUrl, 'utf8');
  assert.match(runtimeSource, /pdfkit\.browser\.mjs/);
  assert.match(runtimeSource, /Helvetica\.mjs/);
  assert.match(runtimeSource, /HelveticaBold\.mjs/);
  assert.match(runtimeSource, /registerStdFonts\(Helvetica, HelveticaBold\)/);
  assert.doesNotMatch(runtimeSource, /pdfkit\.standalone\.js/);
});
