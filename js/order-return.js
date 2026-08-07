import {
  ORDER_STATUS_ENDPOINT,
  isOrderStatusConfigured,
  requestVerifiedOrderStatus,
} from './commerce/order-status-client.mjs';
import {
  PAYPAL_CAPTURE_ENDPOINT,
  isPayPalCaptureConfigured,
  requestPayPalCapture,
} from './commerce/paypal-capture-client.mjs';
import {
  applyVerifiedOrderStatus,
  resolveOrderReturnCopy,
} from './commerce/order-return.mjs';

const elements = {
  card: document.getElementById('order-status-card'),
  label: document.getElementById('order-status-label'),
  title: document.getElementById('order-status-title'),
  message: document.getElementById('order-status-message'),
  note: document.getElementById('order-status-note'),
};

function render(copy, state) {
  if (elements.card) elements.card.dataset.orderStatus = state;
  if (elements.label) elements.label.textContent = copy.label;
  if (elements.title) elements.title.textContent = copy.title;
  if (elements.message) elements.message.textContent = copy.message;
}

function renderUnavailable(message) {
  const copy = resolveOrderReturnCopy('unavailable');
  render({ ...copy, message: message || copy.message }, 'unavailable');
  if (elements.note) {
    elements.note.textContent = 'Keep your payment confirmation email. Your saved cart has not been cleared.';
  }
}

async function verifyStoredOrder(reference, sessionId) {
  if (!isOrderStatusConfigured(ORDER_STATUS_ENDPOINT, window.location.origin)) {
    render(resolveOrderReturnCopy('payment_pending'), 'verification-disabled');
    return;
  }

  render({
    label: 'Verifying secure payment',
    title: 'Checking payment status',
    message: 'The server is checking the payment result. Your cart remains saved during verification.',
  }, 'verifying');

  const status = await requestVerifiedOrderStatus({
    endpoint: ORDER_STATUS_ENDPOINT,
    baseUrl: window.location.origin,
    reference,
    sessionId,
  });
  const copy = applyVerifiedOrderStatus(status, {
    localStorage: window.localStorage,
    sessionStorage: window.sessionStorage,
  });
  render(copy, status.status);
  if (elements.note) {
    elements.note.textContent = status.paid
      ? 'The server verified this exact payment. Keep your payment confirmation email for your records.'
      : 'Your cart remains saved until the server confirms this exact payment as paid.';
  }
}

async function verifyReturnedCheckout() {
  const url = new URL(window.location.href);
  const stripeSessionId = url.searchParams.get('session_id') || '';
  const paypalOrderId = url.searchParams.get('token') || '';
  const returnedSessionId = paypalOrderId || stripeSessionId;
  const storedSessionId = sessionStorage.getItem('legendCheckoutSessionId') || '';
  const reference = sessionStorage.getItem('legendCheckoutReference') || '';

  if (url.search) {
    url.search = '';
    window.history.replaceState({}, document.title, url.toString());
  }

  if (!returnedSessionId || !storedSessionId || returnedSessionId !== storedSessionId || !reference) {
    renderUnavailable('This browser does not have matching order verification details. Your cart remains saved.');
    return;
  }

  try {
    if (paypalOrderId) {
      if (!isPayPalCaptureConfigured(PAYPAL_CAPTURE_ENDPOINT, window.location.origin)) {
        render(resolveOrderReturnCopy('payment_pending'), 'paypal-capture-disabled');
        return;
      }
      render({
        label: 'Confirming PayPal payment',
        title: 'Finalizing your payment',
        message: 'PayPal approved the checkout. The server is securely capturing and verifying the payment now.',
      }, 'capturing-paypal');
      await requestPayPalCapture({
        endpoint: PAYPAL_CAPTURE_ENDPOINT,
        baseUrl: window.location.origin,
        reference,
        orderId: paypalOrderId,
      });
    }

    await verifyStoredOrder(reference, returnedSessionId);
  } catch (error) {
    console.error('Order payment verification failed:', error);
    renderUnavailable('The payment status could not be verified automatically. Your cart remains saved and can be reviewed later.');
  }
}

verifyReturnedCheckout();
