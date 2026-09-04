import { createNetlifyV3InvoicePdfStore } from '../adapters/netlify-v3-invoice-pdf-store.mjs';
import { createNeonOrderNotificationStore } from '../adapters/neon-order-notification-store.mjs';
import { createNeonV3InvoiceArtifactStore } from '../adapters/neon-v3-invoice-artifact-store.mjs';
import { createNeonV3InvoiceDeliverySource } from '../adapters/neon-v3-invoice-delivery-source.mjs';
import { createPaidOrderDeliveryRouter } from '../notifications/paid-order-delivery-router.mjs';
import { deliverPaidOrderNotifications } from '../notifications/paid-order-notifications.mjs';
import { createProfile1PaidOrderDeliveryComposition } from '../notifications/profile1-paid-order-delivery-composition.mjs';
import { createResendPaidOrderNotifier } from '../notifications/resend-paid-order-notifier.mjs';
import { createV3CustomerInvoiceDeliveryOrchestrator } from '../notifications/v3-customer-invoice-delivery-orchestrator.mjs';

const REFERENCE_PATTERN = /^[a-f0-9]{64}$/;

function safeReference(value) {
  const reference = String(value || '').trim().toLowerCase();
  return REFERENCE_PATTERN.test(reference) ? reference : 'unknown';
}

function safeErrorMetadata(error, order) {
  return Object.freeze({
    name: String(error?.name || 'Error').slice(0, 120),
    code: String(error?.code || 'UNKNOWN').slice(0, 120),
    reference: safeReference(order?.reference),
  });
}

function safeLog(logger, message, metadata) {
  try { logger?.error?.(message, metadata); } catch {}
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

export function createPaidOrderNotificationRuntime({
  env = process.env,
  notificationStoreFactory = createNeonOrderNotificationStore,
  invoiceDeliverySourceFactory = createNeonV3InvoiceDeliverySource,
  invoiceArtifactStoreFactory = createNeonV3InvoiceArtifactStore,
  invoicePdfStoreFactory = createNetlifyV3InvoicePdfStore,
  notifierFactory = createResendPaidOrderNotifier,
  deliver = deliverPaidOrderNotifications,
  deliverLegacyPaidOrder = deliver,
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
      safeLog(
        logger,
        'Paid-order notification reconciliation failed.',
        safeErrorMetadata(error, order),
      );
      return Object.freeze({
        skipped: false,
        reason: 'runtime_error',
        failed: true,
        deliveries: Object.freeze([]),
      });
    }
  };
}
