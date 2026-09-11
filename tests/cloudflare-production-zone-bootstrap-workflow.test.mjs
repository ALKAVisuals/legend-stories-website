import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const workflowPath = new URL('../.github/workflows/cloudflare-production-zone-bootstrap.yml', import.meta.url);
const scriptPath = new URL('../scripts/bootstrap-cloudflare-production-zone.mjs', import.meta.url);

const workflow = await readFile(workflowPath, 'utf8');
const script = await readFile(scriptPath, 'utf8');

test('zone bootstrap is manual-only for mutation and requires the exact confirmation phrase', () => {
  assert.match(workflow, /workflow_dispatch:/);
  assert.match(workflow, /CREATE_LEGENDMURAL_ZONE_AND_PRESERVE_DNS_ONLY/);
  assert.match(workflow, /if:\s*github\.event_name == 'workflow_dispatch'/);
  assert.match(workflow, /CLOUDFLARE_API_TOKEN: \$\{\{ secrets\.CLOUDFLARE_API_TOKEN \}\}/);
  assert.match(workflow, /CLOUDFLARE_ACCOUNT_ID: \$\{\{ secrets\.CLOUDFLARE_ACCOUNT_ID \}\}/);
});

test('production zone bootstrap script is create-only and cannot alter delegation, Worker routing or existing DNS records', () => {
  assert.match(script, /apiRequest\('\/zones', 'POST'/);
  assert.match(script, /apiRequest\(`\/zones\/\$\{zoneId\}\/dns_records`, 'POST'/);
  assert.doesNotMatch(script, /'PUT'/);
  assert.doesNotMatch(script, /'PATCH'/);
  assert.doesNotMatch(script, /'DELETE'/);
  assert.doesNotMatch(script, /registrar/i);
  assert.doesNotMatch(script, /workers\/domains`, 'POST'/);
  assert.doesNotMatch(script, /workers\/routes/i);
});

test('zone bootstrap freezes the exact eight preserved mail/service records and TTL contract', () => {
  const recordStarts = [...script.matchAll(/\{\n\s+name: '[^']+',\n\s+type: '(?:TXT|MX|CNAME)'/g)];
  assert.equal(recordStarts.length, 8);

  for (const value of [
    'resend._domainkey.mail.legendmural.com',
    'send.mail.legendmural.com',
    '_dmarc.legendmural.com',
    'autodiscover.legendmural.com',
    'email.legendmural.com',
    'legendmural-com.mail.protection.outlook.com',
    'feedback-smtp.eu-west-1.amazonses.com',
  ]) {
    assert.match(script, new RegExp(value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }

  assert.match(script, /priority: 10/);
  assert.match(script, /priority: 0/);
  assert.match(script, /ttl: 3600/g);
});

test('fresh preflight refuses drift before the first Production DNS write', () => {
  for (const value of [
    'dns1.p01.nsone.net',
    'dns2.p01.nsone.net',
    'dns3.p01.nsone.net',
    'dns4.p01.nsone.net',
    'LEGENDMURAL_CHECKOUT_PAUSED',
    'PAYPAL_ALLOW_LIVE',
    'ORDER_EMAILS_ENABLED',
    'V3_PROFILE1_ORDER_CREATION_ENABLED',
    'V3_INVOICE_RECONCILIATION_ENABLED',
    'V3_INVOICE_STORAGE_ENABLED',
    'V3_DASHBOARD_INVOICE_API_ENABLED',
  ]) {
    assert.match(script, new RegExp(value));
  }

  assert.match(script, /A public DS record appeared before zone creation/);
  assert.match(script, /already exists in the intended Cloudflare account/);
  assert.match(script, /Production Worker application secret inventory is no longer empty/);
  assert.match(script, /Production Worker already has Custom Domains/);
  assert.match(script, /Production R2 r2\.dev public exposure is enabled/);
});
