import { appendFile } from 'node:fs/promises';

const API_BASE = 'https://api.cloudflare.com/client/v4';
const PROD_R2_BUCKET = 'legendmural-v3-invoice-pdfs-prod';

const accountId = String(process.env.CLOUDFLARE_ACCOUNT_ID || '').trim();
const apiToken = String(process.env.CLOUDFLARE_API_TOKEN || '').trim();

if (!/^[a-f0-9]{32}$/i.test(accountId)) {
  throw new Error('CLOUDFLARE_ACCOUNT_ID is missing or invalid after trimming.');
}
if (!apiToken) {
  throw new Error('CLOUDFLARE_API_TOKEN is missing.');
}

async function apiRequest(pathname, { method = 'GET', body } = {}) {
  const response = await fetch(`${API_BASE}${pathname}`, {
    method,
    headers: {
      Authorization: `Bearer ${apiToken}`,
      Accept: 'application/json',
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });

  const text = await response.text();
  let payload = null;
  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      throw new Error(`Cloudflare returned non-JSON for ${method} ${pathname} (HTTP ${response.status}).`);
    }
  }

  return { status: response.status, payload };
}

function requireSuccess(result, label) {
  if (result.status < 200 || result.status >= 300 || result.payload?.success !== true) {
    const codes = Array.isArray(result.payload?.errors)
      ? result.payload.errors.map((entry) => entry?.code).filter(Boolean).join(',')
      : '';
    throw new Error(`${label} failed (HTTP ${result.status}${codes ? `; Cloudflare code(s) ${codes}` : ''}).`);
  }
  return result.payload?.result;
}

function enabledCustomDomains(result) {
  const domains = Array.isArray(result?.domains) ? result.domains : [];
  return domains
    .filter((entry) => entry?.enabled === true)
    .map((entry) => String(entry?.domain || ''))
    .filter(Boolean)
    .sort();
}

const encodedBucket = encodeURIComponent(PROD_R2_BUCKET);
const bucketPath = `/accounts/${accountId}/r2/buckets/${encodedBucket}`;
const current = await apiRequest(bucketPath);

let action = 'already-existed';
if (current.status === 404) {
  const created = await apiRequest(`/accounts/${accountId}/r2/buckets`, {
    method: 'POST',
    body: { name: PROD_R2_BUCKET },
  });
  requireSuccess(created, 'Production R2 bucket creation');
  action = 'created';
} else {
  requireSuccess(current, 'Production R2 bucket preflight');
}

const verifiedBucket = await apiRequest(bucketPath);
requireSuccess(verifiedBucket, 'Production R2 bucket verification');

const managed = requireSuccess(
  await apiRequest(`${bucketPath}/domains/managed`),
  'Production R2 managed-domain verification',
);
const custom = requireSuccess(
  await apiRequest(`${bucketPath}/domains/custom`),
  'Production R2 custom-domain verification',
);

const managedR2DevEnabled = managed?.enabled === true;
const enabledDomains = enabledCustomDomains(custom);
const publicExposureDetected = managedR2DevEnabled || enabledDomains.length > 0;

if (publicExposureDetected) {
  throw new Error('Production R2 bucket exists but public exposure is enabled. No automatic mutation is authorized; stop for owner review.');
}

const summary = {
  scope: 'Production R2 bucket-only bootstrap',
  bucket: PROD_R2_BUCKET,
  action,
  exists: true,
  managedR2DevEnabled,
  enabledCustomDomains: enabledDomains,
  publicExposureDetected,
  objectWritesPerformed: false,
  workerDeployPerformed: false,
  dnsChangesPerformed: false,
  secretChangesPerformed: false,
};

console.log('[cloudflare-production-r2-bootstrap] safe summary:');
console.log(JSON.stringify(summary, null, 2));

if (process.env.GITHUB_STEP_SUMMARY) {
  const lines = [
    '## LegendMural Cloudflare Production R2 bootstrap',
    '',
    `- Bucket: ${PROD_R2_BUCKET}`,
    `- Action: ${action}`,
    '- Bucket exists: true',
    `- r2.dev public access enabled: ${String(managedR2DevEnabled)}`,
    `- Enabled custom domains: ${enabledDomains.join(', ') || 'none'}`,
    `- Public exposure detected: ${String(publicExposureDetected)}`,
    '- R2 object writes: none',
    '- Worker deploy: none',
    '- DNS changes: none',
    '- Cloudflare secret changes: none',
    '',
    'The only permitted account mutation in this workflow is creation of the exact Production R2 bucket when it is absent.',
  ];
  await appendFile(process.env.GITHUB_STEP_SUMMARY, `${lines.join('\n')}\n`, 'utf8');
}
