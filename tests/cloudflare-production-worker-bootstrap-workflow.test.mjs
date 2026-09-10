import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const workflowUrl = new URL('../.github/workflows/cloudflare-production-worker-bootstrap.yml', import.meta.url);
const verifierUrl = new URL('../scripts/verify-cloudflare-production-worker-bootstrap.mjs', import.meta.url);
const configUrl = new URL('../wrangler.jsonc', import.meta.url);
const workerUrl = new URL('../cloudflare/worker.mjs', import.meta.url);

const workflow = await readFile(workflowUrl, 'utf8');
const verifier = await readFile(verifierUrl, 'utf8');
const config = JSON.parse(await readFile(configUrl, 'utf8'));
const worker = await readFile(workerUrl, 'utf8');

const expectedFlags = Object.freeze({
  LEGENDMURAL_DEPLOY_CONTEXT: 'production',
  LEGENDMURAL_CHECKOUT_PAUSED: 'true',
  PAYPAL_ALLOW_LIVE: 'false',
  ORDER_EMAILS_ENABLED: 'false',
  V3_PROFILE1_ORDER_CREATION_ENABLED: 'false',
  V3_INVOICE_RECONCILIATION_ENABLED: 'false',
  V3_INVOICE_STORAGE_ENABLED: 'false',
  V3_DASHBOARD_INVOICE_API_ENABLED: 'false',
});

const applicationSecretNames = Object.freeze([
  'NEON_DATABASE_URL',
  'PAYPAL_CLIENT_ID',
  'PAYPAL_CLIENT_SECRET',
  'PAYPAL_WEBHOOK_ID',
  'RESEND_API_KEY',
  'LEGENDMURAL_DASHBOARD_INVOICE_TOKEN',
]);

test('Production Worker bootstrap requires exact manual owner confirmation and skips mutation on PRs', () => {
  assert.match(workflow, /workflow_dispatch:/);
  assert.match(workflow, /CREATE_FAIL_CLOSED_PRODUCTION_WORKER_ONLY/);
  assert.match(workflow, /if: github\.event_name == 'workflow_dispatch'/);
  assert.match(workflow, /needs: policy/);
  assert.doesNotMatch(workflow, /push:/);
});

test('Production Worker bootstrap uses only established Cloudflare account credentials', () => {
  assert.match(workflow, /CLOUDFLARE_API_TOKEN: \$\{\{ secrets\.CLOUDFLARE_API_TOKEN \}\}/);
  assert.match(workflow, /CLOUDFLARE_ACCOUNT_ID: \$\{\{ secrets\.CLOUDFLARE_ACCOUNT_ID \}\}/);
  for (const secretName of applicationSecretNames) {
    assert.doesNotMatch(workflow, new RegExp(secretName));
  }
});

test('Production Worker bootstrap has exactly one real deploy and a mandatory dry run first', () => {
  const actionDeploys = workflow.match(/command: deploy --env production/g) || [];
  assert.equal(actionDeploys.length, 1);
  assert.match(workflow, /wrangler@4\.129\.0 deploy[\s\S]*--env production[\s\S]*--dry-run/);
  assert.ok(
    workflow.indexOf('Preflight Worker absence and private Production R2 with GET only')
      < workflow.indexOf('Create exact non-public fail-closed Production Worker'),
  );
  assert.ok(
    workflow.indexOf('Bundle exact Production Worker without deployment')
      < workflow.indexOf('Create exact non-public fail-closed Production Worker'),
  );
});

test('bootstrap workflow cannot mutate R2 objects, DNS, routes, secrets or provider state', () => {
  assert.doesNotMatch(workflow, /r2\s+object\s+(?:put|delete)/i);
  assert.doesNotMatch(workflow, /r2\s+bucket\s+(?:create|delete)/i);
  assert.doesNotMatch(workflow, /wrangler[^\n]*(?:secret|route|delete|rollback)/i);
  assert.doesNotMatch(workflow, /(?:PAYPAL|RESEND|NEON)_[A-Z_]+:\s*\$\{\{/);
});

test('Production config is non-public, separate, exact-bucket and fail-closed', () => {
  const production = config.env.production;
  assert.equal(production.name, 'legendmural-cloudflare-production');
  assert.equal(production.workers_dev, false);
  assert.equal(production.preview_urls, false);
  assert.equal(Object.hasOwn(production, 'routes'), false);
  assert.deepEqual(production.triggers.crons, ['*/5 * * * *']);
  assert.equal(production.r2_buckets.length, 1);
  assert.deepEqual(production.r2_buckets[0], {
    binding: 'V3_INVOICE_PDFS',
    bucket_name: 'legendmural-v3-invoice-pdfs-prod',
    preview_bucket_name: 'legendmural-v3-invoice-pdfs-preview',
  });
  for (const [name, expected] of Object.entries(expectedFlags)) {
    assert.equal(production.vars[name], expected);
  }
  for (const secretName of applicationSecretNames) {
    assert.equal(Object.hasOwn(production.vars, secretName), false);
  }
});

test('account verifier is GET-only and enforces create-only preflight plus zero bootstrap secrets', () => {
  const explicitMethods = [...verifier.matchAll(/method:\s*'([A-Z]+)'/g)].map((match) => match[1]);
  assert.deepEqual([...new Set(explicitMethods)], ['GET']);
  assert.doesNotMatch(verifier, /method:\s*'(?:POST|PUT|PATCH|DELETE)'/);
  assert.match(verifier, /Refusing create-only bootstrap because Production Worker/);
  assert.match(verifier, /Production Worker bootstrap must not configure any application secrets/);
  assert.match(verifier, /r2\/buckets/);
  assert.match(verifier, /domains\/managed/);
  assert.match(verifier, /domains\/custom/);
  assert.match(verifier, /workers\/scripts/);
  assert.match(verifier, /\/secrets/);
});

test('the configured Production cron remains a no-op while reconciliation is disabled', () => {
  const scheduledStart = worker.indexOf('export async function handleCloudflareScheduled');
  assert.ok(scheduledStart >= 0);
  const scheduledSource = worker.slice(scheduledStart);
  assert.match(
    scheduledSource,
    /if \(!enabled\(env\.V3_INVOICE_RECONCILIATION_ENABLED\)\)[\s\S]*skippedReconciliation\('reconciliation_disabled'\)/,
  );
  assert.equal(config.env.production.vars.V3_INVOICE_RECONCILIATION_ENABLED, 'false');
  assert.equal(config.env.production.vars.ORDER_EMAILS_ENABLED, 'false');
});
