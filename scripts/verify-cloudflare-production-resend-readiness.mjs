const API_BASE = 'https://api.cloudflare.com/client/v4';
const PROD_WORKER = 'legendmural-cloudflare-production';

const EXPECTED_RESEND_CONFIG = Object.freeze({
  ORDER_EMAILS_ENABLED: 'false',
  RESEND_FROM: 'LegendMural <orders@mail.legendmural.com>',
  RESEND_REPLY_TO: 'info@legendmural.com',
  ORDER_NOTIFICATION_TO: 'info@legendmural.com',
});

const REQUIRED_SECRET_NAME = 'RESEND_API_KEY';

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

function plainTextBindings(settings) {
  const values = {};
  for (const binding of bindings(settings)) {
    if (binding?.type !== 'plain_text') continue;
    values[String(binding?.name || '')] = String(binding?.text ?? '');
  }
  return values;
}

function secretNames(result) {
  if (!Array.isArray(result)) return [];
  return result.map((entry) => String(entry?.name || '')).filter(Boolean).sort();
}

const settings = requireSuccess(
  await apiGet(`/accounts/${accountId}/workers/scripts/${encodeURIComponent(PROD_WORKER)}/settings`),
  'Production Worker settings lookup',
);
const vars = plainTextBindings(settings);

for (const [name, expected] of Object.entries(EXPECTED_RESEND_CONFIG)) {
  if (vars[name] !== expected) {
    throw new Error(`Production Worker ${name} does not match the guarded Resend readiness contract.`);
  }
}

const secrets = secretNames(requireSuccess(
  await apiGet(`/accounts/${accountId}/workers/scripts/${encodeURIComponent(PROD_WORKER)}/secrets`),
  'Production Worker secret-name lookup',
));
if (!secrets.includes(REQUIRED_SECRET_NAME)) {
  throw new Error(`Required Production secret ${REQUIRED_SECRET_NAME} is not configured.`);
}

console.log('[cloudflare-production-resend-readiness] passed; no email was sent and no secret value was read or printed.');
console.log(JSON.stringify({
  worker: PROD_WORKER,
  orderEmailsEnabled: false,
  resendFrom: EXPECTED_RESEND_CONFIG.RESEND_FROM,
  resendReplyTo: EXPECTED_RESEND_CONFIG.RESEND_REPLY_TO,
  orderNotificationTo: EXPECTED_RESEND_CONFIG.ORDER_NOTIFICATION_TO,
  requiredSecretNamePresent: REQUIRED_SECRET_NAME,
  emailSent: false,
  secretValuesReadOrPrinted: false,
}, null, 2));
