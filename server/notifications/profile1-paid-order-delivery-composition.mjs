import { deliverMerchantPaidOrderNotification } from './paid-order-notifications.mjs';

export class Profile1PaidOrderDeliveryCompositionError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = 'Profile1PaidOrderDeliveryCompositionError';
    this.code = code;
    this.details = details;
  }
}

function fail(code, message, details = {}) {
  throw new Profile1PaidOrderDeliveryCompositionError(code, message, details);
}

function errorCode(error) {
  return String(error?.code || error?.name || 'UNKNOWN').slice(0, 120);
}

function assertFunction(value, name) {
  if (typeof value !== 'function') {
    throw new TypeError(`${name} must be a function.`);
  }
}

function isFailed(result) {
  if (result?.failed === true || result?.status === 'failed') return true;
  return Array.isArray(result?.deliveries)
    && result.deliveries.some((delivery) => delivery?.status === 'failed');
}

async function settleDelivery(deliver) {
  try {
    return await deliver();
  } catch (error) {
    return Object.freeze({
      failed: true,
      errorCode: errorCode(error),
    });
  }
}

export function createProfile1PaidOrderDeliveryComposition({
  notificationStore,
  notifier,
  deliverMerchantPaidOrder = deliverMerchantPaidOrderNotification,
  deliverV3CustomerInvoice,
  emailsEnabled = process.env.ORDER_EMAILS_ENABLED,
  merchantTo = process.env.ORDER_NOTIFICATION_TO,
  now = () => Math.floor(Date.now() / 1000),
} = {}) {
  assertFunction(deliverMerchantPaidOrder, 'Profile-1 merchant delivery boundary');
  assertFunction(deliverV3CustomerInvoice, 'Profile-1 V3 customer invoice delivery boundary');
  if (typeof now !== 'function') {
    throw new TypeError('Profile-1 delivery composition clock must be a function.');
  }

  return async function deliverProfile1PaidOrder(order) {
    if (Number(order?.documentProfileVersion) !== 1) {
      fail(
        'PROFILE1_DELIVERY_COMPOSITION_MISMATCH',
        'Profile-1 delivery composition requires document profile 1.',
        { documentProfileVersion: order?.documentProfileVersion ?? null },
      );
    }

    const merchant = await settleDelivery(() => deliverMerchantPaidOrder({
      order,
      notificationStore,
      notifier,
      emailsEnabled,
      merchantTo,
      now,
    }));

    const customer = await settleDelivery(() => deliverV3CustomerInvoice(order));

    return Object.freeze({
      documentProfileVersion: 1,
      merchant,
      customer,
      failed: isFailed(merchant) || isFailed(customer),
    });
  };
}
