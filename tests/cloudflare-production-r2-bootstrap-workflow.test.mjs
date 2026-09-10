import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const workflow = await readFile('.github/workflows/cloudflare-production-r2-bootstrap.yml', 'utf8');
const provisioner = await readFile('scripts/provision-cloudflare-production-r2.mjs', 'utf8');

const BUCKET = 'legendmural-v3-invoice-pdfs-prod';
const CONFIRM = 'CREATE_PRODUCTION_R2_BUCKET_ONLY';

test('Production R2 bootstrap requires exact manual owner confirmation', () => {
  assert.match(workflow, /workflow_dispatch:/);
  assert.match(workflow, new RegExp(CONFIRM));
  assert.match(workflow, /if: github\.event_name == 'workflow_dispatch'/);
});

test('Production R2 bootstrap keeps GitHub permissions read-only', () => {
  assert.match(workflow, /permissions:\s*\n\s+contents: read/);
});

test('Production R2 bootstrap uses only established Cloudflare credentials', () => {
  assert.match(workflow, /secrets\.CLOUDFLARE_API_TOKEN/);
  assert.match(workflow, /secrets\.CLOUDFLARE_ACCOUNT_ID/);
  for (const forbidden of [
    'PAYPAL_CLIENT_SECRET',
    'PAYPAL_CLIENT_ID',
    'PAYPAL_WEBHOOK_ID',
    'NEON_DATABASE_URL',
    'RESEND_API_KEY',
    'LEGENDMURAL_DASHBOARD_INVOICE_TOKEN',
  ]) {
    assert.doesNotMatch(workflow, new RegExp(forbidden));
  }
});

test('provisioner is fixed to the one intended Production R2 bucket', () => {
  assert.match(provisioner, new RegExp(BUCKET));
  assert.doesNotMatch(provisioner, /legendmural-v3-invoice-pdfs-preview/);
});

test('the only permitted mutation is one POST to the R2 bucket collection', () => {
  const postMethods = provisioner.match(/method:\s*'POST'/g) || [];
  assert.equal(postMethods.length, 1);
  assert.match(provisioner, /apiRequest\(`\/accounts\/\$\{accountId\}\/r2\/buckets`,\s*\{\s*\n\s*method: 'POST'/);

  for (const forbiddenMethod of ['PUT', 'PATCH', 'DELETE']) {
    assert.doesNotMatch(provisioner, new RegExp(`method:\\s*'${forbiddenMethod}'`));
  }
});

test('workflow cannot deploy Workers, write R2 objects, change DNS, or change secrets', () => {
  const combined = `${workflow}\n${provisioner}`;
  for (const forbidden of [
    /wrangler[^\n]*deploy/i,
    /workers\/scripts/i,
    /\/zones\//i,
    /\/dns_records/i,
    /\/objects\//i,
    /\/secrets(?:\b|\/)/i,
    /r2 object put/i,
  ]) {
    assert.doesNotMatch(combined, forbidden);
  }
});

test('provisioner verifies the bucket exists and remains non-public', () => {
  assert.match(provisioner, /domains\/managed/);
  assert.match(provisioner, /domains\/custom/);
  assert.match(provisioner, /publicExposureDetected/);
  assert.match(provisioner, /if \(publicExposureDetected\)/);
  assert.match(provisioner, /No automatic mutation is authorized/);
});

test('provisioner performs no object write and reports the safety boundary', () => {
  assert.match(provisioner, /objectWritesPerformed: false/);
  assert.match(provisioner, /workerDeployPerformed: false/);
  assert.match(provisioner, /dnsChangesPerformed: false/);
  assert.match(provisioner, /secretChangesPerformed: false/);
});
