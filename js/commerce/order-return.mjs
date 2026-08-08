const RETURN_COPY = Object.freeze({
  payment_pending: Object.freeze({
    label: 'Payment awaiting confirmation',
    title: 'Payment submitted',
    message: 'Your payment has not been confirmed by the server yet. Your cart remains saved while confirmation is pending.',
    clearCart: false,
  }),
  payment_processing: Object.freeze({
    label: 'Payment processing',
    title: 'Payment is processing',
    message: 'Your payment provider is still processing your payment. Your cart remains saved until the server confirms that the order is paid.',
    clearCart: false,
  }),
  payment_failed: Object.freeze({
    label: 'Payment not completed',
    title: 'Payment failed',
    message: 'The server reports that the payment was not completed. Your cart is still available so you can try again.',
    clearCart: false,
  }),
  expired: Object.freeze({
    label: 'Checkout expired',
    title: 'Checkout expired',
    message: 'This secure checkout has expired. Your cart remains saved so you can start a new payment.',
    clearCart: false,
  }),
  paid: Object.freeze({
    label: 'Payment confirmed',
    title: 'Payment confirmed',
    message: 'Your payment has been verified by the server. Your order is now confirmed and the saved cart has been cleared.',
    clearCart: true,
  }),
});

export function resolveOrderReturnCopy(status) {
  return RETURN_COPY[status] || Object.freeze({
    label: 'Verification unavailable',
    title: 'Payment submitted',
    message: 'We could not verify the order status automatically. Your cart remains saved and no order is marked paid in this browser.',
    clearCart: false,
  });
}

export function clearVerifiedCheckoutStorage({
  localStorage,
  sessionStorage,
} = {}) {
  if (!localStorage || !sessionStorage) {
    throw new Error('Browser storage is required to clear a verified Checkout.');
  }

  for (const key of ['legendCart', 'legendDiscountCode', 'legendDiscountPercent']) {
    localStorage.removeItem(key);
  }
  for (const key of [
    'legendOrder',
    'legendOrderRequest',
    'legendCheckoutReference',
    'legendCheckoutSessionId',
  ]) {
    sessionStorage.removeItem(key);
  }
}

export function applyVerifiedOrderStatus(statusResponse, storage) {
  const copy = resolveOrderReturnCopy(statusResponse?.status);
  const verifiedPaid = statusResponse?.status === 'paid' && statusResponse?.paid === true;
  if (copy.clearCart !== verifiedPaid) {
    throw new Error('Order status response is inconsistent with the return-page policy.');
  }
  if (verifiedPaid) clearVerifiedCheckoutStorage(storage);
  return copy;
}
