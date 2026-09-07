import { createNeonOrderStore } from '../server/adapters/neon-order-store.mjs';
import { createNeonPayPalCaptureStore } from '../server/adapters/neon-paypal-capture-store.mjs';
import { createNeonPayPalWebhookStore } from '../server/adapters/neon-paypal-webhook-store.mjs';
import { createNeonPaidOrderFinalizer } from '../server/adapters/neon-paid-order-finalizer.mjs';
import { recordPayPalWebhookEventInTransaction } from '../server/adapters/neon-paypal-webhook-event-recorder.mjs';
import { createNeonOrderNotificationStore } from '../server/adapters/neon-order-notification-store.mjs';
import { createNeonV3InvoiceArtifactStore } from '../server/adapters/neon-v3-invoice-artifact-store.mjs';
import { createNeonV3InvoiceDeliverySource } from '../server/adapters/neon-v3-invoice-delivery-source.mjs';
import { createNeonV3InvoiceReconciliationSource } from '../server/adapters/neon-v3-invoice-reconciliation-source.mjs';
import { createCloudflareR2V3InvoicePdfStore } from '../server/adapters/cloudflare-r2-v3-invoice-pdf-store.mjs';
import { createPaidOrderDeliveryRouter } from '../server/notifications/paid-order-delivery-router.mjs';
import { deliverPaidOrderNotifications } from '../server/notifications/paid-order-notifications.mjs';
import { createProfile1PaidOrderDeliveryComposition } from '../server/notifications/profile1-paid-order-delivery-composition.mjs';
import { createResendPaidOrderNotifier } from '../server/notifications/resend-paid-order-notifier.mjs';
import { createV3CustomerInvoiceDeliveryOrchestrator } from '../server/notifications/v3-customer-invoice-delivery-orchestrator.mjs';
import { createV3InvoiceReconciliationWorker } from '../server/notifications/v3-invoice-reconciliation-worker.mjs';

const REFERENCE_PATTERN = /^[a-f0-9]{64}$/;
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

function safeReference(value) {
  const reference = String(value || '').trim().toLowerCase();
  return REFERENCE_PATTERN.test(reference) ? reference : 'unknown';
}

function safeLog(logger, message, error, order) {
  try {
    logger?.error?.(message, {
      name: String(error?.name || 'Error').slice(0, 120),
      code: String(error?.code || 'UNKNOWN').slice(0, 120),
      reference: safeReference(order?.reference),
    });
  } catch {}
}

function lazyNotificationStore(factory, env) {
  let store = null;
  function resolve() {
    if (!store) store = factory({ connectionString: env.NEON_DATABASE_URL });
    return store;
  }
  return Object.freeze({
    ensureNotification(args) { return resolve().ensureNotification(args); },
    claimNotification(args) { return resolve().claimNotification(args); },
    prepareV3InvoiceArtifact(args) { return resolve().prepareV3InvoiceArtifact(args); },
    recordDelivery(args) { return resolve().recordDelivery(args); },
  });
}

function lazyInvoiceDeliverySource(factory, env) {
  let source = null;
  function resolve() {
    if (!source) source = factory({ connectionString: env.NEON_DATABASE_URL });
    return source;
  }
  return Object.freeze({
    loadIssuedInvoiceForDelivery(args) { return resolve().loadIssuedInvoiceForDelivery(args); },
  });
}

function lazyArtifactStore(factory, env) {
  let store = null;
  function resolve() {
    if (!store) store = factory({ connectionString: env.NEON_DATABASE_URL });
    return store;
  }
  return Object.freeze({
    loadArtifactState(args) { return resolve().loadArtifactState(args); },
    bindStoredArtifact(args) { return resolve().bindStoredArtifact(args); },
  });
}

function lazyPdfStore(factory, env) {
  let store = null;
  function resolve() {
    if (!store) store = factory({ env });
    return store;
  }
  return Object.freeze({
    persistVerifiedArtifact(args) { return resolve().persistVerifiedArtifact(args); },
    loadVerifiedArtifact(args) { return resolve().loadVerifiedArtifact(args); },
  });
}

function lazyNotifier(factory, env) {
  let notifier = null;
  function resolve() {
    if (!notifier) {
      notifier = factory({
        apiKey: env.RESEND_API_KEY,
        from: env.RESEND_FROM,
        replyTo: env.RESEND_REPLY_TO,
      });
    }
    return notifier;
  }
  return Object.freeze({
    sendPaidOrderEmail(args) { return resolve().sendPaidOrderEmail(args); },
    sendV3InvoiceEmail(args) { return resolve().sendV3InvoiceEmail(args); },
  });
}

export function createCloudflarePaidOrderNotificationRuntime({
  env = process.env,
  notificationStoreFactory = createNeonOrderNotificationStore,
  invoiceDeliverySourceFactory = createNeonV3InvoiceDeliverySource,
  invoiceArtifactStoreFactory = createNeonV3InvoiceArtifactStore,
  invoicePdfStoreFactory = createCloudflareR2V3InvoicePdfStore,
  notifierFactory = createResendPaidOrderNotifier,
  deliverLegacyPaidOrder = deliverPaidOrderNotifications,
  deliveryRouterFactory = createPaidOrderDeliveryRouter,
  profile1CompositionFactory = createProfile1PaidOrderDeliveryComposition,
  v3CustomerInvoiceDeliveryFactory = createV3CustomerInvoiceDeliveryOrchestrator,
  logger = console,
} = {}) {
  const notificationStore = lazyNotificationStore(notificationStoreFactory, env);
  const notifier = lazyNotifier(notifierFactory, env);
  let profile1Delivery = null;

  function deliverLegacy(order) {
    return deliverLegacyPaidOrder({
      order,
      notificationStore,
      notifier,
      emailsEnabled: env.ORDER_EMAILS_ENABLED,
      merchantTo: env.ORDER_NOTIFICATION_TO,
    });
  }

  function resolveProfile1Delivery() {
    if (!profile1Delivery) {
      const invoiceSource = lazyInvoiceDeliverySource(invoiceDeliverySourceFactory, env);
      const artifactStore = lazyArtifactStore(invoiceArtifactStoreFactory, env);
      const pdfStore = lazyPdfStore(invoicePdfStoreFactory, env);
      const deliverV3CustomerInvoice = v3CustomerInvoiceDeliveryFactory({
        invoiceSource,
        notificationStore,
        artifactStore,
        pdfStore,
        notifier,
        emailsEnabled: env.ORDER_EMAILS_ENABLED,
        storageEnabled: env.V3_INVOICE_STORAGE_ENABLED,
      });
      profile1Delivery = profile1CompositionFactory({
        notificationStore,
        notifier,
        deliverV3CustomerInvoice,
        emailsEnabled: env.ORDER_EMAILS_ENABLED,
        merchantTo: env.ORDER_NOTIFICATION_TO,
      });
    }
    return profile1Delivery;
  }

  const routePaidOrderDelivery = deliveryRouterFactory({
    deliverLegacyPaidOrder: deliverLegacy,
    deliverV3CustomerInvoice(order) {
      return resolveProfile1Delivery()(order);
    },
  });

  return async function reconcilePaidOrderNotifications(order) {
    try {
      return await routePaidOrderDelivery(order);
    } catch (error) {
      safeLog(logger, 'Paid-order notification reconciliation failed.', error, order);
      return Object.freeze({
        skipped: false,
        reason: 'runtime_error',
        failed: true,
        deliveries: Object.freeze([]),
      });
    }
  };
}

function skipped(reason) {
  return Object.freeze({
    skipped: true,
    reason,
    selected: 0,
    sent: 0,
    failed: 0,
    duplicate: 0,
  });
}

export function createCloudflareV3InvoiceReconciliationRuntime({
  env = process.env,
  reconciliationSourceFactory = createNeonV3InvoiceReconciliationSource,
  notificationStoreFactory = createNeonOrderNotificationStore,
  invoiceDeliverySourceFactory = createNeonV3InvoiceDeliverySource,
  invoiceArtifactStoreFactory = createNeonV3InvoiceArtifactStore,
  invoicePdfStoreFactory = createCloudflareR2V3InvoicePdfStore,
  notifierFactory = createResendPaidOrderNotifier,
  deliveryFactory = createV3CustomerInvoiceDeliveryOrchestrator,
  workerFactory = createV3InvoiceReconciliationWorker,
  now,
  logger = console,
} = {}) {
  return async function runV3InvoiceReconciliation() {
    if (!enabled(env.V3_INVOICE_RECONCILIATION_ENABLED)) {
      return skipped('reconciliation_disabled');
    }
    if (!enabled(env.ORDER_EMAILS_ENABLED)) {
      return skipped('emails_disabled');
    }

    const usePermanentStorage = enabled(env.V3_INVOICE_STORAGE_ENABLED);
    const source = reconciliationSourceFactory({ connectionString: env.NEON_DATABASE_URL });
    const notificationStore = notificationStoreFactory({ connectionString: env.NEON_DATABASE_URL });
    const invoiceSource = invoiceDeliverySourceFactory({ connectionString: env.NEON_DATABASE_URL });
    const artifactStore = usePermanentStorage
      ? invoiceArtifactStoreFactory({ connectionString: env.NEON_DATABASE_URL })
      : null;
    const pdfStore = usePermanentStorage ? invoicePdfStoreFactory({ env }) : null;
    const notifier = notifierFactory({
      apiKey: env.RESEND_API_KEY,
      from: env.RESEND_FROM,
      replyTo: env.RESEND_REPLY_TO,
    });

    const deliverV3CustomerInvoice = deliveryFactory({
      invoiceSource,
      notificationStore,
      artifactStore,
      pdfStore,
      notifier,
      emailsEnabled: env.ORDER_EMAILS_ENABLED,
      storageEnabled: env.V3_INVOICE_STORAGE_ENABLED,
      ...(now === undefined ? {} : { now }),
    });
    const worker = workerFactory({
      source,
      deliverV3CustomerInvoice,
      logger,
      ...(now === undefined ? {} : { now }),
    });
    return worker();
  };
}
