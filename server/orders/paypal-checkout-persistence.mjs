import { persistPendingHostedCheckout } from './checkout-persistence.mjs';
import { createPayPalHostedCheckout } from '../payments/paypal-checkout.mjs';
import {
  OrderStoreContractError,
  requireCheckoutStore,
} from './store-contract.mjs';
import { CheckoutPersistenceError } from './checkout-persistence.mjs';

function requireStore(checkoutStore) {
  try {
    return requireCheckoutStore(checkoutStore);
  } catch (error) {
    if (error instanceof OrderStoreContractError) {
      throw new CheckoutPersistenceError(
        'CHECKOUT_STORE_NOT_CONFIGURED',
        'Durable pending-order storage is not configured.',
        error.details,
      );
    }
    throw error;
  }
}

export async function createDurablePayPalCheckout({
  checkoutStore,
  documentProfileVersion = 0,
  createdAt = Math.floor(Date.now() / 1000),
  ...checkoutInput
}) {
  requireStore(checkoutStore);
  const checkout = await createPayPalHostedCheckout(checkoutInput);
  const persisted = await persistPendingHostedCheckout({
    checkout,
    request: checkoutInput.request,
    customer: checkoutInput.customer,
    catalogProducts: checkoutInput.catalogProducts,
    checkoutStore,
    documentProfileVersion,
    createdAt,
  });

  return Object.freeze({
    ...checkout,
    orderVersion: persisted.order.version,
    reservationCreated: persisted.reservationCreated,
  });
}
