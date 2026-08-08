import { createNeonOrderStore } from '../adapters/neon-order-store.mjs';
import { createNeonPayPalCaptureStore } from '../adapters/neon-paypal-capture-store.mjs';

let cachedConnectionString = '';
let cachedStoreFactory = null;
let cachedOrderStore = null;

export class NetlifyCommerceConfigurationError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'NetlifyCommerceConfigurationError';
    this.code = code;
  }
}

function configurationFailure(code, message) {
  throw new NetlifyCommerceConfigurationError(code, message);
}

export function resetCommerceRuntimeCache() {
  cachedConnectionString = '';
  cachedStoreFactory = null;
  cachedOrderStore = null;
}

function createDefaultCommerceOrderStore({ connectionString }) {
  const orderStore = createNeonOrderStore({ connectionString });
  const paypalCaptureStore = createNeonPayPalCaptureStore({ connectionString });
  return Object.freeze({
    ...orderStore,
    ...paypalCaptureStore,
  });
}

export function getCommerceOrderStore({
  env = process.env,
  storeFactory = createDefaultCommerceOrderStore,
} = {}) {
  const connectionString = String(env.NEON_DATABASE_URL || '').trim();
  if (!connectionString) {
    configurationFailure(
      'NEON_DATABASE_URL_MISSING',
      'The commerce database is not configured.',
    );
  }
  if (typeof storeFactory !== 'function') {
    configurationFailure(
      'ORDER_STORE_FACTORY_INVALID',
      'The commerce database adapter is unavailable.',
    );
  }

  if (cachedOrderStore
    && cachedConnectionString === connectionString
    && cachedStoreFactory === storeFactory) {
    return cachedOrderStore;
  }

  let orderStore;
  try {
    orderStore = storeFactory({ connectionString });
  } catch {
    configurationFailure(
      'NEON_DATABASE_URL_INVALID',
      'The commerce database configuration is invalid.',
    );
  }

  cachedConnectionString = connectionString;
  cachedStoreFactory = storeFactory;
  cachedOrderStore = orderStore;
  return cachedOrderStore;
}

function responseHeaders() {
  return {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'Content-Security-Policy': "default-src 'none'; frame-ancestors 'none'",
    'X-Content-Type-Options': 'nosniff',
  };
}

export function commerceBootstrapErrorResponse(error, {
  code = 'COMMERCE_SERVICE_NOT_CONFIGURED',
  message = 'The secure checkout service is not configured.',
} = {}) {
  if (!(error instanceof NetlifyCommerceConfigurationError)) return null;
  return new Response(JSON.stringify({ error: { code, message } }), {
    status: 503,
    headers: responseHeaders(),
  });
}

export function unexpectedCommerceFunctionResponse(code, message) {
  return new Response(JSON.stringify({ error: { code, message } }), {
    status: 500,
    headers: responseHeaders(),
  });
}
