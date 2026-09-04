export class PaidOrderDeliveryRoutingError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = 'PaidOrderDeliveryRoutingError';
    this.code = code;
    this.details = details;
  }
}

function fail(code, message, details = {}) {
  throw new PaidOrderDeliveryRoutingError(code, message, details);
}

function documentProfileVersion(order) {
  const version = Number(order?.documentProfileVersion ?? 0);
  return Number.isSafeInteger(version) && version >= 0 ? version : null;
}

export function createPaidOrderDeliveryRouter({
  deliverLegacyPaidOrder,
  deliverV3CustomerInvoice = null,
} = {}) {
  if (typeof deliverLegacyPaidOrder !== 'function') {
    throw new TypeError('Legacy paid-order delivery handler is required.');
  }

  return async function routePaidOrderDelivery(order) {
    const profileVersion = documentProfileVersion(order);

    if (profileVersion === 0) {
      return deliverLegacyPaidOrder(order);
    }

    if (profileVersion === 1) {
      if (typeof deliverV3CustomerInvoice !== 'function') {
        fail(
          'V3_INVOICE_DELIVERY_NOT_CONFIGURED',
          'Profile-1 invoice delivery is not configured.',
          { documentProfileVersion: 1 },
        );
      }
      return deliverV3CustomerInvoice(order);
    }

    fail(
      'DOCUMENT_PROFILE_UNSUPPORTED',
      'Paid-order delivery cannot route an unsupported document profile.',
      { documentProfileVersion: profileVersion },
    );
  };
}
