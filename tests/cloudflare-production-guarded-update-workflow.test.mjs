import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const workflowUrl = new URL('../.github/workflows/cloudflare-production-guarded-update.yml', import.meta.url);
const verifierUrl = new URL('../scripts/verify-cloudflare-production-guarded-update.mjs', import.meta.url);
const configUrl = new URL('../wrangler.jsonc', import.meta.url);

const workflow = await readFile(workflowUrl, 'utf8');
const verifier = await readFile(verifierUrl, 'utf8');
const config = JSON.parse(await readFile(configUrl, 'utf8'));

const requiredSecrets = [
  'NEON_DATABASE_URL',
  'PAYPAL_CLIENT_ID',
  'PAYPAL_CLIENT_SECRET',
  'PAYPAL_WEBHOOK_ID',
];

const requiredDomains = [
  'legendmural.com',
  'www.legendmural.com',
];

test('guarded Production update is manual-only, main-only and commit-pinned', () => {
  assert.match(workflow, /workflow_dispatch:/);
  assert.match(workflow, /DEPLOY_GUARDED_P3_PREPARATION_ONLY/);
  assert.match(workflow, /refs\/heads\/main/);
  assert.match(workflow, /EXPECTED_COMMIT/);
  assert.match(workflow, /GITHUB_SHA/);
  assert.doesNotMatch(workflow, /\bpush:/);
  assert.doesNotMatch(workflow, /\bpull_request:/);
});

test('guarded Production update performs preflight, dry-run, one real deploy and postdeploy verification', () => {
  const deployCommands = workflow.match(/command: deploy --env production/g) || [];
  assert.equal(deployCommands.length, 1);
  assert.match(workflow, /verify-cloudflare-production-guarded-update\.mjs preflight/);
  assert.match(workflow, /wrangler@4\.129\.0 deploy[\s\S]*--env production[\s\S]*--dry-run/);
  assert.match(workflow, /verify-cloudflare-production-guarded-update\.mjs postdeploy/);
  assert.ok(workflow.indexOf('preflight') < workflow.indexOf('--dry-run'));
  assert.ok(workflow.indexOf('--dry-run') < workflow.indexOf('command: deploy --env production'));
  assert.ok(workflow.indexOf('command: deploy --env production') < workflow.indexOf('postdeploy'));
});

test('guarded Production update cannot mutate DNS, routes, secrets, R2 objects or provider state explicitly', () => {
  assert.doesNotMatch(workflow, /wrangler[^\n]*(?:secret|route|delete|rollback)/i);
  assert.doesNotMatch(workflow, /r2\s+object\s+(?:put|delete)/i);
  assert.doesNotMatch(workflow, /r2\s+bucket\s+(?:create|delete)/i);
  assert.doesNotMatch(workflow, /(?:PAYPAL|NEON|RESEND)_[A-Z_]+:\s*\$\{\{/);
  assert.doesNotMatch(workflow, /curl[^\n]*(?:POST|PUT|PATCH|DELETE)/i);
});

test('repository Production config remains guarded and pins the exact Custom Domains', () => {
  const production = config.env.production;
  const vars = production.vars;
  assert.equal(vars.LEGENDMURAL_DEPLOY_CONTEXT, 'production');
  assert.equal(vars.LEGENDMURAL_CHECKOUT_PAUSED, 'true');
  assert.equal(vars.PAYPAL_ALLOW_LIVE, 'true');
  assert.equal(vars.P3_TEST_CHECKOUT_ENABLED, 'false');
  assert.equal(vars.ORDER_EMAILS_ENABLED, 'false');
  assert.equal(vars.V3_PROFILE1_ORDER_CREATION_ENABLED, 'false');
  assert.equal(vars.V3_INVOICE_RECONCILIATION_ENABLED, 'false');
  assert.equal(vars.V3_INVOICE_STORAGE_ENABLED, 'false');
  assert.equal(vars.V3_DASHBOARD_INVOICE_API_ENABLED, 'false');
  assert.equal(production.workers_dev, false);
  assert.equal(production.preview_urls, false);
  assert.deepEqual(production.routes, requiredDomains.map((pattern) => ({
    pattern,
    custom_domain: true,
  })));
});

test('remote verifier is GET-only, checks exact Custom Domains and required secret names without secret values', () => {
  const methods = [...verifier.matchAll(/method:\s*'([A-Z]+)'/g)].map((match) => match[1]);
  assert.deepEqual([...new Set(methods)], ['GET']);
  for (const secret of requiredSecrets) {
    assert.ok(verifier.includes(`'${secret}'`));
  }
  for (const hostname of requiredDomains) {
    assert.ok(verifier.includes(`'${hostname}'`));
  }
  assert.match(verifier, /workers\/domains\?\$\{query\.toString\(\)\}/);
  assert.match(verifier, /service:\s*PROD_WORKER/);
  assert.match(verifier, /workers\/scripts\/\$\{encodeURIComponent\(PROD_WORKER\)\}\/secrets/);
  assert.match(verifier, /P3_TEST_CHECKOUT_ENABLED/);
  assert.match(verifier, /PAYPAL_ALLOW_LIVE: 'true'/);
  assert.doesNotMatch(verifier, /clientSecret\s*[:=]\s*['"][^'"]+['"]/i);
});

test('live proof after deployment only performs a GET and requires checkout paused', () => {
  assert.match(workflow, /fetch\('https:\/\/legendmural\.com\/api\/paypal\/checkout'/);
  assert.match(workflow, /method: 'GET'/);
  assert.match(workflow, /response\.status !== 503/);
  assert.match(workflow, /CHECKOUT_PAUSED/);
});
