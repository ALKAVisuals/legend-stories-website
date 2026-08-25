(() => {
  'use strict';

  const section = document.getElementById('contact');
  if (!section) return;

  const form = section.querySelector('form');
  if (!form) return;

  form.setAttribute('name', 'contact');
  form.setAttribute('method', 'POST');
  form.setAttribute('data-netlify', 'true');
  form.setAttribute('data-netlify-honeypot', 'bot-field');

  if (!form.querySelector('input[name="form-name"]')) {
    const formName = document.createElement('input');
    formName.type = 'hidden';
    formName.name = 'form-name';
    formName.value = 'contact';
    form.prepend(formName);
  }

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

  const oldEmail = Array.from(section.querySelectorAll('p'))
    .find((element) => element.textContent.trim() === 'hello@legendstories.nl');
  if (oldEmail) oldEmail.textContent = 'info@legendmural.com';

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

    submitting = true;
    if (submitButton) {
      submitButton.disabled = true;
      submitButton.textContent = 'Sending…';
      submitButton.setAttribute('aria-busy', 'true');
    }
    renderStatus('Sending your message…');

    try {
      const data = new FormData(form);
      data.set('form-name', 'contact');
      if (!data.has('bot-field')) data.set('bot-field', '');

      const encoded = new URLSearchParams();
      for (const [key, value] of data.entries()) {
        if (typeof value === 'string') encoded.append(key, value);
      }

      const response = await fetch('/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
        },
        body: encoded.toString(),
      });

      if (!response.ok) throw new Error(`Contact form returned ${response.status}.`);

      form.reset();
      renderStatus('Thanks — your message has been sent. We will get back to you as soon as possible.');
    } catch (error) {
      console.error('LegendMural contact form submission failed.', {
        name: error?.name || 'Error',
      });
      renderStatus('We could not send your message. Please try again in a moment.', { error: true });
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
