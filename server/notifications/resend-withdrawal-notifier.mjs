const RESEND_EMAIL_ENDPOINT = 'https://api.resend.com/emails';

export class ResendNotifierError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = 'ResendNotifierError';
    this.code = code;
    this.details = details;
  }
}

function fail(code, message, details) {
  throw new ResendNotifierError(code, message, details);
}

function requiredText(value, field, maxLength) {
  const normalized = String(value || '').trim();
  if (!normalized || normalized.length > maxLength || /[\u0000-\u001F\u007F]/.test(normalized)) {
    fail('RESEND_NOTIFIER_INVALID_CONFIG', `${field} is invalid.`, { field });
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

function renderWithdrawalConfirmation(message) {
  const orderId = escapeHtml(message.data.orderId);
  const confirmationCode = escapeHtml(message.data.confirmationCode);
  const withdrawnAtIso = escapeHtml(message.data.withdrawnAtIso);
  const text = [
    'LegendMural withdrawal confirmation',
    '',
    `Order ID: ${message.data.orderId}`,
    `Confirmation code: ${message.data.confirmationCode}`,
    `Received at: ${message.data.withdrawnAtIso}`,
    '',
    'We have recorded your withdrawal request. This confirmation does not by itself confirm that a refund has been completed.',
    '',
    'Keep this email for your records.',
  ].join('\n');
  const html = `<!doctype html><html><body style="font-family:Arial,sans-serif;line-height:1.5;color:#111"><h1 style="font-size:20px">LegendMural withdrawal confirmation</h1><p>We have recorded your withdrawal request.</p><p><strong>Order ID:</strong> ${orderId}<br><strong>Confirmation code:</strong> ${confirmationCode}<br><strong>Received at:</strong> ${withdrawnAtIso}</p><p>This confirmation does not by itself confirm that a refund has been completed.</p><p>Keep this email for your records.</p></body></html>`;
  return { text, html };
}

export function createResendWithdrawalNotifier({
  apiKey,
  from,
  fetchImpl = globalThis.fetch,
  endpoint = RESEND_EMAIL_ENDPOINT,
} = {}) {
  const normalizedApiKey = requiredText(apiKey, 'apiKey', 512);
  const normalizedFrom = requiredText(from, 'from', 320);
  if (typeof fetchImpl !== 'function') {
    fail('RESEND_NOTIFIER_INVALID_CONFIG', 'fetchImpl must be a function.', { field: 'fetchImpl' });
  }

  return Object.freeze({
    async sendWithdrawalConfirmation(message) {
      if (!message || message.template !== 'withdrawal-confirmation') {
        fail('RESEND_NOTIFIER_INVALID_MESSAGE', 'Unsupported notification message.');
      }
      const { text, html } = renderWithdrawalConfirmation(message);
      const response = await fetchImpl(endpoint, {
        method: 'POST',
        headers: {
          authorization: `Bearer ${normalizedApiKey}`,
          'content-type': 'application/json',
          'idempotency-key': `withdrawal-${message.data.confirmationCode}`,
        },
        body: JSON.stringify({
          from: normalizedFrom,
          to: [message.to],
          subject: message.subject,
          text,
          html,
          tags: [{ name: 'category', value: 'withdrawal_confirmation' }],
        }),
      });

      let payload = null;
      try {
        payload = await response.json();
      } catch {
        payload = null;
      }
      if (!response.ok || !payload?.id) {
        fail('RESEND_DELIVERY_REJECTED', 'Resend did not accept the withdrawal confirmation.', {
          status: Number(response.status) || 0,
        });
      }
      return Object.freeze({ accepted: true, providerMessageId: String(payload.id) });
    },
  });
}

export { RESEND_EMAIL_ENDPOINT };
