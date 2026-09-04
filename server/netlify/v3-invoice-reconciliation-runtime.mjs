import { createNetlifyV3InvoicePdfStore } from '../adapters/netlify-v3-invoice-pdf-store.mjs';
import { createNeonOrderNotificationStore } from '../adapters/neon-order-notification-store.mjs';
import { createNeonV3InvoiceArtifactStore } from '../adapters/neon-v3-invoice-artifact-store.mjs';
import { createNeonV3InvoiceDeliverySource } from '../adapters/neon-v3-invoice-delivery-source.mjs';
import { createNeonV3InvoiceReconciliationSource } from '../adapters/neon-v3-invoice-reconciliation-source.mjs';
import { createResendPaidOrderNotifier } from '../notifications/resend-paid-order-notifier.mjs';
import { createV3CustomerInvoiceDeliveryOrchestrator } from '../notifications/v3-customer-invoice-delivery-orchestrator.mjs';
import { createV3InvoiceReconciliationWorker } from '../notifications/v3-invoice-reconciliation-worker.mjs';

function enabled(value) {
  return String(value || '').trim().toLowerCase() === 'true';
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

export function createV3InvoiceReconciliationRuntime({
  env = process.env,
  reconciliationSourceFactory = createNeonV3InvoiceReconciliationSource,
  notificationStoreFactory = createNeonOrderNotificationStore,
  invoiceDeliverySourceFactory = createNeonV3InvoiceDeliverySource,
  invoiceArtifactStoreFactory = createNeonV3InvoiceArtifactStore,
  invoicePdfStoreFactory = createNetlifyV3InvoicePdfStore,
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
    if (!enabled(env.V3_INVOICE_STORAGE_ENABLED)) {
      return skipped('storage_disabled');
    }

    const source = reconciliationSourceFactory({
      connectionString: env.NEON_DATABASE_URL,
    });
    const notificationStore = notificationStoreFactory({
      connectionString: env.NEON_DATABASE_URL,
    });
    const invoiceSource = invoiceDeliverySourceFactory({
      connectionString: env.NEON_DATABASE_URL,
    });
    const artifactStore = invoiceArtifactStoreFactory({
      connectionString: env.NEON_DATABASE_URL,
    });
    const pdfStore = invoicePdfStoreFactory({ env });
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
