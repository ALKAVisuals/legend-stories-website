import { renderV3InvoicePdf } from '../invoices/v3-invoice-pdf.mjs';
import { renderV3CustomerInvoiceEmail } from './v3-customer-invoice-email.mjs';

const REFERENCE_PATTERN = /^[a-f0-9]{64}$/;
const NOTIFICATION_TYPE = 'customer_v3_invoice';

export class V3CustomerInvoiceDeliveryError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = 'V3CustomerInvoiceDeliveryError';
    this.code = code;
    this.details = details;
  }
}

function fail(code, message, details = {}) {
  throw new V3CustomerInvoiceDeliveryError(code, message, details);
}

function enabled(value) {
  return String(value || '').trim().toLowerCase() === 'true';
}

function normalizeReference(value) {
  const reference = String(value || '').trim().toLowerCase();
  if (!REFERENCE_PATTERN.test(reference)) {
    fail('INVALID_V3_INVOICE_DELIVERY_ORDER', 'Profile-1 order reference is invalid.', {
      field: 'reference',
    });
  }
  return reference;
}

function positiveInteger(value, field) {
  const normalized = Number(value);
  if (!Number.isSafeInteger(normalized) || normalized <= 0) {
    fail('INVALID_V3_INVOICE_DELIVERY_ORDER', `${field} is invalid.`, { field });
  }
  return normalized;
}

function timestamp(value) {
  const normalized = Number(value);
  if (!Number.isSafeInteger(normalized) || normalized < 0) {
    throw new TypeError('V3 customer invoice delivery clock returned an invalid timestamp.');
  }
  return normalized;
}

function errorCode(error) {
  return String(error?.code || error?.name || 'UNKNOWN').slice(0, 120);
}

function assertInvoiceSource(source) {
  if (typeof source?.loadIssuedInvoiceForDelivery !== 'function') {
    throw new TypeError('V3 invoice delivery source is missing loadIssuedInvoiceForDelivery().');
  }
}

function assertNotificationStore(store) {
  for (const method of [
    'ensureNotification',
    'claimNotification',
    'prepareV3InvoiceArtifact',
    'recordDelivery',
  ]) {
    if (typeof store?.[method] !== 'function') {
      throw new TypeError(`V3 invoice notification store is missing ${method}().`);
    }
  }
}

function assertNotifier(notifier) {
  if (typeof notifier?.sendV3InvoiceEmail !== 'function') {
    throw new TypeError('V3 invoice notifier is missing sendV3InvoiceEmail().');
  }
}

function assertRenderer(renderer, name) {
  if (typeof renderer !== 'function') {
    throw new TypeError(`${name} must be a function.`);
  }
}

function normalizeProfile1Order(order) {
  if (Number(order?.documentProfileVersion) !== 1) {
    fail(
      'V3_INVOICE_DELIVERY_PROFILE_MISMATCH',
      'V3 customer invoice delivery requires document profile 1.',
      { documentProfileVersion: order?.documentProfileVersion ?? null },
    );
  }

  return Object.freeze({
    reference: normalizeReference(order?.reference),
    invoiceId: positiveInteger(order?.invoiceId, 'invoiceId'),
  });
}

function deliveryResult({
  orderReference,
  invoiceId,
  status,
  duplicate = false,
  skipped = false,
  reason = null,
  failureCode = null,
}) {
  return Object.freeze({
    notificationType: NOTIFICATION_TYPE,
    orderReference,
    invoiceId,
    status,
    duplicate,
    skipped,
    reason,
    ...(failureCode ? { errorCode: failureCode } : {}),
  });
}

export function createV3CustomerInvoiceDeliveryOrchestrator({
  invoiceSource,
  notificationStore,
  notifier,
  pdfRenderer = renderV3InvoicePdf,
  emailRenderer = renderV3CustomerInvoiceEmail,
  emailsEnabled = process.env.ORDER_EMAILS_ENABLED,
  now = () => Math.floor(Date.now() / 1000),
  leaseSeconds,
} = {}) {
  assertInvoiceSource(invoiceSource);
  assertNotificationStore(notificationStore);
  assertNotifier(notifier);
  assertRenderer(pdfRenderer, 'V3 invoice PDF renderer');
  assertRenderer(emailRenderer, 'V3 customer invoice email renderer');
  if (typeof now !== 'function') {
    throw new TypeError('V3 customer invoice delivery clock must be a function.');
  }

  return async function deliverV3CustomerInvoice(order) {
    if (!enabled(emailsEnabled)) {
      return deliveryResult({
        orderReference: null,
        invoiceId: null,
        status: 'skipped',
        skipped: true,
        reason: 'disabled',
      });
    }
    if (!order || order.status !== 'paid') {
      return deliveryResult({
        orderReference: null,
        invoiceId: null,
        status: 'skipped',
        skipped: true,
        reason: 'not_paid',
      });
    }
    if (order.mode !== 'live') {
      return deliveryResult({
        orderReference: null,
        invoiceId: null,
        status: 'skipped',
        skipped: true,
        reason: 'not_live',
      });
    }

    const profile1Order = normalizeProfile1Order(order);
    const durable = await invoiceSource.loadIssuedInvoiceForDelivery({
      orderReference: profile1Order.reference,
      invoiceId: profile1Order.invoiceId,
    });

    const createdAt = timestamp(durable?.snapshot?.order?.paidAt);
    await notificationStore.ensureNotification({
      orderReference: durable.orderReference,
      notificationType: NOTIFICATION_TYPE,
      createdAt,
      invoiceId: durable.invoiceId,
      snapshotSchemaVersion: durable.snapshotSchemaVersion,
    });

    const attemptedAt = timestamp(now());
    const claimArgs = {
      orderReference: durable.orderReference,
      notificationType: NOTIFICATION_TYPE,
      attemptedAt,
      ...(leaseSeconds === undefined ? {} : { leaseSeconds }),
    };
    const claim = await notificationStore.claimNotification(claimArgs);
    if (!claim?.claimed) {
      return deliveryResult({
        orderReference: durable.orderReference,
        invoiceId: durable.invoiceId,
        status: claim?.notification?.deliveryStatus || 'not_claimed',
        duplicate: true,
      });
    }

    const claimToken = String(claim.notification?.claimToken || '').trim();
    try {
      if (!claimToken) {
        fail(
          'V3_INVOICE_DELIVERY_CLAIM_INVALID',
          'Claimed V3 invoice notification has no claim token.',
        );
      }

      const artifact = await pdfRenderer({ snapshot: durable.snapshot });
      const preparedAt = timestamp(now());
      await notificationStore.prepareV3InvoiceArtifact({
        orderReference: durable.orderReference,
        invoiceId: durable.invoiceId,
        claimToken,
        rendererVersion: artifact.rendererVersion,
        pdfSha256: artifact.sha256,
        pdfByteLength: artifact.byteLength,
        attachmentFilename: artifact.filename,
        updatedAt: preparedAt,
      });

      const renderedEmail = await emailRenderer({ snapshot: durable.snapshot });
      const providerDelivery = await notifier.sendV3InvoiceEmail({
        to: durable.snapshot.customer?.email,
        orderReference: durable.orderReference,
        renderedEmail,
        attachment: {
          filename: artifact.filename,
          bytes: artifact.bytes,
        },
      });

      const completedAt = timestamp(now());
      await notificationStore.recordDelivery({
        orderReference: durable.orderReference,
        notificationType: NOTIFICATION_TYPE,
        status: 'sent',
        attemptedAt: completedAt,
        providerMessageId: providerDelivery.providerMessageId,
        claimToken,
      });

      return deliveryResult({
        orderReference: durable.orderReference,
        invoiceId: durable.invoiceId,
        status: 'sent',
      });
    } catch (error) {
      const failureCode = errorCode(error);
      let failedAt = attemptedAt;
      try {
        failedAt = timestamp(now());
      } catch {
        // Preserve the original delivery failure if the injected clock also fails.
      }
      try {
        await notificationStore.recordDelivery({
          orderReference: durable.orderReference,
          notificationType: NOTIFICATION_TYPE,
          status: 'failed',
          attemptedAt: failedAt,
          errorCode: failureCode,
          claimToken: claimToken || null,
        });
      } catch {
        // Delivery-state recording failure must never change already-committed payment truth.
      }

      return deliveryResult({
        orderReference: durable.orderReference,
        invoiceId: durable.invoiceId,
        status: 'failed',
        failureCode,
      });
    }
  };
}

export { NOTIFICATION_TYPE as V3_CUSTOMER_INVOICE_NOTIFICATION_TYPE };
