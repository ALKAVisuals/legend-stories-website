import { appendFile } from 'node:fs/promises';

const API_BASE = 'https://api.cloudflare.com/client/v4';
const PROD_WORKER = 'legendmural-cloudflare-production';
const PROD_R2_BUCKET = 'legendmural-v3-invoice-pdfs-prod';

const EXPECTED_FLAGS = Object.freeze({
  LEGENDMURAL_DEPLOY_CONTEXT: 'production',
  LEGENDMURAL_CHECKOUT_PAUSED: 'true',
  PAYPAL_ALLOW_LIVE: 'false',
  ORDER_EMAILS_ENABLED: 'false',
  V3_PROFILE1_ORDER_CREATION_ENABLED: 'false',
  V3_INVOICE_RECONCILIATION_ENABLED: 'false',
  V3_INVOICE_STORAGE_ENABLED: 'false',
  V3_DASHBOARD_INVOICE_API_ENABLED: 'false',
});

const EXPECTED_SECRET_NAMES = Object.freeze([
  'LEGENDMURAL_DASHBOARD_INVOICE_TOKEN',
  'NEON_DATABASE_URL',
  'PAYPAL_CLIENT_ID',
  'PAYPAL_CLIENT_SECRET',
  'PAYPAL_WEBHOOK_ID',
  'RESEND_API_KEY',
]);

const accountId = String(process.env.CLOUDFLARE_ACCOUNT_ID || '').trim();
const apiToken = String(process.env.CLOUDFLARE_API_TOKEN || '').trim();

if (!/^[a-f0-9]{32}$/i.test(accountId)) {
  throw new Error('CLOUDFLARE_ACCOUNT_ID is missing or invalid after trimming.');
}
if (!apiToken) {
  throw new Error('CLOUDFLARE_API_TOKEN is missing.');
}

async function apiGet(pathname) {
  const response = await fetch(`${API_BASE}${pathname}`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${apiToken}`,
      Accept: 'application/json',
    },
  });

  const text = await response.text();
  let body = null;
  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      throw new Error(`Cloudflare returned non-JSON for read-only GET ${pathname} (HTTP ${response.status}).`);
    }
  }

  return { status: response.status, body };
}

function isNotFound(result) {
  return result.status === 404;
}

function requireSuccess(result, label) {
  if (result.status < 200 || result.status >= 300 || result.body?.success !== true) {
    const codes = Array.isArray(result.body?.errors)
      ? result.body.errors.map((entry) => entry?.code).filter(Boolean).join(',')
      : '';
    throw new Error(`${label} read failed (HTTP ${result.status}${codes ? `; Cloudflare code(s) ${codes}` : ''}).`);
  }
  return result.body?.result;
}

function bindingArray(settings) {
  return Array.isArray(settings?.bindings) ? settings.bindings : [];
}

function extractPlainFlags(settings) {
  const output = {};
  for (const binding of bindingArray(settings)) {
    if (binding?.type !== 'plain_text') continue;
    if (!Object.hasOwn(EXPECTED_FLAGS, binding?.name)) continue;
    output[binding.name] = String(binding.text ?? '');
  }
  return output;
}

function extractR2Bindings(settings) {
  return bindingArray(settings)
    .filter((binding) => binding?.type === 'r2_bucket')
    .map((binding) => ({
      name: String(binding.name || ''),
      bucket: String(binding.bucket_name || binding.bucketName || ''),
    }))
    .filter((binding) => binding.name || binding.bucket);
}

function secretNamesFrom(result) {
  if (!Array.isArray(result)) return [];
  return [...new Set(result.map((entry) => String(entry?.name || '')).filter(Boolean))].sort();
}

function customDomainsFrom(result) {
  const domains = Array.isArray(result?.domains) ? result.domains : [];
  return domains
    .map((entry) => ({ domain: String(entry?.domain || ''), enabled: entry?.enabled === true }))
    .filter((entry) => entry.domain)
    .sort((a, b) => a.domain.localeCompare(b.domain));
}

const summary = {
  scope: 'read-only Production account inventory',
  productionWorker: {
    name: PROD_WORKER,
    exists: false,
    expectedFailClosedFlags: EXPECTED_FLAGS,
    observedFailClosedFlags: {},
    failClosedFlagsProven: false,
    r2Bindings: [],
    secretNamesPresent: [],
    expectedSecretNames: EXPECTED_SECRET_NAMES,
  },
  productionR2: {
    name: PROD_R2_BUCKET,
    exists: false,
    managedR2DevEnabled: null,
    customDomains: [],
    publicExposureDetected: null,
  },
};

const workerSettingsResponse = await apiGet(`/accounts/${accountId}/workers/scripts/${encodeURIComponent(PROD_WORKER)}/settings`);
if (!isNotFound(workerSettingsResponse)) {
  const settings = requireSuccess(workerSettingsResponse, 'Production Worker settings');
  summary.productionWorker.exists = true;
  summary.productionWorker.observedFailClosedFlags = extractPlainFlags(settings);
  summary.productionWorker.failClosedFlagsProven = Object.entries(EXPECTED_FLAGS)
    .every(([name, expected]) => summary.productionWorker.observedFailClosedFlags[name] === expected);
  summary.productionWorker.r2Bindings = extractR2Bindings(settings);

  const secretsResponse = await apiGet(`/accounts/${accountId}/workers/scripts/${encodeURIComponent(PROD_WORKER)}/secrets`);
  const secrets = requireSuccess(secretsResponse, 'Production Worker secret-name inventory');
  summary.productionWorker.secretNamesPresent = secretNamesFrom(secrets);
}

const bucketResponse = await apiGet(`/accounts/${accountId}/r2/buckets/${encodeURIComponent(PROD_R2_BUCKET)}`);
if (!isNotFound(bucketResponse)) {
  requireSuccess(bucketResponse, 'Production R2 bucket inventory');
  summary.productionR2.exists = true;

  const managedDomainResponse = await apiGet(`/accounts/${accountId}/r2/buckets/${encodeURIComponent(PROD_R2_BUCKET)}/domains/managed`);
  const managedDomain = requireSuccess(managedDomainResponse, 'Production R2 managed-domain inventory');
  summary.productionR2.managedR2DevEnabled = managedDomain?.enabled === true;

  const customDomainsResponse = await apiGet(`/accounts/${accountId}/r2/buckets/${encodeURIComponent(PROD_R2_BUCKET)}/domains/custom`);
  const customDomains = requireSuccess(customDomainsResponse, 'Production R2 custom-domain inventory');
  summary.productionR2.customDomains = customDomainsFrom(customDomains);
  summary.productionR2.publicExposureDetected = summary.productionR2.managedR2DevEnabled
    || summary.productionR2.customDomains.some((entry) => entry.enabled);
}

console.log('[cloudflare-production-inventory] safe summary (no secret values):');
console.log(JSON.stringify(summary, null, 2));

if (process.env.GITHUB_STEP_SUMMARY) {
  const lines = [
    '## LegendMural Cloudflare Production account inventory',
    '',
    '- Mode: read-only GET requests only',
    `- Production Worker: ${summary.productionWorker.exists ? 'exists' : 'not configured'}`,
    `- Production Worker name: ${PROD_WORKER}`,
    `- Fail-closed flags proven from remote settings: ${summary.productionWorker.exists ? String(summary.productionWorker.failClosedFlagsProven) : 'not applicable (Worker absent)'}`,
    `- Production secret names present: ${summary.productionWorker.exists ? (summary.productionWorker.secretNamesPresent.join(', ') || 'none') : 'not applicable (Worker absent)'}`,
    `- Production R2 bucket: ${summary.productionR2.exists ? 'exists' : 'not configured'}`,
    `- Production R2 bucket name: ${PROD_R2_BUCKET}`,
    `- r2.dev public access: ${summary.productionR2.exists ? String(summary.productionR2.managedR2DevEnabled) : 'not applicable (bucket absent)'}`,
    `- Enabled R2 custom domains: ${summary.productionR2.exists ? (summary.productionR2.customDomains.filter((entry) => entry.enabled).map((entry) => entry.domain).join(', ') || 'none') : 'not applicable (bucket absent)'}`,
    `- Public R2 exposure detected: ${summary.productionR2.exists ? String(summary.productionR2.publicExposureDetected) : 'not applicable (bucket absent)'}`,
    '',
    'No secret values are printed. No POST, PUT, PATCH or DELETE requests are used.',
  ];
  await appendFile(process.env.GITHUB_STEP_SUMMARY, `${lines.join('\n')}\n`, 'utf8');
}
