import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createResendWithdrawalNotifier,
  ResendNotifierError,
  RESEND_EMAIL_ENDPOINT,
} from '../server/notifications/resend-withdrawal-notifier.mjs';

const message = {
  to: 'customer@example.com',
  template: 'withdrawal-confirmation',
  subject: 'LegendMural withdrawal confirmation — 82T24251E7500724R',
  data: {
    consumerName: 'Ada Example',
    confirmationEmail: 'customer@example.com',
    orderId: '82T24251E7500724R',
    confirmationCode: 'LM-WD-0123456789ABCDEF',
    withdrawnAt: 1786819200,
    withdrawnAtIso: '2026-08-15T16:00:00.000Z',
  },
};

test('sends statutory withdrawal acknowledgement content to the Resend email endpoint', async () => {
  let captured;
  const notifier = createResendWithdrawalNotifier({
    apiKey: 're_test_key',
    from: 'LegendMural <orders@example.com>',
    fetchImpl: async (url, options) => {
      captured = { url, options };
      return { ok: true, status: 200, async json() { return { id: 'resend-message-123' }; } };
    },
  });

  const result = await notifier.sendWithdrawalConfirmation(message);
  assert.equal(result.accepted, true);
  assert.equal(result.providerMessageId, 'resend-message-123');
  assert.equal(captured.url, RESEND_EMAIL_ENDPOINT);
  assert.equal(captured.options.method, 'POST');
  assert.equal(captured.options.headers.authorization, 'Bearer re_test_key');
  assert.equal(captured.options.headers['idempotency-key'], 'withdrawal-LM-WD-0123456789ABCDEF');

  const payload = JSON.parse(captured.options.body);
  assert.equal(payload.from, 'LegendMural <orders@example.com>');
  assert.deepEqual(payload.to, ['customer@example.com']);
  assert.match(payload.subject, /82T24251E7500724R/);
  assert.match(payload.text, /Ada Example/);
  assert.match(payload.text, /customer@example\.com/);
  assert.match(payload.text, /I withdraw from the contract identified by the Order ID below/);
  assert.match(payload.text, /2026-08-15T16:00:00\.000Z/);
  assert.match(payload.text, /LM-WD-0123456789ABCDEF/);
  assert.match(payload.html, /Ada Example/);
  assert.match(payload.html, /I withdraw from the contract identified by the Order ID below/);
  assert.match(payload.html, /2026-08-15T16:00:00\.000Z/);
  assert.deepEqual(payload.tags, [{ name: 'category', value: 'withdrawal_confirmation' }]);
});

test('rejects unsupported notification message types before network delivery', async () => {
  let calls = 0;
  const notifier = createResendWithdrawalNotifier({
    apiKey: 're_test_key',
    from: 'LegendMural <orders@example.com>',
    fetchImpl: async () => {
      calls += 1;
      return { ok: true, status: 200, async json() { return { id: 'unexpected' }; } };
    },
  });

  await assert.rejects(
    notifier.sendWithdrawalConfirmation({ ...message, template: 'marketing-email' }),
    (error) => error instanceof ResendNotifierError && error.code === 'RESEND_NOTIFIER_INVALID_MESSAGE',
  );
  assert.equal(calls, 0);
});

test('fails closed when Resend does not accept the email', async () => {
  const notifier = createResendWithdrawalNotifier({
    apiKey: 're_test_key',
    from: 'LegendMural <orders@example.com>',
    fetchImpl: async () => ({ ok: false, status: 422, async json() { return { message: 'invalid from' }; } }),
  });

  await assert.rejects(
    notifier.sendWithdrawalConfirmation(message),
    (error) => error instanceof ResendNotifierError
      && error.code === 'RESEND_DELIVERY_REJECTED'
      && error.details.status === 422,
  );
});

test('requires explicit provider configuration', () => {
  assert.throws(
    () => createResendWithdrawalNotifier({ apiKey: '', from: 'LegendMural <orders@example.com>' }),
    (error) => error instanceof ResendNotifierError && error.code === 'RESEND_NOTIFIER_INVALID_CONFIG',
  );
});
