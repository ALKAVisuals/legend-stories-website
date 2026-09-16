import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const workflow = await readFile(
  new URL('../.github/workflows/cloudflare-preview-account-proof.yml', import.meta.url),
  'utf8',
);
const wrangler = JSON.parse(
  await readFile(new URL('../wrangler.jsonc', import.meta.url), 'utf8'),
);

test('preview account workflow requires explicit preview-only confirmation', () => {
  assert.match(workflow, /confirm_phrase:/);
  assert.match(workflow, /PREVIEW_ONLY/);
  assert.match(workflow, /workflow_dispatch:/);
});

test('preview account workflow uses only Cloudflare account credentials', () => {
  assert.match(workflow, /CLOUDFLARE_API_TOKEN/);
  assert.match(workflow, /CLOUDFLARE_ACCOUNT_ID/);

  for (const forbidden of [
    'NEON_DATABASE_URL',
    'PAYPAL_CLIENT_ID',
    'PAYPAL_CLIENT_SECRET',
    'PAYPAL_WEBHOOK_ID',
    'RESEND_API_KEY',
    'LEGENDMURAL_DASHBOARD_INVOICE_TOKEN',
  ]) {
    assert.equal(
      workflow.includes(`secrets.${forbidden}`),
      false,
      `B1 preview workflow must not consume ${forbidden}.`,
    );
  }
});

test('preview account workflow cannot target the production Wrangler environment', () => {
  assert.equal(workflow.includes('--env production'), false);
  assert.equal(workflow.includes('legendmural-cloudflare-production'), false);
  assert.equal(workflow.includes('legendmural-v3-invoice-pdfs-prod'), false);
  assert.match(workflow, /legendmural-v3-invoice-pdfs-preview/);
  assert.match(workflow, /wranglerVersion: '4\.129\.0'/);
  assert.match(workflow, /command: deploy/);
});

test('top-level Wrangler config remains fail-closed preview policy', () => {
  assert.equal(wrangler.name, 'legendmural-cloudflare-preview');
  assert.equal(wrangler.vars.LEGENDMURAL_DEPLOY_CONTEXT, 'preview');
  assert.equal(wrangler.vars.LEGENDMURAL_CHECKOUT_PAUSED, 'true');
  assert.equal(wrangler.vars.PAYPAL_ALLOW_LIVE, 'false');
  assert.equal(wrangler.vars.ORDER_EMAILS_ENABLED, 'false');
  assert.equal(wrangler.vars.V3_PROFILE1_ORDER_CREATION_ENABLED, 'false');
  assert.equal(wrangler.vars.V3_INVOICE_RECONCILIATION_ENABLED, 'false');
  assert.equal(wrangler.vars.V3_INVOICE_STORAGE_ENABLED, 'false');
  assert.equal(wrangler.vars.V3_DASHBOARD_INVOICE_API_ENABLED, 'false');
  assert.deepEqual(wrangler.triggers?.crons, []);

  assert.equal(wrangler.r2_buckets.length, 1);
  assert.equal(
    wrangler.r2_buckets[0].bucket_name,
    'legendmural-v3-invoice-pdfs-preview',
  );
  assert.equal(
    wrangler.r2_buckets[0].preview_bucket_name,
    'legendmural-v3-invoice-pdfs-preview',
  );
});
