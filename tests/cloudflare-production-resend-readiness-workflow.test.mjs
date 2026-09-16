import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const workflow = await readFile('.github/workflows/cloudflare-production-resend-readiness.yml', 'utf8');
const verifier = await readFile('scripts/verify-cloudflare-production-resend-readiness.mjs', 'utf8');
const config = JSON.parse(await readFile('wrangler.jsonc', 'utf8'));

const expectedVars = Object.freeze({
  ORDER_EMAILS_ENABLED: 'true',
  RESEND_FROM: 'LegendMural <orders@mail.legendmural.com>',
  RESEND_REPLY_TO: 'info@legendmural.com',
  ORDER_NOTIFICATION_TO: 'info@legendmural.com',
});

test('Resend readiness workflow is manual-only and read-only', () => {
  assert.match(workflow, /workflow_dispatch:/);
  assert.match(workflow, /VERIFY_RESEND_READINESS_READ_ONLY/);
  assert.doesNotMatch(workflow, /\bpush:/);
  assert.doesNotMatch(workflow, /\bpull_request:/);
  assert.match(workflow, /permissions:\s*\n\s*contents: read/);
  assert.doesNotMatch(workflow, /wrangler[^\n]*(?:deploy|secret|route|delete|rollback)/i);
  assert.doesNotMatch(workflow, /curl[^\n]*(?:POST|PUT|PATCH|DELETE)/i);
});

test('Production config pins Resend sender metadata with order email delivery enabled', () => {
  const vars = config.env.production.vars;
  for (const [name, expected] of Object.entries(expectedVars)) {
    assert.equal(vars[name], expected);
  }
  assert.equal(Object.hasOwn(vars, 'RESEND_API_KEY'), false);
});

test('remote readiness verifier uses GET only and checks exact non-secret Resend contract', () => {
  const methods = [...verifier.matchAll(/method:\s*'([A-Z]+)'/g)].map((match) => match[1]);
  assert.deepEqual([...new Set(methods)], ['GET']);
  assert.match(verifier, /RESEND_API_KEY/);
  assert.match(verifier, /ORDER_EMAILS_ENABLED: 'false'/);
  assert.match(verifier, /RESEND_FROM: 'LegendMural <orders@mail\.legendmural\.com>'/);
  assert.match(verifier, /RESEND_REPLY_TO: 'info@legendmural\.com'/);
  assert.match(verifier, /ORDER_NOTIFICATION_TO: 'info@legendmural\.com'/);
  assert.match(verifier, /workers\/scripts\/\$\{encodeURIComponent\(PROD_WORKER\)\}\/settings/);
  assert.match(verifier, /workers\/scripts\/\$\{encodeURIComponent\(PROD_WORKER\)\}\/secrets/);
  assert.doesNotMatch(verifier, /console\.log\(text\)|console\.log\(body\)|console\.log\(settings\)|console\.log\(secrets\)/);
  assert.match(verifier, /no email was sent and no secret value was read or printed/);
});
