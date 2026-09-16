import { appendFile } from 'node:fs/promises';

const API_BASE = 'https://api.cloudflare.com/client/v4';
const PUBLIC_DNS_API = 'https://dns.google/resolve';
const PROD_ZONE = 'legendmural.com';
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

async function publicDnsGet(type) {
  const url = new URL(PUBLIC_DNS_API);
  url.searchParams.set('name', PROD_ZONE);
  url.searchParams.set('type', type);
  url.searchParams.set('do', '1');
  const response = await fetch(url, {
    method: 'GET',
    headers: { Accept: 'application/dns-json' },
  });
  const text = await response.text();
  let body = null;
  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      throw new Error(`Public DNS returned non-JSON for ${PROD_ZONE}/${type} (HTTP ${response.status}).`);
    }
  }
  if (!response.ok || Number(body?.Status) !== 0) {
    throw new Error(`Public DNS ${PROD_ZONE}/${type} read failed (HTTP ${response.status}; DNS status ${body?.Status ?? 'unknown'}).`);
  }
  return body;
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

function r2CustomDomainsFrom(result) {
  const domains = Array.isArray(result?.domains) ? result.domains : [];
  return domains
    .map((entry) => ({ domain: String(entry?.domain || ''), enabled: entry?.enabled === true }))
    .filter((entry) => entry.domain)
    .sort((a, b) => a.domain.localeCompare(b.domain));
}

function workerCustomDomainsFrom(result) {
  if (!Array.isArray(result)) return [];
  return result
    .filter((entry) => String(entry?.service || '') === PROD_WORKER)
    .map((entry) => ({
      hostname: String(entry?.hostname || ''),
      service: String(entry?.service || ''),
      environment: String(entry?.environment || ''),
    }))
    .filter((entry) => entry.hostname)
    .sort((a, b) => a.hostname.localeCompare(b.hostname));
}

function zoneSummaryFrom(result) {
  if (!Array.isArray(result)) return null;
  const exact = result.filter((entry) => String(entry?.name || '').toLowerCase() === PROD_ZONE);
  if (exact.length > 1) {
    throw new Error(`Cloudflare returned multiple exact ${PROD_ZONE} zones for the scoped account.`);
  }
  if (exact.length === 0) return null;
  const zone = exact[0];
  return {
    name: String(zone?.name || ''),
    status: String(zone?.status || ''),
    paused: zone?.paused === true,
    accountMatches: String(zone?.account?.id || '') === accountId,
    nameServers: Array.isArray(zone?.name_servers)
      ? zone.name_servers.map((value) => String(value || '')).filter(Boolean).sort()
      : [],
  };
}

function normalizeDnsName(value) {
  return String(value || '').trim().toLowerCase().replace(/\.$/, '');
}

function dnsAnswerData(body, typeCode) {
  const answers = Array.isArray(body?.Answer) ? body.Answer : [];
  return answers
    .filter((entry) => Number(entry?.type) === typeCode)
    .map((entry) => String(entry?.data || '').trim())
    .filter(Boolean)
    .sort();
}

const summary = {
  scope: 'read-only Production account inventory',
  publicDns: {
    authoritativeNameservers: [],
    dsRecords: [],
    dsPresent: false,
    dnssecAuthenticatedData: false,
  },
  productionZone: {
    name: PROD_ZONE,
    existsInAccount: false,
    status: null,
    paused: null,
    accountMatches: false,
    nameServers: [],
  },
  productionWorker: {
    name: PROD_WORKER,
    exists: false,
    expectedFailClosedFlags: EXPECTED_FLAGS,
    observedFailClosedFlags: {},
    failClosedFlagsProven: false,
    r2Bindings: [],
    secretNamesPresent: [],
    expectedSecretNames: EXPECTED_SECRET_NAMES,
    customDomains: [],
  },
  productionR2: {
    name: PROD_R2_BUCKET,
    exists: false,
    managedR2DevEnabled: null,
    customDomains: [],
    publicExposureDetected: null,
  },
};

const nsDns = await publicDnsGet('NS');
summary.publicDns.authoritativeNameservers = dnsAnswerData(nsDns, 2).map(normalizeDnsName);
const dsDns = await publicDnsGet('DS');
summary.publicDns.dsRecords = dnsAnswerData(dsDns, 43);
summary.publicDns.dsPresent = summary.publicDns.dsRecords.length > 0;
summary.publicDns.dnssecAuthenticatedData = dsDns.AD === true;

const zoneResponse = await apiGet(`/zones?name=${encodeURIComponent(PROD_ZONE)}&account.id=${encodeURIComponent(accountId)}&per_page=50`);
const zoneResult = requireSuccess(zoneResponse, 'Production zone inventory');
const zone = zoneSummaryFrom(zoneResult);
if (zone) {
  summary.productionZone.existsInAccount = true;
  summary.productionZone.status = zone.status;
  summary.productionZone.paused = zone.paused;
  summary.productionZone.accountMatches = zone.accountMatches;
  summary.productionZone.nameServers = zone.nameServers;
}

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

const workerDomainsResponse = await apiGet(`/accounts/${accountId}/workers/domains`);
const workerDomains = requireSuccess(workerDomainsResponse, 'Production Worker custom-domain inventory');
summary.productionWorker.customDomains = workerCustomDomainsFrom(workerDomains);

const bucketResponse = await apiGet(`/accounts/${accountId}/r2/buckets/${encodeURIComponent(PROD_R2_BUCKET)}`);
if (!isNotFound(bucketResponse)) {
  requireSuccess(bucketResponse, 'Production R2 bucket inventory');
  summary.productionR2.exists = true;

  const managedDomainResponse = await apiGet(`/accounts/${accountId}/r2/buckets/${encodeURIComponent(PROD_R2_BUCKET)}/domains/managed`);
  const managedDomain = requireSuccess(managedDomainResponse, 'Production R2 managed-domain inventory');
  summary.productionR2.managedR2DevEnabled = managedDomain?.enabled === true;

  const customDomainsResponse = await apiGet(`/accounts/${accountId}/r2/buckets/${encodeURIComponent(PROD_R2_BUCKET)}/domains/custom`);
  const customDomains = requireSuccess(customDomainsResponse, 'Production R2 custom-domain inventory');
  summary.productionR2.customDomains = r2CustomDomainsFrom(customDomains);
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
    `- Public authoritative nameservers: ${summary.publicDns.authoritativeNameservers.join(', ') || 'none'}`,
    `- Public DS records present: ${String(summary.publicDns.dsPresent)}`,
    `- Public DS record count: ${summary.publicDns.dsRecords.length}`,
    `- Production zone ${PROD_ZONE}: ${summary.productionZone.existsInAccount ? 'exists in scoped account' : 'not present in scoped account'}`,
    `- Production zone status: ${summary.productionZone.status || 'not applicable'}`,
    `- Production zone paused: ${summary.productionZone.existsInAccount ? String(summary.productionZone.paused) : 'not applicable'}`,
    `- Production zone account match: ${summary.productionZone.existsInAccount ? String(summary.productionZone.accountMatches) : 'not applicable'}`,
    `- Production zone assigned nameservers: ${summary.productionZone.nameServers.join(', ') || 'none'}`,
    `- Production Worker: ${summary.productionWorker.exists ? 'exists' : 'not configured'}`,
    `- Production Worker name: ${PROD_WORKER}`,
    `- Fail-closed flags proven from remote settings: ${summary.productionWorker.exists ? String(summary.productionWorker.failClosedFlagsProven) : 'not applicable (Worker absent)'}`,
    `- Production secret names present: ${summary.productionWorker.exists ? (summary.productionWorker.secretNamesPresent.join(', ') || 'none') : 'not applicable (Worker absent)'}`,
    `- Production Worker custom domains: ${summary.productionWorker.customDomains.map((entry) => entry.hostname).join(', ') || 'none'}`,
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
