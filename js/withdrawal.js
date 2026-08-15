const ENDPOINT = '/.netlify/functions/create-withdrawal';

const form = document.getElementById('withdrawal-form');
const orderIdInput = document.getElementById('withdrawal-order-id');
const emailInput = document.getElementById('withdrawal-email');
const confirmInput = document.getElementById('withdrawal-confirm');
const submitButton = document.getElementById('withdrawal-submit');
const errorBox = document.getElementById('withdrawal-error');
const receipt = document.getElementById('withdrawal-receipt');
const receiptOrderId = document.getElementById('withdrawal-receipt-order-id');
const receiptCode = document.getElementById('withdrawal-receipt-code');
const receiptTime = document.getElementById('withdrawal-receipt-time');
const downloadButton = document.getElementById('withdrawal-download');

let latestReceipt = null;

function showError(message) {
  if (!errorBox) return;
  errorBox.textContent = message;
  errorBox.classList.remove('hidden');
}

function clearError() {
  if (!errorBox) return;
  errorBox.textContent = '';
  errorBox.classList.add('hidden');
}

function normalizePrefill() {
  const url = new URL(window.location.href);
  const orderId = url.searchParams.get('order') || '';
  if (orderIdInput && orderId) orderIdInput.value = orderId;
  if (url.search) {
    url.search = '';
    window.history.replaceState({}, document.title, url.toString());
  }
}

function receiptText(data) {
  return [
    'LegendMural — Withdrawal confirmation',
    '',
    `Order ID: ${data.orderId}`,
    `Confirmation code: ${data.confirmationCode}`,
    `Withdrawal received: ${data.withdrawnAtIso}`,
    '',
    'This receipt confirms that LegendMural received your online notice to withdraw from the purchase identified above.',
    'It does not by itself confirm that goods have been returned or that a refund has already been processed.',
  ].join('\n');
}

function renderReceipt(data) {
  latestReceipt = data;
  if (receiptOrderId) receiptOrderId.textContent = data.orderId;
  if (receiptCode) receiptCode.textContent = data.confirmationCode;
  if (receiptTime) {
    const date = new Date(data.withdrawnAtIso);
    receiptTime.textContent = Number.isNaN(date.getTime())
      ? data.withdrawnAtIso
      : `${date.toLocaleString()} (${data.withdrawnAtIso})`;
  }
  if (form) form.classList.add('hidden');
  if (receipt) receipt.classList.remove('hidden');
  receipt?.focus?.();
}

async function submitWithdrawal(event) {
  event.preventDefault();
  clearError();

  if (!form?.reportValidity()) return;
  if (!confirmInput?.checked) {
    showError('Confirm that you want to withdraw from this purchase.');
    confirmInput?.focus();
    return;
  }

  submitButton.disabled = true;
  submitButton.textContent = 'Submitting…';
  try {
    const response = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        orderId: orderIdInput.value.trim(),
        email: emailInput.value.trim(),
        confirm: true,
      }),
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      const message = response.status === 404
        ? 'We could not match that Order ID and email address. Check the details and try again.'
        : (body?.error?.message || 'Your withdrawal could not be submitted. Please try again.');
      throw new Error(message);
    }
    renderReceipt(body);
  } catch (error) {
    showError(error?.message || 'Your withdrawal could not be submitted. Please try again.');
  } finally {
    submitButton.disabled = false;
    submitButton.textContent = 'Confirm withdrawal';
  }
}

function downloadReceipt() {
  if (!latestReceipt) return;
  const blob = new Blob([receiptText(latestReceipt)], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `LegendMural-withdrawal-${latestReceipt.orderId}.txt`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

normalizePrefill();
form?.addEventListener('submit', submitWithdrawal);
downloadButton?.addEventListener('click', downloadReceipt);
