const NOTIFICATION_TARGETS = Object.freeze([
  Object.freeze({ type: 'merchant_paid_order', recipient: 'merchant' }),
  Object.freeze({ type: 'customer_paid_order', recipient: 'customer' }),
]);

function enabled(value) {
  return String(value || '').trim().toLowerCase() === 'true';
}

function requiredEmail(value) {
  const email = String(value || '').trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : '';
}

function errorCode(error) {
  return String(error?.code || error?.name || 'UNKNOWN').slice(0, 120);
}

function assertStore(store) {
  for (const method of ['ensureNotification', 'claimNotification', 'recordDelivery']) {
    if (typeof store?.[method] !== 'function') {
      throw new TypeError(`Paid-order notification store is missing ${method}().`);
    }
  }
}

function assertNotifier(notifier) {
  if (typeof notifier?.sendPaidOrderEmail !== 'function') {
    throw new TypeError('Paid-order notifier is not configured.');
  }
}

export async function deliverPaidOrderNotifications({
  order,
  notificationStore,
  notifier,
  emailsEnabled = process.env.ORDER_EMAILS_ENABLED,
  merchantTo = process.env.ORDER_NOTIFICATION_TO,
  now = () => Math.floor(Date.now() / 1000),
} = {}) {
  if (!enabled(emailsEnabled)) {
    return Object.freeze({ skipped: true, reason: 'disabled', deliveries: [] });
  }
  if (!order || order.status !== 'paid') {
    return Object.freeze({ skipped: true, reason: 'not_paid', deliveries: [] });
  }
  if (order.mode !== 'live') {
    return Object.freeze({ skipped: true, reason: 'not_live', deliveries: [] });
  }

  assertStore(notificationStore);
  assertNotifier(notifier);

  const merchantEmail = requiredEmail(merchantTo);
  const customerEmail = requiredEmail(order.customer?.email);
  if (!merchantEmail) {
    return Object.freeze({ skipped: true, reason: 'merchant_recipient_missing', deliveries: [] });
  }
  if (!customerEmail) {
    return Object.freeze({ skipped: true, reason: 'customer_recipient_missing', deliveries: [] });
  }

  const deliveries = [];
  for (const target of NOTIFICATION_TARGETS) {
    const attemptedAt = Number(now());
    if (!Number.isInteger(attemptedAt) || attemptedAt < 0) {
      throw new TypeError('Paid-order notification clock returned an invalid timestamp.');
    }
    const recipient = target.recipient === 'merchant' ? merchantEmail : customerEmail;
    await notificationStore.ensureNotification({
      orderReference: order.reference,
      notificationType: target.type,
      createdAt: order.paidAt ?? attemptedAt,
    });
    const claim = await notificationStore.claimNotification({
      orderReference: order.reference,
      notificationType: target.type,
      attemptedAt,
    });
    if (!claim?.claimed) {
      deliveries.push(Object.freeze({
        notificationType: target.type,
        status: claim?.notification?.deliveryStatus || 'not_claimed',
        duplicate: true,
      }));
      continue;
    }

    try {
      const delivery = await notifier.sendPaidOrderEmail({
        notificationType: target.type,
        to: recipient,
        order,
      });
      await notificationStore.recordDelivery({
        orderReference: order.reference,
        notificationType: target.type,
        status: 'sent',
        attemptedAt,
        providerMessageId: delivery.providerMessageId,
      });
      deliveries.push(Object.freeze({
        notificationType: target.type,
        status: 'sent',
        duplicate: false,
      }));
    } catch (error) {
      try {
        await notificationStore.recordDelivery({
          orderReference: order.reference,
          notificationType: target.type,
          status: 'failed',
          attemptedAt,
          errorCode: errorCode(error),
        });
      } catch {
        // The payment truth must never be changed because delivery-state recording failed.
      }
      deliveries.push(Object.freeze({
        notificationType: target.type,
        status: 'failed',
        duplicate: false,
        errorCode: errorCode(error),
      }));
    }
  }

  return Object.freeze({ skipped: false, reason: null, deliveries: Object.freeze(deliveries) });
}

export { NOTIFICATION_TARGETS };
