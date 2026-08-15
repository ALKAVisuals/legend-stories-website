import { OrderStoreContractError } from './store-contract.mjs';

export function requireStripePaymentEventStore(adapter) {
  if (!adapter || typeof adapter.processStripeEvent !== 'function') {
    throw new OrderStoreContractError(
      'ORDER_STORE_NOT_CONFIGURED',
      'Legacy Stripe payment-event store is missing processStripeEvent().',
      { missingMethods: Object.freeze(['processStripeEvent']) },
    );
  }
  return adapter;
}
