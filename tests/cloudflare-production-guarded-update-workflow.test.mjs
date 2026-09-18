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
  'RESEND_API_KEY',
];

const requiredDomains = [
  'legendmural.com',
  'www.legendmural.com',
];

test('guarded Production update is manual-only, main-only and commit-pinned', () => {
  assert.match(workflow, /workflow_dispatch:/);
  assert.match(workflow, /DEPLOY_GUARDED_V3_CHECKOUT_LAUNCH/);
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

test('repository Production config temporarily targets the controlled P3 window with V3 invoice delivery enabled', () => {
  const production = config.env.production;
  const vars = production.vars;
  assert.equal(vars.LEGENDMURAL_DEPLOY_CONTEXT, 'production');
  assert.equal(vars.LEGENDMURAL_CHECKOUT_PAUSED, 'false');
  assert.equal(vars.PAYPAL_API_BASE, 'https://api-m.paypal.com');
  assert.equal(vars.PAYPAL_ALLOW_LIVE, 'true');
  assert.equal(vars.P3_TEST_CHECKOUT_ENABLED, 'true');
  assert.equal(vars.ORDER_EMAILS_ENABLED, 'true');
  assert.equal(vars.V3_PROFILE1_ORDER_CREATION_ENABLED, 'true');
  assert.equal(vars.V3_INVOICE_RECONCILIATION_ENABLED, 'true');
  assert.equal(vars.V3_INVOICE_STORAGE_ENABLED, 'true');
  assert.equal(vars.V3_DASHBOARD_INVOICE_API_ENABLED, 'false');
  assert.equal(production.workers_dev, false);
  assert.equal(production.preview_urls, false);
  assert.deepEqual(production.routes, requiredDomains.map((pattern) => ({
    pattern,
    custom_domain: true,
  })));
});

test('remote verifier is GET-only and checks exact Custom Domains plus PayPal Live and email contracts without secret values', () => {
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
  assert.match(verifier, /PAYPAL_API_BASE: 'https:\/\/api-m\.paypal\.com'/);
  assert.match(verifier, /PAYPAL_ALLOW_LIVE: 'true'/);
  assert.match(verifier, /CHECKOUT_SUCCESS_URL: 'https:\/\/legendmural\.com\/order-success\.html'/);
  assert.match(verifier, /CHECKOUT_CANCEL_URL: 'https:\/\/legendmural\.com\/order-cancelled\.html'/);
  assert.match(verifier, /CHECKOUT_ALLOWED_ORIGINS: 'https:\/\/legendmural\.com'/);
  assert.match(verifier, /P3_TEST_CHECKOUT_ENABLED/);
  assert.match(verifier, /RESEND_FROM: 'LegendMural <orders@mail\.legendmural\.com>'/);
  assert.match(verifier, /RESEND_REPLY_TO: 'info@legendmural\.com'/);
  assert.match(verifier, /ORDER_NOTIFICATION_TO: 'info@legendmural\.com'/);
  assert.doesNotMatch(verifier, /clientSecret\s*[:=]\s*['"][^'"]+['"]/i);
});

test('guarded verifier proves paused/V3-off preflight and active/V3-on postdeploy with emails on throughout', () => {
  assert.match(verifier, /const expectedCheckoutPaused = mode === 'preflight' \? 'true' : 'false';/);
  assert.match(verifier, /flags\.LEGENDMURAL_CHECKOUT_PAUSED !== expectedCheckoutPaused/);
  assert.match(verifier, /const expectedOrderEmails = 'true';/);
  assert.match(verifier, /flags\.ORDER_EMAILS_ENABLED !== expectedOrderEmails/);
  assert.match(verifier, /const expectedV3Activation = mode === 'preflight' \? 'false' : 'true';/);
  assert.match(verifier, /V3_PROFILE1_ORDER_CREATION_ENABLED/);
  assert.match(verifier, /V3_INVOICE_RECONCILIATION_ENABLED/);
  assert.match(verifier, /V3_INVOICE_STORAGE_ENABLED/);
  assert.match(workflow, /Customer checkout intended state: active/);
  assert.match(workflow, /Production order emails intended state: enabled/);
  assert.match(workflow, /V3 Profile-1 creation intended state: enabled/);
  assert.match(workflow, /V3 invoice storage intended state: enabled/);
  assert.match(workflow, /V3 invoice reconciliation intended state: enabled/);
});

test('live proof after deployment uses safe OPTIONS and creates no PayPal order', () => {
  assert.match(workflow, /fetch\('https:\/\/legendmural\.com\/api\/paypal\/checkout'/);
  assert.match(workflow, /method: 'OPTIONS'/);
  assert.match(workflow, /Access-Control-Request-Method': 'POST'/);
  assert.match(workflow, /response\.status !== 204/);
  assert.match(workflow, /OPTIONS probe created no PayPal order/);
  assert.doesNotMatch(workflow, /method: 'POST'/);
});
