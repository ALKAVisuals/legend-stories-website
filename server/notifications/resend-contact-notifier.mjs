const RESEND_EMAIL_ENDPOINT = 'https://api.resend.com/emails';

export class ResendContactNotifierError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = 'ResendContactNotifierError';
    this.code = code;
    this.details = details;
  }
}

function fail(code, message, details) {
  throw new ResendContactNotifierError(code, message, details);
}

function requiredText(value, field, maxLength) {
  const normalized = String(value || '').trim();
  if (!normalized || normalized.length > maxLength || /[\u0000-\u001F\u007F]/.test(normalized)) {
    fail('RESEND_CONTACT_INVALID_CONFIG', `${field} is invalid.`, { field });
  }
  return normalized;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function renderContactMessage(message) {
  const text = [
    'New LegendMural contact message',
    '',
    `Name: ${message.name}`,
    `Email: ${message.email}`,
    `Subject: ${message.subject}`,
    `Received: ${message.submittedAtIso}`,
    '',
    message.message,
  ].join('\n');
  const html = `<!doctype html><html><body style="font-family:Arial,sans-serif;line-height:1.5;color:#111"><h1 style="font-size:20px">New LegendMural contact message</h1><p><strong>Name:</strong> ${escapeHtml(message.name)}<br><strong>Email:</strong> ${escapeHtml(message.email)}<br><strong>Subject:</strong> ${escapeHtml(message.subject)}<br><strong>Received:</strong> ${escapeHtml(message.submittedAtIso)}</p><p style="white-space:pre-wrap">${escapeHtml(message.message)}</p></body></html>`;
  return { text, html };
}

export function createResendContactNotifier({
  apiKey,
  from,
  to = 'info@legendmural.com',
  fetchImpl = globalThis.fetch,
  endpoint = RESEND_EMAIL_ENDPOINT,
} = {}) {
  const normalizedApiKey = requiredText(apiKey, 'apiKey', 512);
  const normalizedFrom = requiredText(from, 'from', 320);
  const normalizedTo = requiredText(to, 'to', 320);
  if (typeof fetchImpl !== 'function') {
    fail('RESEND_CONTACT_INVALID_CONFIG', 'fetchImpl must be a function.', { field: 'fetchImpl' });
  }

  return Object.freeze({
    async sendContactMessage(message) {
      if (!message || typeof message !== 'object') {
        fail('RESEND_CONTACT_INVALID_MESSAGE', 'Contact message is invalid.');
      }
      const { text, html } = renderContactMessage(message);
      const response = await fetchImpl(endpoint, {
        method: 'POST',
        headers: {
          authorization: `Bearer ${normalizedApiKey}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          from: normalizedFrom,
          to: [normalizedTo],
          reply_to: message.email,
          subject: `LegendMural contact — ${message.subject}`,
          text,
          html,
          tags: [{ name: 'category', value: 'contact_form' }],
        }),
      });

      let payload = null;
      try {
        payload = await response.json();
      } catch {
        payload = null;
      }
      if (!response.ok || !payload?.id) {
        fail('RESEND_CONTACT_DELIVERY_REJECTED', 'Resend did not accept the contact message.', {
          status: Number(response.status) || 0,
        });
      }
      return Object.freeze({ accepted: true, providerMessageId: String(payload.id) });
    },
  });
}

export { RESEND_EMAIL_ENDPOINT };
