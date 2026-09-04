const NOTIFICATION_TARGETS = Object.freeze([
  Object.freeze({ type: 'merchant_paid_order', recipient: 'merchant' }),
  Object.freeze({ type: 'customer_paid_order', recipient: 'customer' }),
]);

const MERCHANT_NOTIFICATION_TARGETS = Object.freeze([
  NOTIFICATION_TARGETS[0],
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

async function deliverNotificationTargets({
  order,
  notificationStore,
  notifier,
  emailsEnabled,
  merchantTo,
  now,
  targets,
}) {
  if (!enabled(emailsEnabled)) {
    return Object.freeze({ skipped: true, reason: 'disabled', deliveries: [] });
  }
  if (!order || order.status !== 'paid') {
    return Object.freeze({ skipped: true, reason: 'not_paid', deliveries: [] });
  }
  if (order.mode !== 'live') {
    return Object.freeze({ skipped: true, reason: 'not_live', deliveries: [] });
  }

  const recipients = Object.freeze({
    merchant: requiredEmail(merchantTo),
    customer: requiredEmail(order.customer?.email),
  });
  if (!targets.some((target) => recipients[target.recipient])) {
    return Object.freeze({ skipped: true, reason: 'recipients_missing', deliveries: [] });
  }

  assertStore(notificationStore);
  assertNotifier(notifier);

  const deliveries = [];
  for (const target of targets) {
    const recipient = recipients[target.recipient];
    if (!recipient) {
      deliveries.push(Object.freeze({
        notificationType: target.type,
        status: 'skipped',
        duplicate: false,
        reason: 'recipient_missing',
      }));
      continue;
    }

    const attemptedAt = Number(now());
    if (!Number.isInteger(attemptedAt) || attemptedAt < 0) {
      throw new TypeError('Paid-order notification clock returned an invalid timestamp.');
    }
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

export async function deliverPaidOrderNotifications({
  order,
  notificationStore,
  notifier,
  emailsEnabled = process.env.ORDER_EMAILS_ENABLED,
  merchantTo = process.env.ORDER_NOTIFICATION_TO,
  now = () => Math.floor(Date.now() / 1000),
} = {}) {
  return deliverNotificationTargets({
    order,
    notificationStore,
    notifier,
    emailsEnabled,
    merchantTo,
    now,
    targets: NOTIFICATION_TARGETS,
  });
}

export async function deliverMerchantPaidOrderNotification({
  order,
  notificationStore,
  notifier,
  emailsEnabled = process.env.ORDER_EMAILS_ENABLED,
  merchantTo = process.env.ORDER_NOTIFICATION_TO,
  now = () => Math.floor(Date.now() / 1000),
} = {}) {
  return deliverNotificationTargets({
    order,
    notificationStore,
    notifier,
    emailsEnabled,
    merchantTo,
    now,
    targets: MERCHANT_NOTIFICATION_TARGETS,
  });
}

export { NOTIFICATION_TARGETS, MERCHANT_NOTIFICATION_TARGETS };
