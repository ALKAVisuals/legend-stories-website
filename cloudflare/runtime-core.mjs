import { createNeonOrderStore } from '../server/adapters/neon-order-store.mjs';
import { createNeonPayPalCaptureStore } from '../server/adapters/neon-paypal-capture-store.mjs';
import { createNeonPayPalWebhookStore } from '../server/adapters/neon-paypal-webhook-store.mjs';
import { createNeonPaidOrderFinalizer } from '../server/adapters/neon-paid-order-finalizer.mjs';
import { recordPayPalWebhookEventInTransaction } from '../server/adapters/neon-paypal-webhook-event-recorder.mjs';

let cachedConnectionString = '';
let cachedStoreFactory = null;
let cachedOrderStore = null;

export class CloudflareCommerceConfigurationError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'CloudflareCommerceConfigurationError';
    this.code = code;
  }
}

export class CloudflareV3OrderCreationProfileError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'CloudflareV3OrderCreationProfileError';
    this.code = code;
  }
}

function enabled(value) {
  return String(value || '').trim().toLowerCase() === 'true';
}

function hasNumberingPolicy(policy) {
  return Boolean(policy
    && typeof policy.resolveSeriesKey === 'function'
    && typeof policy.format === 'function');
}

function hasCompletePaidFinalizationConfig(config) {
  return Boolean(config?.enabled === true
    && hasNumberingPolicy(config.numberingPolicy)
    && typeof config.documentContextProvider === 'function');
}

function createDefaultCommerceOrderStore({ connectionString }) {
  const orderStore = createNeonOrderStore({ connectionString });
  const paypalCaptureStore = createNeonPayPalCaptureStore({ connectionString });
  const paypalWebhookStore = createNeonPayPalWebhookStore({ connectionString });
  return Object.freeze({
    ...orderStore,
    ...paypalCaptureStore,
    ...paypalWebhookStore,
  });
}

export function resetCloudflareCommerceRuntimeCache() {
  cachedConnectionString = '';
  cachedStoreFactory = null;
  cachedOrderStore = null;
}

export function getCloudflareCommerceOrderStore({
  env = process.env,
  storeFactory = createDefaultCommerceOrderStore,
} = {}) {
  const connectionString = String(env.NEON_DATABASE_URL || '').trim();
  if (!connectionString) {
    throw new CloudflareCommerceConfigurationError(
      'NEON_DATABASE_URL_MISSING',
      'The commerce database is not configured.',
    );
  }
  if (typeof storeFactory !== 'function') {
    throw new CloudflareCommerceConfigurationError(
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
    throw new CloudflareCommerceConfigurationError(
      'NEON_DATABASE_URL_INVALID',
      'The commerce database configuration is invalid.',
    );
  }

  cachedConnectionString = connectionString;
  cachedStoreFactory = storeFactory;
  cachedOrderStore = orderStore;
  return cachedOrderStore;
}

export function resolveCloudflareOrderCreationDocumentProfile({
  env = process.env,
  v3PaidFinalization = null,
} = {}) {
  if (!enabled(env?.V3_PROFILE1_ORDER_CREATION_ENABLED)) return 0;
  if (!String(env?.NEON_DATABASE_URL || '').trim()
    || !hasCompletePaidFinalizationConfig(v3PaidFinalization)) {
    throw new CloudflareV3OrderCreationProfileError(
      'V3_ORDER_CREATION_NOT_CONFIGURED',
      'Profile-1 order creation requires complete server-side V3 paid-finalization configuration.',
    );
  }
  return 1;
}

export function createCloudflareV3PaidFinalizationRuntime({
  env = process.env,
  config = null,
  finalizerFactory = createNeonPaidOrderFinalizer,
  providerEventRecorder = recordPayPalWebhookEventInTransaction,
} = {}) {
  if (config?.enabled !== true) return null;
  if (!hasNumberingPolicy(config.numberingPolicy)
    || typeof config.documentContextProvider !== 'function'
    || typeof finalizerFactory !== 'function'
    || typeof providerEventRecorder !== 'function') {
    return null;
  }
  const connectionString = String(env.NEON_DATABASE_URL || '').trim();
  if (!connectionString) return null;

  let runtime;
  try {
    runtime = finalizerFactory({
      connectionString,
      numberingPolicy: config.numberingPolicy,
      documentContextProvider: config.documentContextProvider,
      providerEventRecorder,
    });
  } catch {
    return null;
  }
  if (typeof runtime?.finalizePaidOrder !== 'function') return null;
  return runtime.finalizePaidOrder.bind(runtime);
}
