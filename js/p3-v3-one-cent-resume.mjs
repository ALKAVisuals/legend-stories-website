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

function normalizeRecoveryText(value) {
  return String(value || '')
    .normalize('NFKC')
    .replace(/[\u200B-\u200D\u2060\uFEFF]/g, '')
    .replace(/[`'"“”‘’]/g, '')
    .replace(/\s+/g, '')
    .trim();
}

function decodeRecovery(value) {
  const raw = normalizeRecoveryText(value);
  const match = /^LMR1:([a-f0-9]{64}):([a-z0-9]{1,36})$/i.exec(raw);
  if (!match) throw new Error('INVALID_RECOVERY_CODE');
  return {
    reference: match[1].toLowerCase(),
    orderId: match[2].toUpperCase(),
  };
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

    message('Finalizing the existing PayPal payment…');
    const response = await fetch('/api/paypal/capture', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ reference, orderId }),
      cache: 'no-store',
      credentials: 'omit',
      redirect: 'error',
    });

    let result;
    try {
      result = await response.json();
    } catch {
      throw new Error('INVALID_CAPTURE_RESPONSE');
    }

    if (!response.ok) {
      throw new Error(result?.error?.code || `HTTP_${response.status}`);
    }
    if (result?.provider !== 'paypal'
      || result?.reference !== reference
      || result?.orderId !== orderId
      || result?.mode !== 'live'
      || result?.status !== 'paid'
      || result?.paid !== true) {
      throw new Error('INVALID_CAPTURE_RESPONSE');
    }

    message('Payment confirmation completed. Do not submit again.');
  } catch (error) {
    message(`Could not resume the test: ${String(error?.message || error)}`);
    if (button) button.disabled = false;
  }
});
