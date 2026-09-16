import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const WORKFLOW_PATH = '.github/workflows/netlify-production-source-build-proof.yml';
const VERIFIER_PATH = 'scripts/verify-netlify-production-source-build.mjs';
const EXPECTED_SOURCE_SHA = '95a57e8f05a0af547efa0dfc4d044b8a96de7fe3';

const [workflow, verifier] = await Promise.all([
  readFile(WORKFLOW_PATH, 'utf8'),
  readFile(VERIFIER_PATH, 'utf8'),
]);

test('proof is pinned to the exact current Netlify Production source commit', () => {
  assert.match(workflow, new RegExp(EXPECTED_SOURCE_SHA));
  assert.match(verifier, new RegExp(EXPECTED_SOURCE_SHA));
  assert.match(workflow, /node-version:\s*22/);
});

test('proof has read-only repository permissions and no provider credentials', () => {
  assert.match(workflow, /permissions:\s*\n\s+contents:\s*read/);
  assert.doesNotMatch(workflow, /\$\{\{\s*secrets\./i);
  assert.doesNotMatch(workflow, /NETLIFY_AUTH_TOKEN|NETLIFY_ACCESS_TOKEN|CLOUDFLARE_API_TOKEN|CLOUDFLARE_ACCOUNT_ID|PAYPAL_CLIENT_SECRET|DATABASE_URL|RESEND_API_KEY/i);
});

test('proof cannot deploy or mutate Netlify, Cloudflare, DNS, or GitHub refs', () => {
  const forbidden = [
    /\bnetlify\s+deploy\b/i,
    /\bwrangler\s+deploy\b/i,
    /\bwrangler\s+versions\s+deploy\b/i,
    /\bcurl\b[^\n]*(?:netlify\.com|cloudflare\.com|api\.github\.com)/i,
    /\bgit\s+push\b/i,
    /\bgh\s+api\b/i,
    /\bPOST\b|\bPUT\b|\bPATCH\b|\bDELETE\b/,
  ];
  for (const pattern of forbidden) {
    assert.doesNotMatch(workflow, pattern);
  }
});

test('HTTP serving proof is localhost-only', () => {
  assert.match(workflow, /127\.0\.0\.1:4173/);
  const curlLines = workflow.split('\n').filter((line) => /\bcurl\b/.test(line));
  assert.ok(curlLines.length > 0, 'Expected localhost curl probes.');
  for (const line of curlLines) {
    assert.match(line, /127\.0\.0\.1/);
    assert.doesNotMatch(line, /https?:\/\/(?!127\.0\.0\.1)/);
  }
});

test('proof verifies the expected static rollback artifact files', () => {
  for (const path of ['index.html', 'shop.html', 'robots.txt', 'sitemap.xml', 'js/commerce/runtime-config.mjs']) {
    assert.match(verifier, new RegExp(path.replaceAll('.', '\\.').replaceAll('/', '\\/')));
  }
  assert.match(verifier, /publishDirectory:\s*'dist'/);
  assert.match(verifier, /mutationPerformed:\s*false/);
  assert.match(verifier, /providerCredentialsUsed:\s*false/);
});
