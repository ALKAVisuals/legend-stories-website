import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const DEFAULT_TARGET_PATH = resolve('dist/js/commerce/runtime-config.mjs');
const RUNTIME_ORIGIN = 'https://legendmural-runtime.invalid';

export function normalizePublicCommerceEndpoint(value, label = 'commerce endpoint') {
  const source = String(value || '').trim();
  if (!source) return '';

  if (!source.startsWith('/')
    || source.startsWith('//')
    || source.includes('\\')) {
    throw new Error(`${label} must be a same-origin absolute path.`);
  }

  let endpoint;
  try {
    endpoint = new URL(source, RUNTIME_ORIGIN);
  } catch {
    throw new Error(`${label} must be a valid same-origin absolute path.`);
  }

  if (endpoint.origin !== RUNTIME_ORIGIN
    || endpoint.username
    || endpoint.password
    || endpoint.search
    || endpoint.hash) {
    throw new Error(`${label} must not contain another origin, credentials, a query, or a fragment.`);
  }

  return endpoint.pathname;
}

export function createCommerceRuntimeConfig(env = process.env) {
  return Object.freeze({
    hostedCheckoutEndpoint: normalizePublicCommerceEndpoint(
      env.LEGENDMURAL_HOSTED_CHECKOUT_ENDPOINT,
      'LEGENDMURAL_HOSTED_CHECKOUT_ENDPOINT',
    ),
    orderStatusEndpoint: normalizePublicCommerceEndpoint(
      env.LEGENDMURAL_ORDER_STATUS_ENDPOINT,
      'LEGENDMURAL_ORDER_STATUS_ENDPOINT',
    ),
    paypalCaptureEndpoint: normalizePublicCommerceEndpoint(
      env.LEGENDMURAL_PAYPAL_CAPTURE_ENDPOINT,
      'LEGENDMURAL_PAYPAL_CAPTURE_ENDPOINT',
    ),
  });
}

export function renderCommerceRuntimeConfig(config) {
  return `// Generated during deployment. Do not add secrets to this public file.\nexport const COMMERCE_RUNTIME_CONFIG = Object.freeze(${JSON.stringify(config, null, 2)});\n`;
}

export async function writeCommerceRuntimeConfig({
  env = process.env,
  targetPath = DEFAULT_TARGET_PATH,
} = {}) {
  const config = createCommerceRuntimeConfig(env);
  await mkdir(dirname(targetPath), { recursive: true });
  await writeFile(targetPath, renderCommerceRuntimeConfig(config), 'utf8');
  return config;
}

const invokedPath = process.argv[1] ? pathToFileURL(resolve(process.argv[1])).href : '';
if (invokedPath && import.meta.url === invokedPath) {
  const config = await writeCommerceRuntimeConfig();
  const state = config.hostedCheckoutEndpoint ? 'enabled' : 'disabled';
  console.log(`Commerce runtime config generated; hosted checkout is ${state}.`);
}
