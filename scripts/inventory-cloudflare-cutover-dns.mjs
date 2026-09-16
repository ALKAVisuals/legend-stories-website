const DOMAIN = 'legendmural.com';
const DNS_ENDPOINT = 'https://dns.google/resolve';
const CRT_SH_ENDPOINT = `https://crt.sh/?q=%25.${DOMAIN}&output=json`;
const CERTSPOTTER_ENDPOINT = `https://api.certspotter.com/v1/issuances?domain=${DOMAIN}&include_subdomains=true&expand=dns_names`;

const CORE_QUERIES = Object.freeze([
  ['apex_ns', DOMAIN, 'NS'],
  ['apex_cname', DOMAIN, 'CNAME'],
  ['apex_a', DOMAIN, 'A'],
  ['apex_aaaa', DOMAIN, 'AAAA'],
  ['apex_mx', DOMAIN, 'MX'],
  ['apex_txt', DOMAIN, 'TXT'],
  ['apex_soa', DOMAIN, 'SOA'],
  ['www_cname', `www.${DOMAIN}`, 'CNAME'],
  ['www_a', `www.${DOMAIN}`, 'A'],
  ['www_aaaa', `www.${DOMAIN}`, 'AAAA'],
  ['dmarc_txt', `_dmarc.${DOMAIN}`, 'TXT'],
  ['m365_selector1_dkim_cname', `selector1._domainkey.${DOMAIN}`, 'CNAME'],
  ['m365_selector1_dkim_txt', `selector1._domainkey.${DOMAIN}`, 'TXT'],
  ['m365_selector2_dkim_cname', `selector2._domainkey.${DOMAIN}`, 'CNAME'],
  ['m365_selector2_dkim_txt', `selector2._domainkey.${DOMAIN}`, 'TXT'],
  ['resend_dkim_txt', `resend._domainkey.${DOMAIN}`, 'TXT'],
  ['resend_dkim_cname', `resend._domainkey.${DOMAIN}`, 'CNAME'],
  ['resend_send_mx', `send.${DOMAIN}`, 'MX'],
  ['resend_send_txt', `send.${DOMAIN}`, 'TXT'],
  ['resend_send_cname', `send.${DOMAIN}`, 'CNAME'],
]);

const SAFE_HTTP_HEADERS = Object.freeze([
  'server',
  'location',
  'x-nf-request-id',
  'netlify-vary',
  'cache-status',
  'cf-ray',
  'age',
  'via',
]);

function normalizedAnswers(payload = {}) {
  return (payload.Answer || []).map((record) => ({
    name: String(record.name || ''),
    type: Number(record.type || 0),
    ttl: Number(record.TTL || 0),
    data: String(record.data || ''),
  }));
}

async function dnsQuery(label, name, type) {
  const url = new URL(DNS_ENDPOINT);
  url.searchParams.set('name', name);
  url.searchParams.set('type', type);
  const response = await fetch(url, {
    headers: { Accept: 'application/dns-json' },
  });
  if (!response.ok) {
    throw new Error(`DNS HTTP ${response.status} for ${name}/${type}`);
  }
  const payload = await response.json();
  return {
    label,
    name,
    type,
    dnsStatus: Number(payload.Status),
    authenticatedData: Boolean(payload.AD),
    answers: normalizedAnswers(payload),
  };
}

function normalizeCertificateName(value) {
  const normalized = String(value || '')
    .trim()
    .toLowerCase()
    .replace(/^\*\./, '')
    .replace(/\.$/, '');
  if (normalized === DOMAIN || normalized.endsWith(`.${DOMAIN}`)) return normalized;
  return '';
}

function normalizedCertificateNames(values = []) {
  const names = new Set();
  for (const value of values) {
    const normalized = normalizeCertificateName(value);
    if (normalized) names.add(normalized);
  }
  return [...names].sort();
}

async function discoverFromCrtSh() {
  try {
    const response = await fetch(CRT_SH_ENDPOINT, {
      headers: { Accept: 'application/json' },
    });
    if (!response.ok) {
      return { provider: 'crt.sh', ok: false, status: response.status, names: [] };
    }
    const rows = await response.json();
    const candidates = [];
    for (const row of Array.isArray(rows) ? rows : []) {
      candidates.push(...String(row?.name_value || '').split('\n'));
    }
    return {
      provider: 'crt.sh',
      ok: true,
      status: response.status,
      names: normalizedCertificateNames(candidates),
    };
  } catch (error) {
    return {
      provider: 'crt.sh',
      ok: false,
      status: 0,
      names: [],
      error: String(error?.message || error).slice(0, 180),
    };
  }
}

async function discoverFromCertSpotter() {
  try {
    const response = await fetch(CERTSPOTTER_ENDPOINT, {
      headers: { Accept: 'application/json' },
    });
    if (!response.ok) {
      return { provider: 'certspotter', ok: false, status: response.status, names: [] };
    }
    const rows = await response.json();
    const candidates = [];
    for (const row of Array.isArray(rows) ? rows : []) {
      if (Array.isArray(row?.dns_names)) candidates.push(...row.dns_names);
    }
    return {
      provider: 'certspotter',
      ok: true,
      status: response.status,
      names: normalizedCertificateNames(candidates),
    };
  } catch (error) {
    return {
      provider: 'certspotter',
      ok: false,
      status: 0,
      names: [],
      error: String(error?.message || error).slice(0, 180),
    };
  }
}

async function discoverCertificateNames() {
  const [crtSh, certSpotter] = await Promise.all([
    discoverFromCrtSh(),
    discoverFromCertSpotter(),
  ]);
  const names = new Set([DOMAIN, `www.${DOMAIN}`]);
  for (const source of [crtSh, certSpotter]) {
    for (const name of source.names || []) names.add(name);
  }
  return {
    ok: crtSh.ok || certSpotter.ok,
    names: [...names].sort(),
    providers: {
      crtSh,
      certSpotter,
    },
  };
}

async function inventoryCertificateNames(names) {
  const targets = names
    .filter((name) => name !== DOMAIN && name !== `www.${DOMAIN}`)
    .slice(0, 25);
  const results = [];
  for (const name of targets) {
    const records = [];
    for (const type of ['CNAME', 'A', 'AAAA']) {
      try {
        records.push(await dnsQuery(`${name}_${type.toLowerCase()}`, name, type));
      } catch (error) {
        records.push({
          label: `${name}_${type.toLowerCase()}`,
          name,
          type,
          error: String(error?.message || error).slice(0, 180),
        });
      }
    }
    results.push({ name, records });
  }
  return {
    queriedNames: targets.length,
    truncated: names.filter((name) => name !== DOMAIN && name !== `www.${DOMAIN}`).length > targets.length,
    results,
  };
}

async function observeHttps(url) {
  try {
    const response = await fetch(url, {
      redirect: 'manual',
      headers: {
        'user-agent': 'LegendMural-readonly-dns-inventory/1.0',
        accept: 'text/html,application/xhtml+xml',
      },
    });
    const headers = {};
    for (const name of SAFE_HTTP_HEADERS) {
      const value = response.headers.get(name);
      if (value) headers[name] = value;
    }
    try {
      await response.body?.cancel();
    } catch {}
    return {
      url,
      status: response.status,
      headers,
      publicNetlifyServingEvidence: Boolean(
        headers['x-nf-request-id']
          || headers['netlify-vary']
          || String(headers.server || '').toLowerCase().includes('netlify')
      ),
      publicCloudflareServingEvidence: Boolean(
        headers['cf-ray']
          || String(headers.server || '').toLowerCase().includes('cloudflare')
      ),
    };
  } catch (error) {
    return {
      url,
      status: 0,
      headers: {},
      publicNetlifyServingEvidence: false,
      publicCloudflareServingEvidence: false,
      error: String(error?.message || error).slice(0, 180),
    };
  }
}

async function main() {
  const core = [];
  for (const [label, name, type] of CORE_QUERIES) {
    core.push(await dnsQuery(label, name, type));
  }

  const certificateTransparency = await discoverCertificateNames();
  const discoveredSubdomains = certificateTransparency.ok
    ? await inventoryCertificateNames(certificateTransparency.names)
    : { queriedNames: 0, truncated: false, results: [] };

  const https = await Promise.all([
    observeHttps(`https://${DOMAIN}/`),
    observeHttps(`https://www.${DOMAIN}/`),
  ]);

  const result = {
    scope: 'LegendMural Section C read-only DNS inventory',
    domain: DOMAIN,
    observedAt: new Date().toISOString(),
    resolver: DNS_ENDPOINT,
    mutationPerformed: false,
    credentialsUsed: false,
    core,
    certificateTransparency,
    discoveredSubdomains,
    https,
    limitations: [
      'Public DNS and certificate transparency cannot prove every private or unlisted subdomain.',
      'Certificate-transparency providers are best-effort external sources; provider errors are recorded rather than treated as DNS truth.',
      'DKIM selectors are not enumerable through DNS; Microsoft 365 selector1/selector2 and the Resend selector are queried because they are relevant known candidates.',
      'Public HTTP/DNS evidence cannot prove the internal Netlify dashboard domain-assignment state.',
      'No DNS, hosting, provider, secret, Worker, R2 or application mutation is performed by this script.',
    ],
  };

  console.log('LEGENDMURAL_DNS_INVENTORY_BEGIN');
  console.log(JSON.stringify(result, null, 2));
  console.log('LEGENDMURAL_DNS_INVENTORY_END');
}

main().catch((error) => {
  console.error('Read-only DNS inventory failed.', {
    name: String(error?.name || 'Error').slice(0, 120),
    message: String(error?.message || error).slice(0, 240),
  });
  process.exitCode = 1;
});
