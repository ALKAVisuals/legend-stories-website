import { createNeonOrderNotificationStore } from '../adapters/neon-order-notification-store.mjs';
import { deliverPaidOrderNotifications } from '../notifications/paid-order-notifications.mjs';
import { createResendPaidOrderNotifier } from '../notifications/resend-paid-order-notifier.mjs';

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
  try {
    logger?.error?.(message, metadata);
  } catch {
    // Logging must never make paid-order notification reconciliation fatal.
  }
}

function lazyNotificationStore(factory, env) {
  let store = null;
  function resolve() {
    if (!store) {
      store = factory({ connectionString: env.NEON_DATABASE_URL });
    }
    return store;
  }
  return Object.freeze({
    ensureNotification(args) {
      return resolve().ensureNotification(args);
    },
    claimNotification(args) {
      return resolve().claimNotification(args);
    },
    recordDelivery(args) {
      return resolve().recordDelivery(args);
    },
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
    sendPaidOrderEmail(args) {
      return resolve().sendPaidOrderEmail(args);
    },
  });
}

export function createPaidOrderNotificationRuntime({
  env = process.env,
  notificationStoreFactory = createNeonOrderNotificationStore,
  notifierFactory = createResendPaidOrderNotifier,
  deliver = deliverPaidOrderNotifications,
  logger = console,
} = {}) {
  return async function reconcilePaidOrderNotifications(order) {
    try {
      return await deliver({
        order,
        notificationStore: lazyNotificationStore(notificationStoreFactory, env),
        notifier: lazyNotifier(notifierFactory, env),
        emailsEnabled: env.ORDER_EMAILS_ENABLED,
        merchantTo: env.ORDER_NOTIFICATION_TO,
      });
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
