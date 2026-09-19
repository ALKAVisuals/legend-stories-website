const form = document.querySelector('#p3-test-form');
const status = document.querySelector('#status');
const button = form?.querySelector('button[type="submit"]');

function message(value) {
  if (status) status.textContent = String(value || '');
}

form?.addEventListener('submit', async (event) => {
  event.preventDefault();
  if (button?.disabled) return;

  const data = new FormData(form);
  const payload = {
    key: String(data.get('key') || ''),
    customer: {
      firstname: String(data.get('firstname') || '').trim(),
      lastname: String(data.get('lastname') || '').trim(),
      email: String(data.get('email') || '').trim(),
      street: String(data.get('street') || '').trim(),
      line2: String(data.get('line2') || '').trim(),
      zip: String(data.get('zip') || '').trim(),
      city: String(data.get('city') || '').trim(),
      country: 'NL',
    },
  };

  if (button) button.disabled = true;
  message('Creating the €0.01 PayPal order…');

  try {
    const response = await fetch('/api/internal/p3-v3-one-cent-start', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const result = await response.json();

    if (!response.ok) {
      throw new Error(result?.error?.code || `HTTP_${response.status}`);
    }
    if (result?.provider !== 'paypal' || result?.mode !== 'live' || !result?.url) {
      throw new Error('INVALID_PAYPAL_RESPONSE');
    }

    message('PayPal is opening. Do not pay yet.');
    window.location.assign(result.url);
  } catch (error) {
    message(`Could not start the test: ${String(error?.message || error)}`);
    if (button) button.disabled = false;
  }
});
