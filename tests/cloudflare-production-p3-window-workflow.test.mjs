import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const workflowUrl = new URL('../.github/workflows/cloudflare-production-p3-v3-one-cent-window.yml', import.meta.url);
const verifierUrl = new URL('../scripts/verify-cloudflare-production-p3-window.mjs', import.meta.url);
const configUrl = new URL('../wrangler.jsonc', import.meta.url);

const workflow = await readFile(workflowUrl, 'utf8');
const verifier = await readFile(verifierUrl, 'utf8');
const config = JSON.parse(await readFile(configUrl, 'utf8'));

test('P3 window workflow is manual-only, main-only, commit-pinned and supports exact enable/disable phrases', () => {
  assert.match(workflow, /workflow_dispatch:/);
  assert.match(workflow, /refs\/heads\/main/);
  assert.match(workflow, /ENABLE_P3_V3_ONE_CENT_TEST_WINDOW/);
  assert.match(workflow, /DISABLE_P3_V3_ONE_CENT_TEST_WINDOW/);
  assert.match(workflow, /EXPECTED_COMMIT/);
  assert.match(workflow, /GITHUB_SHA/);
  assert.doesNotMatch(workflow, /\bpush:/);
  assert.doesNotMatch(workflow, /\bpull_request:/);
});

test('temporary repository target enables only the existing P3 gate while preserving live V3 and email state', () => {
  const vars = config.env.production.vars;
  assert.equal(vars.LEGENDMURAL_CHECKOUT_PAUSED, 'false');
  assert.equal(vars.P3_TEST_CHECKOUT_ENABLED, 'true');
  assert.equal(vars.PAYPAL_ALLOW_LIVE, 'true');
  assert.equal(vars.ORDER_EMAILS_ENABLED, 'true');
  assert.equal(vars.V3_PROFILE1_ORDER_CREATION_ENABLED, 'true');
  assert.equal(vars.V3_INVOICE_RECONCILIATION_ENABLED, 'true');
  assert.equal(vars.V3_INVOICE_STORAGE_ENABLED, 'true');
  assert.equal(vars.V3_DASHBOARD_INVOICE_API_ENABLED, 'false');
});

test('P3 verifier is GET-only, requires the private P3 secret name and never reads secret values', () => {
  const methods = [...verifier.matchAll(/method:\s*'([A-Z]+)'/g)].map((match) => match[1]);
  assert.deepEqual([...new Set(methods)], ['GET']);
  assert.match(verifier, /'P3_TEST_CHECKOUT_TOKEN'/);
  assert.match(verifier, /P3_TEST_CHECKOUT_ENABLED: 'true'/);
  assert.match(verifier, /V3_PROFILE1_ORDER_CREATION_ENABLED: 'true'/);
  assert.match(verifier, /V3_INVOICE_RECONCILIATION_ENABLED: 'true'/);
  assert.match(verifier, /V3_INVOICE_STORAGE_ENABLED: 'true'/);
});

test('P3 workflow uses preflight, dry-run, exactly one deploy and postdeploy verification', () => {
  const deployCommands = workflow.match(/command: deploy --env production/g) || [];
  assert.equal(deployCommands.length, 1);
  assert.match(workflow, /verify-cloudflare-production-guarded-update\.mjs postdeploy/);
  assert.match(workflow, /verify-cloudflare-production-p3-window\.mjs/);
  assert.match(workflow, /wrangler@4\.129\.0 deploy[\s\S]*--env production[\s\S]*--dry-run/);
  assert.ok(workflow.indexOf('Verify exact existing remote state before mutation') < workflow.indexOf('--dry-run'));
  assert.ok(workflow.indexOf('--dry-run') < workflow.indexOf('command: deploy --env production'));
  assert.ok(workflow.indexOf('command: deploy --env production') < workflow.indexOf('Verify exact remote state after deployment'));
});

test('workflow proof never creates a PayPal order and distinguishes P3 enable from disable safely', () => {
  assert.match(workflow, /expected 503 CHECKOUT_PAUSED/);
  assert.match(workflow, /expected 400 EMPTY_CART/);
  assert.match(workflow, /no PayPal order created/);
  assert.doesNotMatch(workflow, /x-legendmural-p3-test-token/);
  assert.doesNotMatch(workflow, /P3_TEST_CHECKOUT_TOKEN:\s*\$\{\{/);
});

test('workflow cannot mutate DNS, secrets, R2 objects or provider state explicitly', () => {
  assert.doesNotMatch(workflow, /wrangler[^\n]*(?:secret|route|delete|rollback)/i);
  assert.doesNotMatch(workflow, /r2\s+object\s+(?:put|delete)/i);
  assert.doesNotMatch(workflow, /r2\s+bucket\s+(?:create|delete)/i);
  assert.doesNotMatch(workflow, /(?:PAYPAL|NEON|RESEND|P3_TEST_CHECKOUT_TOKEN)_[A-Z_]+:\s*\$\{\{/);
});
