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

const mode = String(process.argv[2] || '').trim().toLowerCase();
if (!['preflight', 'postdeploy'].includes(mode)) {
  throw new Error('Usage: node scripts/verify-cloudflare-production-worker-bootstrap.mjs <preflight|postdeploy>');
}

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
      throw new Error(`Cloudflare returned non-JSON for GET ${pathname} (HTTP ${response.status}).`);
    }
  }
  return { status: response.status, body };
}

function requireSuccess(result, label) {
  if (result.status < 200 || result.status >= 300 || result.body?.success !== true) {
    const codes = Array.isArray(result.body?.errors)
      ? result.body.errors.map((entry) => entry?.code).filter(Boolean).join(',')
      : '';
    throw new Error(`${label} failed (HTTP ${result.status}${codes ? `; Cloudflare code(s) ${codes}` : ''}).`);
  }
  return result.body?.result;
}

function bindings(settings) {
  return Array.isArray(settings?.bindings) ? settings.bindings : [];
}

function observedFlags(settings) {
  const output = {};
  for (const binding of bindings(settings)) {
    if (binding?.type !== 'plain_text') continue;
    if (!Object.hasOwn(EXPECTED_FLAGS, binding?.name)) continue;
    output[binding.name] = String(binding.text ?? '');
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
    throw new Error('Refusing Production Worker bootstrap because r2.dev public access is enabled.');
  }

  const custom = requireSuccess(
    await apiGet(`/accounts/${accountId}/r2/buckets/${encodeURIComponent(PROD_R2_BUCKET)}/domains/custom`),
    'Production R2 custom-domain lookup',
  );
  const customDomains = Array.isArray(custom?.domains) ? custom.domains : [];
  if (customDomains.some((entry) => entry?.enabled === true)) {
    throw new Error('Refusing Production Worker bootstrap because an R2 custom domain is enabled.');
  }
}

if (mode === 'preflight') {
  await provePrivateBucket();
  const worker = await apiGet(`/accounts/${accountId}/workers/scripts/${encodeURIComponent(PROD_WORKER)}/settings`);
  if (worker.status !== 404) {
    if (worker.status >= 200 && worker.status < 300 && worker.body?.success === true) {
      throw new Error(`Refusing create-only bootstrap because Production Worker ${PROD_WORKER} already exists.`);
    }
    requireSuccess(worker, 'Production Worker preflight lookup');
  }

  console.log(`[cloudflare-production-worker-bootstrap] preflight passed: ${PROD_WORKER} absent; private Production R2 bucket proven.`);
  if (process.env.GITHUB_STEP_SUMMARY) {
    await appendFile(
      process.env.GITHUB_STEP_SUMMARY,
      [
        '## Production Worker bootstrap preflight',
        '',
        `- Worker: ${PROD_WORKER}`,
        '- Worker exists before bootstrap: false',
        `- Production R2 bucket: ${PROD_R2_BUCKET}`,
        '- R2 public exposure detected: false',
        '- Account checks used GET requests only',
        '',
      ].join('\n'),
      'utf8',
    );
  }
} else {
  await provePrivateBucket();
  const settings = requireSuccess(
    await apiGet(`/accounts/${accountId}/workers/scripts/${encodeURIComponent(PROD_WORKER)}/settings`),
    'Production Worker settings verification',
  );

  const flags = observedFlags(settings);
  for (const [name, expected] of Object.entries(EXPECTED_FLAGS)) {
    if (flags[name] !== expected) {
      throw new Error(`Production Worker flag ${name} is not fail-closed as expected.`);
    }
  }

  const r2 = r2Bindings(settings);
  if (r2.length !== 1 || r2[0]?.name !== 'V3_INVOICE_PDFS' || r2[0]?.bucket !== PROD_R2_BUCKET) {
    throw new Error('Production Worker R2 binding does not match the exact private Production bucket contract.');
  }

  const secrets = secretNames(requireSuccess(
    await apiGet(`/accounts/${accountId}/workers/scripts/${encodeURIComponent(PROD_WORKER)}/secrets`),
    'Production Worker secret-name verification',
  ));
  if (secrets.length !== 0) {
    throw new Error('Production Worker bootstrap must not configure any application secrets.');
  }

  console.log('[cloudflare-production-worker-bootstrap] post-deploy verification passed (no secret values read or printed).');
  console.log(JSON.stringify({
    worker: PROD_WORKER,
    exists: true,
    failClosedFlagsProven: true,
    r2Binding: r2[0],
    productionSecretNamesPresent: [],
    r2PublicExposureDetected: false,
  }, null, 2));

  if (process.env.GITHUB_STEP_SUMMARY) {
    await appendFile(
      process.env.GITHUB_STEP_SUMMARY,
      [
        '## LegendMural fail-closed Production Worker bootstrap',
        '',
        `- Worker: ${PROD_WORKER}`,
        '- Worker exists after bootstrap: true',
        '- All fail-closed flags proven from remote settings: true',
        `- R2 binding: V3_INVOICE_PDFS -> ${PROD_R2_BUCKET}`,
        '- Production application secrets configured by bootstrap: none',
        '- Production R2 public exposure detected: false',
        '- DNS/custom domain changes: none',
        '- PayPal Live / Resend / Neon Production activation: none',
        '',
      ].join('\n'),
      'utf8',
    );
  }
}
