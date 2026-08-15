export const ORDER_STORE_CAPABILITIES = Object.freeze({
  persistPendingCheckout: 'persistPendingCheckout',
  getOrderByReference: 'getOrderByReference',
});

const KNOWN_ORDER_STORE_METHODS = Object.freeze(
  Object.values(ORDER_STORE_CAPABILITIES),
);

export const COMPLETE_ORDER_STORE_METHODS = Object.freeze([
  ORDER_STORE_CAPABILITIES.persistPendingCheckout,
  ORDER_STORE_CAPABILITIES.getOrderByReference,
]);

export class OrderStoreContractError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = 'OrderStoreContractError';
    this.code = code;
    this.details = details;
  }
}

export function missingOrderStoreMethods(
  adapter,
  requiredMethods = COMPLETE_ORDER_STORE_METHODS,
) {
  const store = adapter && typeof adapter === 'object' ? adapter : {};
  return Object.freeze(
    [...requiredMethods].filter((method) => typeof store[method] !== 'function'),
  );
}

export function validateOrderStoreAdapter(adapter, {
  requiredMethods = COMPLETE_ORDER_STORE_METHODS,
  label = 'Order store',
} = {}) {
  const required = [...new Set(requiredMethods.map((method) => String(method).trim()))]
    .filter(Boolean);
  const unknown = required.filter(
    (method) => !KNOWN_ORDER_STORE_METHODS.includes(method),
  );
  if (unknown.length) {
    throw new OrderStoreContractError(
      'INVALID_ORDER_STORE_CONTRACT',
      `${label} requested unknown capabilities.`,
      { unknownMethods: Object.freeze(unknown) },
    );
  }

  const missing = missingOrderStoreMethods(adapter, required);
  if (missing.length) {
    throw new OrderStoreContractError(
      'ORDER_STORE_NOT_CONFIGURED',
      `${label} is missing required capabilities.`,
      { missingMethods: missing },
    );
  }

  return adapter;
}

export function requireCheckoutStore(adapter) {
  return validateOrderStoreAdapter(adapter, {
    requiredMethods: [ORDER_STORE_CAPABILITIES.persistPendingCheckout],
    label: 'Checkout order store',
  });
}

export function requireOrderLookupStore(adapter) {
  return validateOrderStoreAdapter(adapter, {
    requiredMethods: [ORDER_STORE_CAPABILITIES.getOrderByReference],
    label: 'Order status store',
  });
}
