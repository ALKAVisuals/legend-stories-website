const TARGETS = Object.freeze([
  { label: 'custom_apex', base: 'https://legendmural.com' },
  { label: 'custom_www', base: 'https://www.legendmural.com' },
  { label: 'netlify_default_site', base: 'https://legendmural.netlify.app' },
  { label: 'netlify_main_branch', base: 'https://main--legendmural.netlify.app' },
  { label: 'netlify_immutable_deploy', base: 'https://6a8d7a5e5b89930b8ea3b5ff--legendmural.netlify.app' },
]);

const PATHS = Object.freeze(['/', '/index.html', '/shop.html', '/robots.txt', '/sitemap.xml']);
const SAFE_HEADERS = Object.freeze([
  'server',
  'location',
  'content-type',
  'cache-control',
  'x-nf-request-id',
  'netlify-vary',
  'age',
  'via',
]);

async function probe(target, path) {
  const url = new URL(path, target.base).toString();
  try {
    const response = await fetch(url, {
      method: 'GET',
      redirect: 'manual',
      headers: {
        accept: 'text/html,application/xhtml+xml,text/plain,application/xml',
        'user-agent': 'LegendMural-netlify-readonly-routing-proof/1.0',
      },
    });

    const headers = {};
    for (const name of SAFE_HEADERS) {
      const value = response.headers.get(name);
      if (value) headers[name] = value;
    }

    let bodyBytesObserved = 0;
    if (response.body) {
      const reader = response.body.getReader();
      const { value } = await reader.read();
      bodyBytesObserved = value?.byteLength || 0;
      await reader.cancel().catch(() => {});
    }

    return {
      label: target.label,
      url,
      status: response.status,
      headers,
      bodyBytesObserved,
      netlifyServingEvidence: Boolean(
        headers['x-nf-request-id']
          || headers['netlify-vary']
          || String(headers.server || '').toLowerCase().includes('netlify')
      ),
    };
  } catch (error) {
    return {
      label: target.label,
      url,
      status: 0,
      headers: {},
      bodyBytesObserved: 0,
      netlifyServingEvidence: false,
      error: String(error?.message || error).slice(0, 200),
    };
  }
}

async function main() {
  const results = [];
  for (const target of TARGETS) {
    for (const path of PATHS) {
      results.push(await probe(target, path));
    }
  }

  const output = {
    scope: 'LegendMural Netlify account routing read-only proof',
    observedAt: new Date().toISOString(),
    activeNetlifyDeployCommit: '95a57e8f05a0af547efa0dfc4d044b8a96de7fe3',
    mutationPerformed: false,
    credentialsUsed: false,
    requests: 'GET only',
    results,
  };

  console.log('LEGENDMURAL_NETLIFY_ROUTING_PROOF_BEGIN');
  console.log(JSON.stringify(output, null, 2));
  console.log('LEGENDMURAL_NETLIFY_ROUTING_PROOF_END');
}

main().catch((error) => {
  console.error('Netlify read-only routing proof failed.', {
    name: String(error?.name || 'Error').slice(0, 120),
    message: String(error?.message || error).slice(0, 240),
  });
  process.exitCode = 1;
});
