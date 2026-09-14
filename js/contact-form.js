(() => {
  'use strict';

  const ENDPOINT = '/api/contact';
  const section = document.getElementById('contact');
  if (!section) return;

  const form = section.querySelector('form');
  if (!form) return;

  form.setAttribute('name', 'contact');
  form.setAttribute('method', 'POST');

  if (!form.querySelector('input[name="bot-field"]')) {
    const honeypot = document.createElement('input');
    honeypot.type = 'text';
    honeypot.name = 'bot-field';
    honeypot.tabIndex = -1;
    honeypot.autocomplete = 'off';
    honeypot.setAttribute('aria-hidden', 'true');
    honeypot.style.position = 'absolute';
    honeypot.style.left = '-10000px';
    honeypot.style.width = '1px';
    honeypot.style.height = '1px';
    honeypot.style.opacity = '0';
    form.prepend(honeypot);
  }

  const submitButton = form.querySelector('button[type="submit"]');
  const originalButtonText = submitButton?.textContent || 'Send message';
  const status = document.createElement('p');
  status.id = 'contact-form-status';
  status.className = 'hidden text-xs leading-relaxed';
  status.setAttribute('role', 'status');
  status.setAttribute('aria-live', 'polite');
  status.setAttribute('aria-atomic', 'true');
  form.append(status);

  let submitting = false;

  function renderStatus(message, { error = false } = {}) {
    status.textContent = message;
    status.classList.remove('hidden', 'text-red-300', 'text-mint');
    status.classList.add(error ? 'text-red-300' : 'text-mint');
  }

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (submitting) return;
    if (!form.reportValidity()) return;

    submitting = true;
    if (submitButton) {
      submitButton.disabled = true;
      submitButton.textContent = 'Sending…';
      submitButton.setAttribute('aria-busy', 'true');
    }
    renderStatus('Sending your message…');

    try {
      const data = new FormData(form);
      const response = await fetch(ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: String(data.get('name') || '').trim(),
          email: String(data.get('email') || '').trim(),
          subject: String(data.get('subject') || '').trim(),
          message: String(data.get('message') || '').trim(),
          botField: String(data.get('bot-field') || ''),
        }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(body?.error?.message || `Contact form returned ${response.status}.`);
      }

      form.reset();
      renderStatus('Thanks — your message has been sent. We will get back to you as soon as possible.');
    } catch (error) {
      console.error('LegendMural contact form submission failed.', {
        name: error?.name || 'Error',
      });
      renderStatus('We could not send your message. Please try again in a moment or email info@legendmural.com.', { error: true });
    } finally {
      submitting = false;
      if (submitButton) {
        submitButton.disabled = false;
        submitButton.textContent = originalButtonText;
        submitButton.removeAttribute('aria-busy');
      }
    }
  });
})();
