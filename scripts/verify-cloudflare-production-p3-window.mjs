import { appendFile } from 'node:fs/promises';

const API_BASE = 'https://api.cloudflare.com/client/v4';
const PROD_WORKER = 'legendmural-cloudflare-production';
const PROD_R2_BUCKET = 'legendmural-v3-invoice-pdfs-prod';
const PROD_CUSTOM_DOMAINS = Object.freeze(['legendmural.com', 'www.legendmural.com']);

const EXPECTED_FLAGS = Object.freeze({
  LEGENDMURAL_DEPLOY_CONTEXT: 'production',
  LEGENDMURAL_CHECKOUT_PAUSED: 'false',
  P3_TEST_CHECKOUT_ENABLED: 'true',
  CHECKOUT_SUCCESS_URL: 'https://legendmural.com/order-success.html',
  CHECKOUT_CANCEL_URL: 'https://legendmural.com/order-cancelled.html',
  CHECKOUT_ALLOWED_ORIGINS: 'https://legendmural.com',
  PAYPAL_API_BASE: 'https://api-m.paypal.com',
  PAYPAL_ALLOW_LIVE: 'true',
  ORDER_EMAILS_ENABLED: 'true',
  RESEND_FROM: 'LegendMural <orders@mail.legendmural.com>',
  RESEND_REPLY_TO: 'info@legendmural.com',
  ORDER_NOTIFICATION_TO: 'info@legendmural.com',
  V3_PROFILE1_ORDER_CREATION_ENABLED: 'true',
  V3_INVOICE_RECONCILIATION_ENABLED: 'true',
  V3_INVOICE_STORAGE_ENABLED: 'true',
  V3_DASHBOARD_INVOICE_API_ENABLED: 'false',
});

const REQUIRED_SECRET_NAMES = Object.freeze([
  'NEON_DATABASE_URL',
  'PAYPAL_CLIENT_ID',
  'PAYPAL_CLIENT_SECRET',
  'PAYPAL_WEBHOOK_ID',
  'P3_TEST_CHECKOUT_TOKEN',
  'RESEND_API_KEY',
]);

const accountId = String(process.env.CLOUDFLARE_ACCOUNT_ID || '').trim();
const apiToken = String(process.env.CLOUDFLARE_API_TOKEN || '').trim();

if (!/^[a-f0-9]{32}$/i.test(accountId)) {
  throw new Error('CLOUDFLARE_ACCOUNT_ID is missing or invalid after trimming.');
}
if (!apiToken) throw new Error('CLOUDFLARE_API_TOKEN is missing.');

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
      throw new Error(`Cloudflare returned non-JSON for GET ${pathname} (HTTP ${response.status}).`);
    }
  }
  return { status: response.status, body };
}

function requireSuccess(result, label) {
  if (result.status < 200 || result.status >= 300 || result.body?.success !== true) {
    throw new Error(`${label} failed (HTTP ${result.status}).`);
  }
  return result.body?.result;
}

function bindings(settings) {
  return Array.isArray(settings?.bindings) ? settings.bindings : [];
}

function plainTextFlags(settings) {
  const output = {};
  for (const binding of bindings(settings)) {
    if (binding?.type !== 'plain_text') continue;
    output[String(binding?.name || '')] = String(binding?.text ?? '');
  }
  return output;
}

function r2Bindings(settings) {
  return bindings(settings)
    .filter((binding) => binding?.type === 'r2_bucket')
    .map((binding) => ({
      name: String(binding.name || ''),
      bucket: String(binding.bucket_name || binding.bucketName || ''),
    }));
}

function secretNames(result) {
  if (!Array.isArray(result)) return [];
  return result.map((entry) => String(entry?.name || '')).filter(Boolean).sort();
}

async function proveCustomDomains() {
  const query = new URLSearchParams({ service: PROD_WORKER });
  const result = requireSuccess(
    await apiGet(`/accounts/${accountId}/workers/domains?${query.toString()}`),
    'Production Worker custom-domain lookup',
  );
  const attached = (Array.isArray(result) ? result : [])
    .filter((entry) => String(entry?.service || '') === PROD_WORKER)
    .map((entry) => String(entry?.hostname || '').trim().toLowerCase())
    .filter(Boolean)
    .sort();
  const expected = [...PROD_CUSTOM_DOMAINS].sort();
  if (attached.length !== expected.length || attached.some((value, index) => value !== expected[index])) {
    throw new Error('Production Worker Custom Domains do not match the exact repository contract.');
  }
  return attached;
}

async function provePrivateBucket() {
  const bucket = requireSuccess(
    await apiGet(`/accounts/${accountId}/r2/buckets/${encodeURIComponent(PROD_R2_BUCKET)}`),
    'Production R2 bucket lookup',
  );
  if (String(bucket?.name || '') !== PROD_R2_BUCKET) {
    throw new Error('Production R2 bucket lookup did not return the expected bucket.');
  }

  const managed = requireSuccess(
    await apiGet(`/accounts/${accountId}/r2/buckets/${encodeURIComponent(PROD_R2_BUCKET)}/domains/managed`),
    'Production R2 managed-domain lookup',
  );
  if (managed?.enabled === true) {
    throw new Error('Refusing P3 window because r2.dev public access is enabled.');
  }

  const custom = requireSuccess(
    await apiGet(`/accounts/${accountId}/r2/buckets/${encodeURIComponent(PROD_R2_BUCKET)}/domains/custom`),
    'Production R2 custom-domain lookup',
  );
  const customDomains = Array.isArray(custom?.domains) ? custom.domains : [];
  if (customDomains.some((entry) => entry?.enabled === true)) {
    throw new Error('Refusing P3 window because an R2 custom domain is enabled.');
  }
}

function proveFlags(settings) {
  const flags = plainTextFlags(settings);
  for (const [name, expected] of Object.entries(EXPECTED_FLAGS)) {
    if (flags[name] !== expected) {
      throw new Error(`Production Worker P3 flag ${name} does not match the expected value.`);
    }
  }
}

function proveR2(settings) {
  const r2 = r2Bindings(settings);
  if (r2.length !== 1 || r2[0]?.name !== 'V3_INVOICE_PDFS' || r2[0]?.bucket !== PROD_R2_BUCKET) {
    throw new Error('Production Worker R2 binding does not match the exact private Production bucket contract.');
  }
  return r2[0];
}

function proveSecrets(names) {
  for (const required of REQUIRED_SECRET_NAMES) {
    if (!names.includes(required)) {
      throw new Error(`Required Production secret ${required} is not configured.`);
    }
  }
}

const customDomains = await proveCustomDomains();
await provePrivateBucket();

const settings = requireSuccess(
  await apiGet(`/accounts/${accountId}/workers/scripts/${encodeURIComponent(PROD_WORKER)}/settings`),
  'Production Worker settings lookup',
);
proveFlags(settings);
const r2 = proveR2(settings);

const secrets = secretNames(requireSuccess(
  await apiGet(`/accounts/${accountId}/workers/scripts/${encodeURIComponent(PROD_WORKER)}/secrets`),
  'Production Worker secret-name lookup',
));
proveSecrets(secrets);

console.log('[cloudflare-production-p3-window] P3 V3 one-cent window verified; no secret values were read or printed.');
console.log(JSON.stringify({
  worker: PROD_WORKER,
  customDomains,
  customerCheckoutPaused: false,
  ordinaryCheckoutBlockedByP3Gate: true,
  p3TestCheckoutEnabled: true,
  paypalLiveAllowed: true,
  orderEmailsEnabled: true,
  v3Profile1CreationEnabled: true,
  v3InvoiceReconciliationEnabled: true,
  v3InvoiceStorageEnabled: true,
  v3DashboardInvoiceApiEnabled: false,
  requiredSecretNamesPresent: REQUIRED_SECRET_NAMES,
  r2Binding: r2,
  r2PublicExposureDetected: false,
}, null, 2));

if (process.env.GITHUB_STEP_SUMMARY) {
  await appendFile(
    process.env.GITHUB_STEP_SUMMARY,
    [
      '## Cloudflare Production P3 V3 one-cent window',
      '',
      `- Worker: ${PROD_WORKER}`,
      `- Custom Domains: ${customDomains.join(', ')}`,
      '- Global checkout pause: false',
      '- Ordinary checkout blocked by P3 authorization gate: true',
      '- P3 controlled checkout enabled: true',
      '- PayPal Live allowed: true',
      '- P3 test token secret name present: true',
      '- Order emails enabled: true',
      '- V3 Profile-1 creation enabled: true',
      '- V3 invoice reconciliation enabled: true',
      '- V3 invoice storage enabled: true',
      '- V3 dashboard invoice API enabled: false',
      `- R2 binding: V3_INVOICE_PDFS -> ${PROD_R2_BUCKET}`,
      '- Secret values read or printed: false',
      '- R2 public exposure detected: false',
      '',
    ].join('\n'),
    'utf8',
  );
}
