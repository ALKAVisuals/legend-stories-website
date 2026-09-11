import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const workflow = fs.readFileSync('.github/workflows/netlify-account-routing-readonly-proof.yml', 'utf8');
const script = fs.readFileSync('scripts/probe-netlify-account-routing-readonly.mjs', 'utf8');

test('workflow is read-only and has no provider credentials', () => {
  assert.match(workflow, /permissions:\s*\n\s*contents: read/);
  assert.doesNotMatch(workflow, /secrets\./i);
  assert.doesNotMatch(workflow, /NETLIFY_AUTH_TOKEN|CLOUDFLARE_API_TOKEN|PAYPAL_CLIENT_SECRET|DATABASE_URL|RESEND_API_KEY/i);
  assert.doesNotMatch(workflow, /netlify\s+deploy|wrangler\s+deploy/i);
});

test('probe uses GET only and declares zero mutation', () => {
  assert.match(script, /method:\s*'GET'/);
  assert.doesNotMatch(script, /method:\s*['"](?:POST|PUT|PATCH|DELETE)['"]/i);
  assert.doesNotMatch(script, /authorization\s*:|bearer\s+|api[_-]?key\s*[:=]|client[_-]?secret\s*[:=]/i);
  assert.match(script, /mutationPerformed:\s*false/);
  assert.match(script, /credentialsUsed:\s*false/);
});

test('probe covers custom domains and all known Netlify serving forms', () => {
  for (const target of [
    'https://legendmural.com',
    'https://www.legendmural.com',
    'https://legendmural.netlify.app',
    'https://main--legendmural.netlify.app',
    'https://6a8d7a5e5b89930b8ea3b5ff--legendmural.netlify.app',
  ]) {
    assert.ok(script.includes(target), `missing target: ${target}`);
  }
  for (const path of ["'/'", "'/index.html'", "'/shop.html'", "'/robots.txt'", "'/sitemap.xml'"]) {
    assert.ok(script.includes(path), `missing path: ${path}`);
  }
});

test('probe is anchored to the current Netlify production commit', () => {
  assert.match(script, /95a57e8f05a0af547efa0dfc4d044b8a96de7fe3/);
  assert.match(script, /redirect:\s*'manual'/);
  assert.match(script, /netlifyServingEvidence/);
});
