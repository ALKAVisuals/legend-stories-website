import {
  ORDER_STATUS_ENDPOINT,
  isOrderStatusConfigured,
  pollVerifiedOrderStatus,
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

const ORDER_RETURN_PRESENTATION = Object.freeze({
  'verification-disabled': Object.freeze({
    detailStatus: 'Awaiting server confirmation',
    paymentMeta: 'Confirmation pending',
    paymentDot: '01',
    actionLabel: 'Continue shopping',
    actionHref: 'shop.html',
    documentTitle: 'Payment Submitted — LegendMural',
  }),
  'paypal-capture-disabled': Object.freeze({
    detailStatus: 'Payment confirmation pending',
    paymentMeta: 'Confirmation pending',
    paymentDot: '01',
    actionLabel: 'Continue shopping',
    actionHref: 'shop.html',
    documentTitle: 'Payment Submitted — LegendMural',
  }),
  'capturing-paypal': Object.freeze({
    detailStatus: 'Securing PayPal payment',
    paymentMeta: 'Finalizing payment',
    paymentDot: '01',
    actionLabel: 'Securing payment…',
    actionHref: null,
    documentTitle: 'Finalizing Payment — LegendMural',
  }),
  verifying: Object.freeze({
    detailStatus: 'Checking payment status',
    paymentMeta: 'Secure verification',
    paymentDot: '01',
    actionLabel: 'Checking payment…',
    actionHref: null,
    documentTitle: 'Checking Payment — LegendMural',
  }),
  payment_pending: Object.freeze({
    detailStatus: 'Awaiting confirmation',
    paymentMeta: 'Confirmation pending',
    paymentDot: '01',
    actionLabel: 'Continue shopping',
    actionHref: 'shop.html',
    documentTitle: 'Payment Pending — LegendMural',
  }),
  payment_processing: Object.freeze({
    detailStatus: 'Payment processing',
    paymentMeta: 'Processing payment',
    paymentDot: '01',
    actionLabel: 'Continue shopping',
    actionHref: 'shop.html',
    documentTitle: 'Payment Processing — LegendMural',
  }),
  payment_failed: Object.freeze({
    detailStatus: 'Payment not completed',
    paymentMeta: 'Action required',
    paymentDot: '!',
    actionLabel: 'Review saved cart',
    actionHref: 'shop.html',
    documentTitle: 'Payment Not Completed — LegendMural',
  }),
  expired: Object.freeze({
    detailStatus: 'Checkout expired',
    paymentMeta: 'New checkout required',
    paymentDot: '!',
    actionLabel: 'Review saved cart',
    actionHref: 'shop.html',
    documentTitle: 'Checkout Expired — LegendMural',
  }),
  paid: Object.freeze({
    detailStatus: 'Payment confirmed',
    paymentMeta: 'Payment secured',
    paymentDot: '✓',
    actionLabel: 'Explore more legends',
    actionHref: 'shop.html',
    documentTitle: 'Order Confirmed — LegendMural',
    title: 'Your legend is on its way.',
    message: 'Your payment has been verified by the server and your order is confirmed. We’ll take it from here.',
  }),
  unavailable: Object.freeze({
    detailStatus: 'Verification unavailable',
    paymentMeta: 'Review required',
    paymentDot: '?',
    actionLabel: 'Continue shopping',
    actionHref: 'shop.html',
    documentTitle: 'Payment Status — LegendMural',
  }),
});

const elements = {
  card: document.getElementById('order-status-card'),
  label: document.getElementById('order-status-label'),
  title: document.getElementById('order-status-title'),
  message: document.getElementById('order-status-message'),
  note: document.getElementById('order-status-note'),
  orderIdBlock: document.getElementById('order-id-block'),
  orderIdValue: document.getElementById('order-id-value'),
  withdrawLink: document.getElementById('order-withdraw-link'),
  detailStatus: document.getElementById('order-detail-status'),
  paymentDot: document.getElementById('order-progress-payment-dot'),
  paymentMeta: document.getElementById('order-progress-payment-meta'),
  primaryAction: document.getElementById('order-primary-action'),
};

function resolvePresentation(state) {
  return ORDER_RETURN_PRESENTATION[state] || ORDER_RETURN_PRESENTATION.unavailable;
}

function applyPresentation(state) {
  const presentation = resolvePresentation(state);

  if (elements.detailStatus) elements.detailStatus.textContent = presentation.detailStatus;
  if (elements.paymentDot) elements.paymentDot.textContent = presentation.paymentDot;
  if (elements.paymentMeta) elements.paymentMeta.textContent = presentation.paymentMeta;
  if (presentation.documentTitle) document.title = presentation.documentTitle;

  if (elements.primaryAction) {
    elements.primaryAction.textContent = presentation.actionLabel;
    if (presentation.actionHref) {
      elements.primaryAction.setAttribute('href', presentation.actionHref);
      elements.primaryAction.removeAttribute('aria-disabled');
      elements.primaryAction.classList.remove('order-action--disabled');
    } else {
      elements.primaryAction.removeAttribute('href');
      elements.primaryAction.setAttribute('aria-disabled', 'true');
      elements.primaryAction.classList.add('order-action--disabled');
    }
  }

  return presentation;
}

function render(copy, state) {
  if (elements.card) elements.card.dataset.orderStatus = state;
  const presentation = applyPresentation(state);
  if (elements.label) elements.label.textContent = copy.label;
  if (elements.title) elements.title.textContent = presentation.title || copy.title;
  if (elements.message) elements.message.textContent = presentation.message || copy.message;
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

  const status = await pollVerifiedOrderStatus({
    endpoint: ORDER_STATUS_ENDPOINT,
    baseUrl: window.location.origin,
    reference,
    sessionId,
  });
  if (elements.orderIdValue) elements.orderIdValue.textContent = status.sessionId;
  if (elements.orderIdBlock) elements.orderIdBlock.classList.remove('hidden');
  if (elements.withdrawLink) {
    elements.withdrawLink.href = `withdraw.html?order=${encodeURIComponent(status.sessionId)}`;
    elements.withdrawLink.classList.remove('hidden');
  }
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
