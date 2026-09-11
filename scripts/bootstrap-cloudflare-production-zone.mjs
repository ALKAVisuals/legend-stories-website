import { appendFile } from 'node:fs/promises';

const API_BASE = 'https://api.cloudflare.com/client/v4';
const PUBLIC_DNS_API = 'https://dns.google/resolve';
const PROD_ZONE = 'legendmural.com';
const PROD_WORKER = 'legendmural-cloudflare-production';
const PROD_R2_BUCKET = 'legendmural-v3-invoice-pdfs-prod';

const EXPECTED_CURRENT_NS = Object.freeze([
  'dns1.p01.nsone.net',
  'dns2.p01.nsone.net',
  'dns3.p01.nsone.net',
  'dns4.p01.nsone.net',
]);

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

const REQUIRED_DNS_RECORDS = Object.freeze([
  {
    name: 'resend._domainkey.mail.legendmural.com',
    type: 'TXT',
    content: 'p=MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQDXDHlGTc8VvimOh+Hq90jW6Ur6xmT0YEtjtXdNrehBMq+COeZS/2YbiAQu8TbszeQYr9HU8VWp6LuFx1Z/kEAgVlGx/YdxBtlUHb7tzCf0uz1rXqhxcS87gvND4KmfplQtvI2cLcA9aM/tY3k3DYHg/XGRw0lm/qj1kLcvYUUekwIDAQAB',
    ttl: 3600,
  },
  {
    name: 'send.mail.legendmural.com',
    type: 'MX',
    content: 'feedback-smtp.eu-west-1.amazonses.com',
    priority: 10,
    ttl: 3600,
  },
  {
    name: 'send.mail.legendmural.com',
    type: 'TXT',
    content: 'v=spf1 include:amazonses.com ~all',
    ttl: 3600,
  },
  {
    name: '_dmarc.legendmural.com',
    type: 'TXT',
    content: 'v=DMARC1; p=none;',
    ttl: 3600,
  },
  {
    name: 'legendmural.com',
    type: 'TXT',
    content: 'v=spf1 include:secureserver.net -all',
    ttl: 3600,
  },
  {
    name: 'autodiscover.legendmural.com',
    type: 'CNAME',
    content: 'autodiscover.outlook.com',
    proxied: false,
    ttl: 3600,
  },
  {
    name: 'email.legendmural.com',
    type: 'CNAME',
    content: 'email.secureserver.net',
    proxied: false,
    ttl: 3600,
  },
  {
    name: 'legendmural.com',
    type: 'MX',
    content: 'legendmural-com.mail.protection.outlook.com',
    priority: 0,
    ttl: 3600,
  },
]);

const accountId = String(process.env.CLOUDFLARE_ACCOUNT_ID || '').trim();
const apiToken = String(process.env.CLOUDFLARE_API_TOKEN || '').trim();

if (!/^[a-f0-9]{32}$/i.test(accountId)) {
  throw new Error('CLOUDFLARE_ACCOUNT_ID is missing or invalid after trimming.');
}
if (!apiToken) {
  throw new Error('CLOUDFLARE_API_TOKEN is missing.');
}

async function apiRequest(pathname, method = 'GET', body = undefined) {
  const response = await fetch(`${API_BASE}${pathname}`, {
    method,
    headers: {
      Authorization: `Bearer ${apiToken}`,
      Accept: 'application/json',
      ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });

  const text = await response.text();
  let parsed = null;
  if (text) {
    try {
      parsed = JSON.parse(text);
    } catch {
      throw new Error(`Cloudflare returned non-JSON for ${method} ${pathname} (HTTP ${response.status}).`);
    }
  }

  return { status: response.status, body: parsed };
}

function requireSuccess(result, label) {
  if (result.status < 200 || result.status >= 300 || result.body?.success !== true) {
    const details = Array.isArray(result.body?.errors)
      ? result.body.errors.map((entry) => `${entry?.code ?? 'unknown'}:${entry?.message ?? 'unknown'}`).join('; ')
      : '';
    throw new Error(`${label} failed (HTTP ${result.status}${details ? `; ${details}` : ''}).`);
  }
  return result.body?.result;
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
  const body = await response.json();
  if (!response.ok || Number(body?.Status) !== 0) {
    throw new Error(`Public DNS ${PROD_ZONE}/${type} read failed (HTTP ${response.status}; DNS status ${body?.Status ?? 'unknown'}).`);
  }
  return body;
}

function normalizeDnsName(value) {
  return String(value || '').trim().toLowerCase().replace(/\.$/, '');
}

function publicAnswers(body, typeCode) {
  return (Array.isArray(body?.Answer) ? body.Answer : [])
    .filter((entry) => Number(entry?.type) === typeCode)
    .map((entry) => String(entry?.data || '').trim())
    .filter(Boolean);
}

function sorted(values) {
  return [...values].sort((a, b) => a.localeCompare(b));
}

function sameStringSet(actual, expected) {
  return JSON.stringify(sorted(actual)) === JSON.stringify(sorted(expected));
}

function bindings(settings) {
  return Array.isArray(settings?.bindings) ? settings.bindings : [];
}

function assertFailClosedWorker(settings) {
  const observed = {};
  for (const binding of bindings(settings)) {
    if (binding?.type !== 'plain_text' || !Object.hasOwn(EXPECTED_FLAGS, binding?.name)) continue;
    observed[binding.name] = String(binding.text ?? '');
  }
  for (const [name, expected] of Object.entries(EXPECTED_FLAGS)) {
    if (observed[name] !== expected) {
      throw new Error(`Production Worker fail-closed flag ${name} is ${JSON.stringify(observed[name])}; expected ${JSON.stringify(expected)}.`);
    }
  }

  const r2 = bindings(settings).find((binding) => binding?.type === 'r2_bucket' && binding?.name === 'V3_INVOICE_PDFS');
  if (String(r2?.bucket_name || r2?.bucketName || '') !== PROD_R2_BUCKET) {
    throw new Error('Production Worker V3_INVOICE_PDFS binding does not point to the expected private Production R2 bucket.');
  }
}

function zoneByExactName(result) {
  const matches = (Array.isArray(result) ? result : [])
    .filter((entry) => normalizeDnsName(entry?.name) === PROD_ZONE);
  if (matches.length > 1) {
    throw new Error(`Cloudflare returned multiple exact ${PROD_ZONE} zones in the intended account.`);
  }
  return matches[0] || null;
}

function recordContent(record) {
  return normalizeDnsName(record?.content);
}

function requiredContent(record) {
  if (record.type === 'MX' || record.type === 'CNAME') return normalizeDnsName(record.content);
  return String(record.content);
}

function cloudflareRecordMatches(actual, required) {
  if (normalizeDnsName(actual?.name) !== normalizeDnsName(required.name)) return false;
  if (String(actual?.type || '').toUpperCase() !== required.type) return false;
  const actualContent = required.type === 'MX' || required.type === 'CNAME'
    ? recordContent(actual)
    : String(actual?.content ?? '');
  if (actualContent !== requiredContent(required)) return false;
  if (Number(actual?.ttl) !== Number(required.ttl)) return false;
  if (required.type === 'MX' && Number(actual?.priority) !== Number(required.priority)) return false;
  if (required.type === 'CNAME' && actual?.proxied !== false) return false;
  return true;
}

function sameNameAndType(actual, required) {
  return normalizeDnsName(actual?.name) === normalizeDnsName(required.name)
    && String(actual?.type || '').toUpperCase() === required.type;
}

async function freshPreflight() {
  const nsDns = await publicDnsGet('NS');
  const publicNs = publicAnswers(nsDns, 2).map(normalizeDnsName);
  if (!sameStringSet(publicNs, EXPECTED_CURRENT_NS)) {
    throw new Error(`Public authoritative nameservers drifted before zone creation: ${publicNs.join(', ') || 'none'}.`);
  }

  const dsDns = await publicDnsGet('DS');
  const dsRecords = publicAnswers(dsDns, 43);
  if (dsRecords.length !== 0) {
    throw new Error('A public DS record appeared before zone creation. Stop before any Cloudflare Production write.');
  }

  const zones = requireSuccess(
    await apiRequest(`/zones?name=${encodeURIComponent(PROD_ZONE)}&account.id=${encodeURIComponent(accountId)}&per_page=50`),
    'Production zone preflight',
  );
  if (zoneByExactName(zones)) {
    throw new Error(`${PROD_ZONE} already exists in the intended Cloudflare account. Refusing create-only bootstrap because Gate 0 expected absence.`);
  }

  const workerSettings = requireSuccess(
    await apiRequest(`/accounts/${accountId}/workers/scripts/${encodeURIComponent(PROD_WORKER)}/settings`),
    'Production Worker settings preflight',
  );
  assertFailClosedWorker(workerSettings);

  const secrets = requireSuccess(
    await apiRequest(`/accounts/${accountId}/workers/scripts/${encodeURIComponent(PROD_WORKER)}/secrets`),
    'Production Worker secret-name preflight',
  );
  if (Array.isArray(secrets) && secrets.length !== 0) {
    throw new Error('Production Worker application secret inventory is no longer empty. Stop before DNS onboarding.');
  }

  const workerDomains = requireSuccess(
    await apiRequest(`/accounts/${accountId}/workers/domains`),
    'Production Worker Custom Domain preflight',
  );
  const existingWorkerDomains = (Array.isArray(workerDomains) ? workerDomains : [])
    .filter((entry) => String(entry?.service || '') === PROD_WORKER);
  if (existingWorkerDomains.length !== 0) {
    throw new Error('Production Worker already has Custom Domains. Stop before DNS onboarding.');
  }

  requireSuccess(
    await apiRequest(`/accounts/${accountId}/r2/buckets/${encodeURIComponent(PROD_R2_BUCKET)}`),
    'Production R2 bucket preflight',
  );
  const managedDomain = requireSuccess(
    await apiRequest(`/accounts/${accountId}/r2/buckets/${encodeURIComponent(PROD_R2_BUCKET)}/domains/managed`),
    'Production R2 managed-domain preflight',
  );
  if (managedDomain?.enabled === true) {
    throw new Error('Production R2 r2.dev public exposure is enabled. Stop before DNS onboarding.');
  }
  const r2CustomDomains = requireSuccess(
    await apiRequest(`/accounts/${accountId}/r2/buckets/${encodeURIComponent(PROD_R2_BUCKET)}/domains/custom`),
    'Production R2 custom-domain preflight',
  );
  if ((Array.isArray(r2CustomDomains?.domains) ? r2CustomDomains.domains : []).some((entry) => entry?.enabled === true)) {
    throw new Error('Production R2 has an enabled public custom domain. Stop before DNS onboarding.');
  }

  return { publicNs, dsRecords };
}

async function createZone() {
  const result = requireSuccess(
    await apiRequest('/zones', 'POST', {
      name: PROD_ZONE,
      account: { id: accountId },
      type: 'full',
    }),
    'Cloudflare full-zone creation',
  );

  if (!result?.id || normalizeDnsName(result?.name) !== PROD_ZONE || String(result?.account?.id || '') !== accountId) {
    throw new Error('Cloudflare returned an unexpected zone identity after creation.');
  }
  const nameServers = (Array.isArray(result?.name_servers) ? result.name_servers : [])
    .map(normalizeDnsName)
    .filter(Boolean);
  if (nameServers.length !== 2) {
    throw new Error(`Cloudflare did not return exactly two assigned authoritative nameservers; received ${nameServers.length}.`);
  }
  return {
    id: String(result.id),
    status: String(result.status || ''),
    nameServers,
  };
}

async function listDnsRecords(zoneId) {
  return requireSuccess(
    await apiRequest(`/zones/${zoneId}/dns_records?per_page=100`),
    'Cloudflare DNS record inventory',
  );
}

async function ensureRequiredRecord(zoneId, required) {
  const existing = await listDnsRecords(zoneId);
  const sameType = (Array.isArray(existing) ? existing : []).filter((record) => sameNameAndType(record, required));
  const exact = sameType.filter((record) => cloudflareRecordMatches(record, required));
  if (exact.length === 1 && sameType.length === 1) return 'already-exact';
  if (sameType.length !== 0) {
    throw new Error(`Cloudflare already contains a conflicting ${required.type} record at ${required.name}; refusing to overwrite or delete it.`);
  }

  const payload = {
    name: required.name,
    type: required.type,
    content: required.content,
    ttl: required.ttl,
    ...(required.type === 'MX' ? { priority: required.priority } : {}),
    ...(required.type === 'CNAME' ? { proxied: false } : {}),
  };
  requireSuccess(
    await apiRequest(`/zones/${zoneId}/dns_records`, 'POST', payload),
    `Create ${required.type} ${required.name}`,
  );
  return 'created';
}

async function verifyRequiredDns(zoneId) {
  const records = await listDnsRecords(zoneId);
  for (const required of REQUIRED_DNS_RECORDS) {
    const sameType = (Array.isArray(records) ? records : []).filter((record) => sameNameAndType(record, required));
    const exact = sameType.filter((record) => cloudflareRecordMatches(record, required));
    if (sameType.length !== 1 || exact.length !== 1) {
      throw new Error(`Post-write verification failed for ${required.type} ${required.name}.`);
    }
  }
}

const preflight = await freshPreflight();
console.log('[cloudflare-zone-bootstrap] Fresh Gate 0 invariants re-proven.');

const zone = await createZone();
console.log(`[cloudflare-zone-bootstrap] Created pending full zone ${PROD_ZONE} (${zone.id}).`);

const recordResults = [];
for (const required of REQUIRED_DNS_RECORDS) {
  const action = await ensureRequiredRecord(zone.id, required);
  recordResults.push({ name: required.name, type: required.type, action });
}
await verifyRequiredDns(zone.id);

console.log('[cloudflare-zone-bootstrap] Eight frozen mail/service DNS records verified exactly.');
console.log(JSON.stringify({
  zone: PROD_ZONE,
  zoneId: zone.id,
  zoneStatus: zone.status,
  assignedNameservers: zone.nameServers,
  previousPublicNameservers: preflight.publicNs,
  publicDsPresentBeforeWrite: preflight.dsRecords.length > 0,
  records: recordResults,
}, null, 2));

if (process.env.GITHUB_STEP_SUMMARY) {
  const lines = [
    '## LegendMural Cloudflare Production zone bootstrap',
    '',
    `- Zone: ${PROD_ZONE}`,
    `- Zone ID: ${zone.id}`,
    `- Zone status immediately after creation: ${zone.status || 'unknown'}`,
    `- Cloudflare-assigned authoritative nameservers: ${zone.nameServers.join(', ')}`,
    `- Public nameservers before write: ${preflight.publicNs.join(', ')}`,
    '- Public DS record before write: none',
    '- Frozen mail/service DNS records: 8/8 verified exactly',
    '- Registrar nameservers changed: no',
    '- Worker Custom Domains changed: no',
    '- Production Worker deployment changed: no',
    '- PayPal/Resend/Neon/R2 object state changed: no',
    '',
    'Next action requires the separately controlled registrar nameserver change after reviewing this result.',
  ];
  await appendFile(process.env.GITHUB_STEP_SUMMARY, `${lines.join('\n')}\n`, 'utf8');
}
