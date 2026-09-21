const form = document.querySelector('#p3-resume-form');
const status = document.querySelector('#status');
const button = form?.querySelector('button[type="submit"]');
const EXPECTED_KEY_SHA256 = 'b9c882ed809231911a641d0c49bcf297e0722b705d3f48cb0c37f1988f157c83';

function message(value) {
  if (status) status.textContent = String(value || '');
}

async function sha256Hex(value) {
  const bytes = new TextEncoder().encode(String(value || ''));
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

function decodeRecovery(value) {
  const raw = String(value || '').trim();
  const match = /^LMR1:([a-f0-9]{64}):([A-Z0-9]{1,36})$/.exec(raw);
  if (!match) throw new Error('INVALID_RECOVERY_CODE');
  return { reference: match[1], orderId: match[2] };
}

form?.addEventListener('submit', async (event) => {
  event.preventDefault();
  if (button?.disabled) return;

  const data = new FormData(form);
  const key = String(data.get('key') || '');
  const recovery = String(data.get('recovery') || '');

  if (button) button.disabled = true;
  message('Restoring the secure PayPal return context…');

  try {
    const hash = await sha256Hex(key);
    if (hash !== EXPECTED_KEY_SHA256) throw new Error('INVALID_TEST_CODE');

    const { reference, orderId } = decodeRecovery(recovery);
    sessionStorage.setItem('legendCheckoutSessionId', orderId);
    sessionStorage.setItem('legendCheckoutReference', reference);

    message('Opening secure payment confirmation…');
    window.location.assign(`/order-success.html?token=${encodeURIComponent(orderId)}`);
  } catch (error) {
    message(`Could not resume the test: ${String(error?.message || error)}`);
    if (button) button.disabled = false;
  }
});
