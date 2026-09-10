import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const workflow = fs.readFileSync('.github/workflows/cloudflare-dns-readonly-inventory.yml', 'utf8');
const script = fs.readFileSync('scripts/inventory-cloudflare-cutover-dns.mjs', 'utf8');

test('DNS inventory workflow is read-only and uses no secrets', () => {
  assert.match(workflow, /permissions:\s*\n\s*contents: read/);
  assert.doesNotMatch(workflow, /secrets\./i);
  assert.doesNotMatch(workflow, /CLOUDFLARE_API_TOKEN|CLOUDFLARE_ACCOUNT_ID|NETLIFY_AUTH_TOKEN/i);
  assert.doesNotMatch(workflow, /wrangler\s+deploy|netlify\s+deploy|curl\s+.*(?:-X|--request)\s*(?:POST|PUT|PATCH|DELETE)/i);
});

test('DNS inventory script is constrained to public GET-only observation', () => {
  assert.match(script, /https:\/\/dns\.google\/resolve/);
  assert.match(script, /https:\/\/crt\.sh\//);
  assert.match(script, /https:\/\/\$\{DOMAIN\}\//);
  assert.match(script, /https:\/\/www\.\$\{DOMAIN\}\//);
  assert.doesNotMatch(script, /method:\s*['"](?:POST|PUT|PATCH|DELETE)['"]/i);
  assert.doesNotMatch(script, /authorization|bearer|api[_-]?key|secret/i);
  assert.match(script, /mutationPerformed:\s*false/);
  assert.match(script, /credentialsUsed:\s*false/);
});

test('DNS inventory covers cutover-critical records and Resend candidates', () => {
  for (const token of [
    "['apex_ns', DOMAIN, 'NS']",
    "['apex_a', DOMAIN, 'A']",
    "['apex_aaaa', DOMAIN, 'AAAA']",
    "['apex_mx', DOMAIN, 'MX']",
    "['apex_txt', DOMAIN, 'TXT']",
    "['www_cname', `www.${DOMAIN}`, 'CNAME']",
    "['_dmarc.${DOMAIN}`",
    "resend._domainkey.${DOMAIN}`",
    "send.${DOMAIN}`",
  ]) {
    assert.ok(script.includes(token), `missing inventory coverage token: ${token}`);
  }
});

test('DNS inventory reports TTLs, certificate-discovered subdomains and public hosting evidence', () => {
  assert.match(script, /ttl:\s*Number\(record\.TTL/);
  assert.match(script, /discoverCertificateNames/);
  assert.match(script, /inventoryCertificateNames/);
  assert.match(script, /publicNetlifyServingEvidence/);
  assert.match(script, /publicCloudflareServingEvidence/);
  assert.match(script, /internal Netlify dashboard domain-assignment state/);
});
