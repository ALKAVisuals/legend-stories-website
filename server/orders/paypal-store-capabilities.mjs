import { OrderStoreContractError } from './store-contract.mjs';

function requireMethods(adapter, methods, label) {
  const store = adapter && typeof adapter === 'object' ? adapter : {};
  const missingMethods = methods.filter((method) => typeof store[method] !== 'function');
  if (missingMethods.length) {
    throw new OrderStoreContractError(
      'ORDER_STORE_NOT_CONFIGURED',
      `${label} is missing required capabilities.`,
      { missingMethods: Object.freeze(missingMethods) },
    );
  }
  return adapter;
}

export function requirePaypalCaptureStore(adapter) {
  return requireMethods(
    adapter,
    ['processPaypalCapture', 'getOrderByReference'],
    'PayPal capture store',
  );
}

export function requirePaypalWebhookStore(adapter) {
  return requireMethods(
    adapter,
    ['processPaypalWebhookEvent', 'getOrderByReference'],
    'PayPal webhook reconciliation store',
  );
}
