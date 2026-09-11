import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const workflow = await readFile('.github/workflows/cloudflare-production-readonly-inventory.yml', 'utf8');
const script = await readFile('scripts/inventory-cloudflare-production-account.mjs', 'utf8');

const forbiddenMutationTokens = [
  "method: 'POST'",
  'method: "POST"',
  "method: 'PUT'",
  'method: "PUT"',
  "method: 'PATCH'",
  'method: "PATCH"',
  "method: 'DELETE'",
  'method: "DELETE"',
  'wrangler-action',
  'wrangler deploy',
  'r2 bucket create',
  'secret put',
  'secret bulk',
];

test('Production inventory preserves exact manual confirmation for workflow dispatch', () => {
  assert.match(workflow, /workflow_dispatch:/);
  assert.match(workflow, /PRODUCTION_INVENTORY_READ_ONLY/);
  assert.match(workflow, /if: github\.event_name == 'workflow_dispatch'/);
});

test('Production inventory may read account state automatically only for same-repo pull requests', () => {
  assert.match(workflow, /github\.event_name == 'pull_request'/);
  assert.match(workflow, /github\.event\.pull_request\.head\.repo\.full_name == github\.repository/);
  assert.doesNotMatch(workflow, /pull_request_target/);
});

test('Production inventory workflow has read-only GitHub permissions', () => {
  assert.match(workflow, /permissions:\s*\n\s*contents: read/);
});

test('Production inventory uses only the established Cloudflare credential names', () => {
  assert.match(workflow, /CLOUDFLARE_API_TOKEN: \$\{\{ secrets\.CLOUDFLARE_API_TOKEN \}\}/);
  assert.match(workflow, /CLOUDFLARE_ACCOUNT_ID: \$\{\{ secrets\.CLOUDFLARE_ACCOUNT_ID \}\}/);
  assert.doesNotMatch(workflow, /PAYPAL_CLIENT_SECRET|NEON_DATABASE_URL|RESEND_API_KEY|LEGENDMURAL_DASHBOARD_INVOICE_TOKEN/);
});

test('inventory script is fixed to the intended Production zone, Worker and R2 bucket', () => {
  assert.match(script, /const PROD_ZONE = 'legendmural\.com'/);
  assert.match(script, /legendmural-cloudflare-production/);
  assert.match(script, /legendmural-v3-invoice-pdfs-prod/);
});

test('inventory script uses Cloudflare API GET requests only', () => {
  assert.match(script, /method: 'GET'/);
  for (const token of forbiddenMutationTokens) {
    assert.equal(script.includes(token), false, `forbidden mutation token present in script: ${token}`);
    assert.equal(workflow.includes(token), false, `forbidden mutation token present in workflow: ${token}`);
  }
});

test('inventory covers zone state, Worker settings, Worker custom domains, secret-name presence and R2 public exposure', () => {
  assert.match(script, /\/zones\?name=\$\{encodeURIComponent\(PROD_ZONE\)\}&account\.id=\$\{encodeURIComponent\(accountId\)\}/);
  assert.match(script, /\/workers\/scripts\/\$\{encodeURIComponent\(PROD_WORKER\)\}\/settings/);
  assert.match(script, /\/workers\/scripts\/\$\{encodeURIComponent\(PROD_WORKER\)\}\/secrets/);
  assert.match(script, /\/accounts\/\$\{accountId\}\/workers\/domains/);
  assert.match(script, /\/r2\/buckets\/\$\{encodeURIComponent\(PROD_R2_BUCKET\)\}/);
  assert.match(script, /\/domains\/managed/);
  assert.match(script, /\/domains\/custom/);
});

test('inventory never prints raw Cloudflare responses or secret values', () => {
  assert.doesNotMatch(script, /console\.log\(text\)/);
  assert.doesNotMatch(script, /console\.log\(body\)/);
  assert.doesNotMatch(script, /console\.log\(settings\)/);
  assert.doesNotMatch(script, /console\.log\(secrets\)/);
  assert.match(script, /secretNamesPresent/);
  assert.match(script, /No secret values are printed/);
});

test('expected Production safety flags remain fail-closed', () => {
  assert.match(script, /LEGENDMURAL_DEPLOY_CONTEXT: 'production'/);
  assert.match(script, /LEGENDMURAL_CHECKOUT_PAUSED: 'true'/);
  assert.match(script, /PAYPAL_ALLOW_LIVE: 'false'/);
  assert.match(script, /ORDER_EMAILS_ENABLED: 'false'/);
  assert.match(script, /V3_PROFILE1_ORDER_CREATION_ENABLED: 'false'/);
  assert.match(script, /V3_INVOICE_RECONCILIATION_ENABLED: 'false'/);
  assert.match(script, /V3_INVOICE_STORAGE_ENABLED: 'false'/);
  assert.match(script, /V3_DASHBOARD_INVOICE_API_ENABLED: 'false'/);
});
