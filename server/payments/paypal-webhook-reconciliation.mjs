import { normalizePayPalOrderId } from './paypal-api.mjs';
import { validatePayPalCaptureResult } from './paypal-capture.mjs';

const REFERENCE_PATTERN = /^[a-f0-9]{64}$/;
const CAPTURE_ID_PATTERN = /^[A-Z0-9]{1,128}$/;
const SUPPORTED_EVENTS = new Set([
  'CHECKOUT.ORDER.APPROVED',
  'CHECKOUT.PAYMENT-APPROVAL.REVERSED',
  'PAYMENT.CAPTURE.COMPLETED',
  'PAYMENT.CAPTURE.PENDING',
  'PAYMENT.CAPTURE.DENIED',
  'PAYMENT.CAPTURE.DECLINED',
]);
const FAILED_CAPTURE_STATUSES = new Set(['DENIED', 'DECLINED']);

export class PayPalWebhookReconciliationError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = 'PayPalWebhookReconciliationError';
    this.code = code;
    this.details = details;
  }
}

function fail(code, message, details) {
  throw new PayPalWebhookReconciliationError(code, message, details);
}

function timestampSeconds(value, label) {
  const milliseconds = Date.parse(String(value || ''));
  if (!Number.isFinite(milliseconds) || milliseconds <= 0) {
    fail('INVALID_PAYPAL_WEBHOOK_EVENT', `${label} timestamp is invalid.`);
  }
  return Math.floor(milliseconds / 1000);
}

function amountToCents(amount, label) {
  const currency = String(amount?.currency_code || '').trim().toUpperCase();
  const value = String(amount?.value || '').trim();
  if (currency !== 'EUR' || !/^\d+(?:\.\d{1,2})?$/.test(value)) {
    fail('INVALID_PAYPAL_WEBHOOK_EVENT', `${label} amount is invalid.`);
  }
  const [whole, fraction = ''] = value.split('.');
  const cents = (Number(whole) * 100) + Number(fraction.padEnd(2, '0'));
  if (!Number.isSafeInteger(cents) || cents < 0) {
    fail('INVALID_PAYPAL_WEBHOOK_EVENT', `${label} amount is invalid.`);
  }
  return cents;
}

function normalizeReference(value) {
  const reference = String(value || '').trim().toLowerCase();
  if (!REFERENCE_PATTERN.test(reference)) {
    fail('INVALID_PAYPAL_WEBHOOK_EVENT', 'PayPal webhook order reference is invalid.');
  }
  return reference;
}

function safeNotificationFailureLog(logger, error, order) {
  const reference = String(order?.reference || '').trim().toLowerCase();
  try {
    logger?.error?.('Paid-order notification reconciliation failed after PayPal webhook confirmation.', {
      name: String(error?.name || 'Error').slice(0, 120),
      code: String(error?.code || 'UNKNOWN').slice(0, 120),
      reference: REFERENCE_PATTERN.test(reference) ? reference : 'unknown',
    });
  } catch {
    // Notification logging must never affect payment truth or webhook acknowledgement.
  }
}

async function attemptPaidOrderNotifications(reconcile, order, logger) {
  if (typeof reconcile !== 'function' || order?.status !== 'paid') return;
  try {
    await reconcile(order);
  } catch (error) {
    safeNotificationFailureLog(logger, error, order);
  }
}

async function persistWebhookEvent({
  orderStore,
  mutation,
  reconcilePaidOrderNotifications,
  logger,
}) {
  const persisted = await orderStore.processPaypalWebhookEvent(mutation);
  if (persisted?.order?.status === 'paid') {
    await attemptPaidOrderNotifications(
      reconcilePaidOrderNotifications,
      persisted.order,
      logger,
    );
  }
  return persisted;
}

function eventIdentity(event = {}) {
  const eventId = String(event.id || '').trim();
  const eventType = String(event.event_type || '').trim().toUpperCase();
  if (!eventId || eventId.length > 128) {
    fail('INVALID_PAYPAL_WEBHOOK_EVENT', 'PayPal webhook event ID is invalid.');
  }
  return Object.freeze({
    eventId,
    eventType,
    createdAt: timestampSeconds(event.create_time, 'PayPal webhook event'),
  });
}

function parseApprovedOrderEvent(event) {
  const identity = eventIdentity(event);
  const resource = event?.resource || {};
  let orderId;
  try {
    orderId = normalizePayPalOrderId(resource.id);
  } catch {
    fail('INVALID_PAYPAL_WEBHOOK_EVENT', 'PayPal webhook order ID is invalid.');
  }
  const units = Array.isArray(resource.purchase_units) ? resource.purchase_units : [];
  if (units.length !== 1) {
    fail('INVALID_PAYPAL_WEBHOOK_EVENT', 'PayPal order webhook must contain exactly one purchase unit.');
  }
  const unit = units[0];
  const reference = normalizeReference(unit?.custom_id);
  if (normalizeReference(unit?.reference_id) !== reference) {
    fail('PAYPAL_WEBHOOK_REFERENCE_MISMATCH', 'PayPal order webhook references do not match.');
  }
  return Object.freeze({
    ...identity,
    reference,
    orderId,
    amountTotal: amountToCents(unit?.amount, 'PayPal order'),
    currency: 'EUR',
  });
}

function parseApprovalReversedEvent(event) {
  const identity = eventIdentity(event);
  const resource = event?.resource || {};
  let orderId;
  try {
    orderId = normalizePayPalOrderId(resource.order_id);
  } catch {
    fail('INVALID_PAYPAL_WEBHOOK_EVENT', 'PayPal approval reversal order ID is invalid.');
  }
  const units = Array.isArray(resource.purchase_units) ? resource.purchase_units : [];
  if (units.length !== 1) {
    fail('INVALID_PAYPAL_WEBHOOK_EVENT', 'PayPal approval reversal must contain exactly one purchase unit.');
  }
  return Object.freeze({
    ...identity,
    reference: normalizeReference(units[0]?.custom_id),
    orderId,
    amountTotal: null,
    currency: null,
  });
}

function parseCaptureEvent(event) {
  const identity = eventIdentity(event);
  const resource = event?.resource || {};
  const captureId = String(resource.id || '').trim().toUpperCase();
  if (!CAPTURE_ID_PATTERN.test(captureId)) {
    fail('INVALID_PAYPAL_WEBHOOK_EVENT', 'PayPal webhook capture ID is invalid.');
  }
  let orderId;
  try {
    orderId = normalizePayPalOrderId(resource?.supplementary_data?.related_ids?.order_id);
  } catch {
    fail('INVALID_PAYPAL_WEBHOOK_EVENT', 'PayPal webhook related order ID is invalid.');
  }
  const reference = normalizeReference(resource.custom_id);
  const amountTotal = amountToCents(resource.amount, 'PayPal capture');
  const mutationAt = resource.update_time || resource.create_time
    ? timestampSeconds(resource.update_time || resource.create_time, 'PayPal capture')
    : identity.createdAt;
  return Object.freeze({
    ...identity,
    reference,
    orderId,
    captureId,
    amountTotal,
    currency: 'EUR',
    mutationAt,
    resourceStatus: String(resource.status || '').trim().toUpperCase(),
  });
}

function assertReservedOrder(order, expected, mode, { requireAmount = true } = {}) {
  if (!order
    || order.reference !== expected.reference
    || order.paymentSessionId !== expected.orderId
    || order.mode !== mode
    || (requireAmount && order.amountTotal !== expected.amountTotal)
    || (requireAmount && String(order.currency || '').toUpperCase() !== 'EUR')) {
    fail('PAYPAL_WEBHOOK_ORDER_MISMATCH', 'PayPal webhook event does not match the reserved order.');
  }
}

function isProfile1(order) {
  return Number(order?.documentProfileVersion || 0) === 1;
}

function requireV3Finalizer(finalizePaidOrder) {
  if (typeof finalizePaidOrder !== 'function') {
    fail(
      'V3_PAID_FINALIZER_NOT_CONFIGURED',
      'The V3 paid-order finalizer is not configured.',
    );
  }
}

export function createPayPalWebhookReconciler({
  orderStore,
  paypalClient,
  finalizePaidOrder = null,
  reconcilePaidOrderNotifications = null,
  logger = console,
  fallbackCapturedAt = () => Math.floor(Date.now() / 1000),
  webhookProcessedAt = () => Math.floor(Date.now() / 1000),
} = {}) {
  if (typeof orderStore?.getOrderByReference !== 'function'
    || typeof orderStore?.processPaypalWebhookEvent !== 'function') {
    fail('PAYPAL_WEBHOOK_STORE_NOT_CONFIGURED', 'PayPal webhook order storage is not configured.');
  }
  if (!paypalClient || !['test', 'live'].includes(paypalClient.mode)) {
    fail('PAYPAL_WEBHOOK_CLIENT_NOT_CONFIGURED', 'PayPal webhook API client is not configured.');
  }
  if (typeof webhookProcessedAt !== 'function') {
    fail('PAYPAL_WEBHOOK_CLOCK_NOT_CONFIGURED', 'PayPal webhook processing clock is not configured.');
  }

  const persist = (mutation) => persistWebhookEvent({
    orderStore,
    mutation,
    reconcilePaidOrderNotifications,
    logger,
  });

  const finalizeV3 = async ({
    reserved,
    parsed,
    mode,
    paidAt,
    captureId,
    source,
  }) => {
    requireV3Finalizer(finalizePaidOrder);
    const processedAt = Number(webhookProcessedAt());
    const finalized = await finalizePaidOrder({
      reference: parsed.reference,
      provider: 'paypal',
      providerOrderId: parsed.orderId,
      providerCaptureId: captureId || null,
      providerEventId: parsed.eventId,
      providerEventType: parsed.eventType,
      providerEventCreatedAt: parsed.createdAt,
      providerEventProcessedAt: processedAt,
      source,
      amountTotal: reserved.amountTotal,
      currency: reserved.currency,
      mode,
      paidAt,
    });
    if (finalized?.order?.status === 'paid') {
      await attemptPaidOrderNotifications(
        reconcilePaidOrderNotifications,
        finalized.order,
        logger,
      );
    }
    return finalized;
  };

  return async function processVerifiedPayPalEvent({ event, mode } = {}) {
    const eventType = String(event?.event_type || '').trim().toUpperCase();
    if (!SUPPORTED_EVENTS.has(eventType)) {
      return Object.freeze({ ignored: true, eventType });
    }
    if (mode !== paypalClient.mode) {
      fail('PAYPAL_WEBHOOK_MODE_MISMATCH', 'Verified webhook mode does not match the PayPal client.');
    }

    if (eventType === 'CHECKOUT.ORDER.APPROVED') {
      const parsed = parseApprovedOrderEvent(event);
      const reserved = await orderStore.getOrderByReference(parsed.reference);
      assertReservedOrder(reserved, parsed, mode);

      if (reserved.status === 'paid') {
        if (isProfile1(reserved)) {
          return finalizeV3({
            reserved,
            parsed,
            mode,
            paidAt: reserved.paidAt,
            captureId: null,
            source: 'paypal_webhook_checkout_approved_existing_paid',
          });
        }
        return persist({
          ...parsed,
          mode,
          targetStatus: 'paid',
          mutationAt: parsed.createdAt,
        });
      }

      if (isProfile1(reserved)) {
        // Fail before contacting PayPal when V3 document issuance is inactive/incomplete.
        requireV3Finalizer(finalizePaidOrder);
      }

      if (typeof paypalClient.captureOrder !== 'function') {
        fail('PAYPAL_WEBHOOK_CLIENT_NOT_CONFIGURED', 'PayPal recovery capture is unavailable.');
      }
      const capturePayload = await paypalClient.captureOrder(parsed.orderId, {
        idempotencyKey: `legend-paypal-capture-${parsed.reference}`,
      });
      const capture = validatePayPalCaptureResult(capturePayload, {
        reference: parsed.reference,
        orderId: parsed.orderId,
        amountTotal: reserved.amountTotal,
        currency: reserved.currency,
        fallbackCapturedAt: fallbackCapturedAt(),
      });

      if (isProfile1(reserved)) {
        return finalizeV3({
          reserved,
          parsed,
          mode,
          paidAt: capture.capturedAt,
          captureId: capture.captureIds[0] || null,
          source: 'paypal_webhook_checkout_approved_recovery',
        });
      }

      return persist({
        ...parsed,
        captureId: capture.captureIds[0] || null,
        mode,
        targetStatus: 'paid',
        mutationAt: capture.capturedAt,
      });
    }

    if (eventType === 'CHECKOUT.PAYMENT-APPROVAL.REVERSED') {
      const parsed = parseApprovalReversedEvent(event);
      const reserved = await orderStore.getOrderByReference(parsed.reference);
      assertReservedOrder(reserved, parsed, mode, { requireAmount: false });
      return persist({
        ...parsed,
        mode,
        targetStatus: 'payment_failed',
        mutationAt: parsed.createdAt,
      });
    }

    const parsed = parseCaptureEvent(event);
    if (eventType === 'PAYMENT.CAPTURE.COMPLETED') {
      if (parsed.resourceStatus !== 'COMPLETED') {
        fail('INVALID_PAYPAL_WEBHOOK_EVENT', 'Completed capture webhook has a non-completed resource.');
      }
      const reserved = await orderStore.getOrderByReference(parsed.reference);
      assertReservedOrder(reserved, parsed, mode);
      if (isProfile1(reserved)) {
        return finalizeV3({
          reserved,
          parsed,
          mode,
          paidAt: parsed.mutationAt,
          captureId: parsed.captureId,
          source: 'paypal_webhook_capture_completed',
        });
      }
      return persist({ ...parsed, mode, targetStatus: 'paid' });
    }
    if (eventType === 'PAYMENT.CAPTURE.PENDING') {
      if (parsed.resourceStatus !== 'PENDING') {
        fail('INVALID_PAYPAL_WEBHOOK_EVENT', 'Pending capture webhook has a non-pending resource.');
      }
      return persist({
        ...parsed,
        mode,
        targetStatus: 'payment_processing',
      });
    }
    if (!FAILED_CAPTURE_STATUSES.has(parsed.resourceStatus)) {
      fail('INVALID_PAYPAL_WEBHOOK_EVENT', 'Failed capture webhook has an unexpected resource status.');
    }
    return persist({
      ...parsed,
      mode,
      targetStatus: 'payment_failed',
    });
  };
}
