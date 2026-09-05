import { renderV3InvoicePdf } from '../invoices/v3-invoice-pdf.mjs';
import { renderV3CustomerInvoiceEmail } from './v3-customer-invoice-email.mjs';

const REFERENCE_PATTERN = /^[a-f0-9]{64}$/;
const NOTIFICATION_TYPE = 'customer_v3_invoice';
const MAX_V3_AUTOMATIC_CLAIMS = 5;
const RETRY_BACKOFF_SECONDS = Object.freeze({
  1: 5 * 60,
  2: 30 * 60,
  3: 2 * 60 * 60,
  4: 12 * 60 * 60,
});
const RETRIABLE_PROVIDER_STATUSES = new Set([408, 425, 429]);
const RETRIABLE_TRANSPORT_CODES = new Set([
  'ETIMEDOUT',
  'ECONNRESET',
  'ECONNREFUSED',
  'EHOSTUNREACH',
  'ENETUNREACH',
  'EAI_AGAIN',
  'ENOTFOUND',
  'UND_ERR_CONNECT_TIMEOUT',
  'UND_ERR_HEADERS_TIMEOUT',
  'UND_ERR_BODY_TIMEOUT',
]);

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

function providerStatus(error) {
  const status = Number(error?.details?.status);
  return Number.isInteger(status) && status >= 0 ? status : null;
}

function isRetriableProviderStatus(status) {
  return RETRIABLE_PROVIDER_STATUSES.has(status)
    || (status >= 500 && status <= 599)
    || (status >= 200 && status <= 299);
}

function isProviderTransportFailure(error) {
  const name = String(error?.name || '');
  if (name === 'AbortError' || name === 'TimeoutError' || name === 'TypeError') return true;
  const codes = [error?.code, error?.cause?.code]
    .map((value) => String(value || '').trim().toUpperCase())
    .filter(Boolean);
  return codes.some((code) => RETRIABLE_TRANSPORT_CODES.has(code));
}

function retryDueAt({ stage, error, deliveryAttempts, failedAt }) {
  const attempts = Number(deliveryAttempts);
  if (!Number.isSafeInteger(attempts) || attempts < 1 || attempts >= MAX_V3_AUTOMATIC_CLAIMS) {
    return null;
  }
  if (stage !== 'provider_send') return null;

  let retryable = false;
  if (String(error?.code || '') === 'RESEND_PAID_ORDER_DELIVERY_REJECTED') {
    const status = providerStatus(error);
    retryable = status !== null && isRetriableProviderStatus(status);
  } else {
    retryable = isProviderTransportFailure(error);
  }
  if (!retryable) return null;

  const delaySeconds = RETRY_BACKOFF_SECONDS[attempts];
  if (!Number.isSafeInteger(delaySeconds) || delaySeconds <= 0) return null;
  const dueAt = failedAt + delaySeconds;
  return Number.isSafeInteger(dueAt) ? dueAt : null;
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

function assertStorageDependencies({ storageEnabled, artifactStore, pdfStore }) {
  if (!enabled(storageEnabled)) return;
  for (const method of ['loadArtifactState', 'bindStoredArtifact']) {
    if (typeof artifactStore?.[method] !== 'function') {
      throw new TypeError(`V3 invoice artifact store is missing ${method}().`);
    }
  }
  for (const method of ['persistVerifiedArtifact', 'loadVerifiedArtifact']) {
    if (typeof pdfStore?.[method] !== 'function') {
      throw new TypeError(`V3 invoice PDF store is missing ${method}().`);
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

function artifactIdentity(artifact, durable) {
  return Object.freeze({
    invoiceId: durable.invoiceId,
    orderReference: durable.orderReference,
    snapshotSchemaVersion: durable.snapshotSchemaVersion,
    rendererVersion: positiveInteger(artifact?.rendererVersion, 'rendererVersion'),
    pdfSha256: String(artifact?.sha256 || '').trim().toLowerCase(),
    pdfByteLength: positiveInteger(artifact?.byteLength, 'pdfByteLength'),
    attachmentFilename: String(artifact?.filename || '').trim(),
  });
}

function stateArtifactMatches(state, identity) {
  if (state.rendererVersion === null) return true;
  return state.rendererVersion === identity.rendererVersion
    && state.pdfSha256 === identity.pdfSha256
    && state.pdfByteLength === identity.pdfByteLength
    && state.attachmentFilename === identity.attachmentFilename;
}

function prepareArtifactArgs(identity, claimToken, updatedAt) {
  return {
    orderReference: identity.orderReference,
    invoiceId: identity.invoiceId,
    claimToken,
    rendererVersion: identity.rendererVersion,
    pdfSha256: identity.pdfSha256,
    pdfByteLength: identity.pdfByteLength,
    attachmentFilename: identity.attachmentFilename,
    updatedAt,
  };
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
  artifactStore = null,
  pdfStore = null,
  notifier,
  pdfRenderer = renderV3InvoicePdf,
  emailRenderer = renderV3CustomerInvoiceEmail,
  emailsEnabled = process.env.ORDER_EMAILS_ENABLED,
  storageEnabled = process.env.V3_INVOICE_STORAGE_ENABLED,
  now = () => Math.floor(Date.now() / 1000),
  leaseSeconds,
} = {}) {
  assertInvoiceSource(invoiceSource);
  assertNotificationStore(notificationStore);
  assertStorageDependencies({ storageEnabled, artifactStore, pdfStore });
  assertNotifier(notifier);
  assertRenderer(pdfRenderer, 'V3 invoice PDF renderer');
  assertRenderer(emailRenderer, 'V3 customer invoice email renderer');
  if (typeof now !== 'function') {
    throw new TypeError('V3 customer invoice delivery clock must be a function.');
  }

  const usePermanentStorage = enabled(storageEnabled);

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
    const deliveryAttempts = Number(claim.notification?.deliveryAttempts);
    let stage = 'claim_validation';
    try {
      if (!claimToken) {
        fail(
          'V3_INVOICE_DELIVERY_CLAIM_INVALID',
          'Claimed V3 invoice notification has no claim token.',
        );
      }

      let attachment;
      if (!usePermanentStorage) {
        stage = 'pdf_render';
        const artifact = await pdfRenderer({ snapshot: durable.snapshot });
        const identity = artifactIdentity(artifact, durable);
        const preparedAt = timestamp(now());
        stage = 'artifact_prepare';
        await notificationStore.prepareV3InvoiceArtifact(
          prepareArtifactArgs(identity, claimToken, preparedAt),
        );
        attachment = Object.freeze({
          filename: identity.attachmentFilename,
          bytes: artifact.bytes,
        });
      } else {
        stage = 'artifact_state_load';
        const state = await artifactStore.loadArtifactState({
          orderReference: durable.orderReference,
          invoiceId: durable.invoiceId,
        });

        if (state.storageBound) {
          stage = 'storage_load';
          const persisted = await pdfStore.loadVerifiedArtifact({
            invoiceId: durable.invoiceId,
            orderReference: durable.orderReference,
            snapshotSchemaVersion: durable.snapshotSchemaVersion,
            rendererVersion: state.rendererVersion,
            pdfSha256: state.pdfSha256,
            pdfByteLength: state.pdfByteLength,
            attachmentFilename: state.attachmentFilename,
            storageBackend: state.storageBackend,
            storageKey: state.storageKey,
          });
          attachment = Object.freeze({
            filename: state.attachmentFilename,
            bytes: persisted.bytes,
          });
        } else {
          stage = 'pdf_render';
          const artifact = await pdfRenderer({ snapshot: durable.snapshot });
          const identity = artifactIdentity(artifact, durable);
          if (!stateArtifactMatches(state, identity)) {
            fail(
              'V3_INVOICE_ARTIFACT_IDENTITY_MISMATCH',
              'Previously prepared V3 invoice artifact identity differs from the deterministic render.',
            );
          }

          const preparedAt = timestamp(now());
          stage = 'artifact_prepare';
          await notificationStore.prepareV3InvoiceArtifact(
            prepareArtifactArgs(identity, claimToken, preparedAt),
          );

          stage = 'storage_persist';
          const persisted = await pdfStore.persistVerifiedArtifact({
            ...identity,
            bytes: artifact.bytes,
          });

          const storedAt = timestamp(now());
          stage = 'artifact_bind';
          const bound = await artifactStore.bindStoredArtifact({
            ...identity,
            claimToken,
            storageBackend: persisted.storageBackend,
            storageKey: persisted.storageKey,
            storedAt,
          });
          attachment = Object.freeze({
            filename: bound.attachmentFilename,
            bytes: persisted.bytes,
          });
        }
      }

      stage = 'email_render';
      const renderedEmail = await emailRenderer({ snapshot: durable.snapshot });
      stage = 'provider_send';
      const providerDelivery = await notifier.sendV3InvoiceEmail({
        to: durable.snapshot.customer?.email,
        orderReference: durable.orderReference,
        renderedEmail,
        attachment,
      });

      const completedAt = timestamp(now());
      stage = 'record_sent';
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
      const nextAttemptAt = retryDueAt({
        stage,
        error,
        deliveryAttempts,
        failedAt,
      });
      try {
        await notificationStore.recordDelivery({
          orderReference: durable.orderReference,
          notificationType: NOTIFICATION_TYPE,
          status: 'failed',
          attemptedAt: failedAt,
          errorCode: failureCode,
          claimToken: claimToken || null,
          ...(nextAttemptAt === null ? {} : { nextAttemptAt }),
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

export {
  MAX_V3_AUTOMATIC_CLAIMS,
  NOTIFICATION_TYPE as V3_CUSTOMER_INVOICE_NOTIFICATION_TYPE,
};
