const PAID_NOTIFICATION_TYPES = Object.freeze([
  'merchant_paid_order',
  'customer_paid_order',
]);

function deliveryErrorCode(error) {
  return String(error?.code || error?.name || 'UNKNOWN').slice(0, 120);
}

function requirePaidOrder(order) {
  return Boolean(order
    && order.status === 'paid'
    && order.mode === 'live'
    && typeof order.reference === 'string'
    && order.reference.length === 64);
}

export function createPaidOrderDelivery({
  notificationStore,
  notifier,
  enabled = false,
  now = () => Math.floor(Date.now() / 1000),
} = {}) {
  if (!enabled) {
    return Object.freeze({
      async deliverPaidOrderNotifications() {
        return Object.freeze({ skipped: true, reason: 'disabled', deliveries: [] });
      },
    });
  }

  for (const method of ['ensureNotification', 'claimNotification', 'recordDelivery']) {
    if (typeof notificationStore?.[method] !== 'function') {
      throw new TypeError(`Order notification store is missing ${method}().`);
    }
  }
  if (typeof notifier?.sendPaidOrderNotification !== 'function') {
    throw new TypeError('Paid-order notifier is not configured.');
  }
  if (typeof now !== 'function') throw new TypeError('Paid-order delivery clock is not configured.');

  return Object.freeze({
    async deliverPaidOrderNotifications(order) {
      if (!requirePaidOrder(order)) {
        return Object.freeze({ skipped: true, reason: 'not-live-paid', deliveries: [] });
      }

      const deliveries = [];
      for (const notificationType of PAID_NOTIFICATION_TYPES) {
        const createdAt = now();
        const ensured = await notificationStore.ensureNotification({
          orderReference: order.reference,
          notificationType,
          createdAt,
        });
        if (ensured.notification.deliveryStatus === 'sent') {
          deliveries.push(Object.freeze({ notificationType, status: 'already-sent' }));
          continue;
        }

        const attemptedAt = now();
        const claim = await notificationStore.claimNotification({
          orderReference: order.reference,
          notificationType,
          attemptedAt,
        });
        if (!claim.claimed) {
          deliveries.push(Object.freeze({
            notificationType,
            status: claim.notification.deliveryStatus === 'sent' ? 'already-sent' : 'not-claimed',
          }));
          continue;
        }

        try {
          const delivery = await notifier.sendPaidOrderNotification({ notificationType, order });
          await notificationStore.recordDelivery({
            orderReference: order.reference,
            notificationType,
            status: 'sent',
            attemptedAt: now(),
            providerMessageId: delivery.providerMessageId,
          });
          deliveries.push(Object.freeze({ notificationType, status: 'sent' }));
        } catch (error) {
          const errorCode = deliveryErrorCode(error);
          try {
            await notificationStore.recordDelivery({
              orderReference: order.reference,
              notificationType,
              status: 'failed',
              attemptedAt: now(),
              errorCode,
            });
          } catch (stateError) {
            console.error('Paid-order email delivery-state update failed.', {
              code: deliveryErrorCode(stateError),
              notificationType,
              orderReference: order.reference,
            });
          }
          console.error('Paid-order email delivery failed.', {
            code: errorCode,
            notificationType,
            orderReference: order.reference,
          });
          deliveries.push(Object.freeze({ notificationType, status: 'failed', errorCode }));
        }
      }

      return Object.freeze({ skipped: false, deliveries: Object.freeze(deliveries) });
    },
  });
}

export { PAID_NOTIFICATION_TYPES };
