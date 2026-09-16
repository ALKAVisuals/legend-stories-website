import assert from 'node:assert/strict';
import test from 'node:test';

import { createResendContactNotifier } from '../server/notifications/resend-contact-notifier.mjs';

test('Resend contact notifier escapes customer content and replies to the customer', async () => {
  const calls = [];
  const notifier = createResendContactNotifier({
    apiKey: 're_test_key',
    from: 'LegendMural <contact@example.com>',
    to: 'info@legendmural.com',
    async fetchImpl(url, options) {
      calls.push({ url, options });
      return new Response(JSON.stringify({ id: 'msg_123' }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    },
  });

  const result = await notifier.sendContactMessage({
    name: '<Ada>',
    email: 'ada@example.com',
    subject: 'Question & help',
    message: '<script>alert(1)</script>',
    submittedAtIso: '2026-09-14T10:00:00.000Z',
  });

  assert.deepEqual(result, { accepted: true, providerMessageId: 'msg_123' });
  assert.equal(calls.length, 1);
  const payload = JSON.parse(calls[0].options.body);
  assert.deepEqual(payload.to, ['info@legendmural.com']);
  assert.equal(payload.reply_to, 'ada@example.com');
  assert.equal(payload.subject, 'LegendMural contact — Question & help');
  assert.match(payload.html, /&lt;Ada&gt;/);
  assert.match(payload.html, /&lt;script&gt;alert\(1\)&lt;\/script&gt;/);
  assert.doesNotMatch(payload.html, /<script>/);
  assert.match(payload.text, /<script>alert\(1\)<\/script>/);
});

test('Resend contact notifier fails closed when provider rejects the email', async () => {
  const notifier = createResendContactNotifier({
    apiKey: 're_test_key',
    from: 'LegendMural <contact@example.com>',
    to: 'info@legendmural.com',
    async fetchImpl() {
      return new Response(JSON.stringify({ message: 'rejected' }), {
        status: 422,
        headers: { 'content-type': 'application/json' },
      });
    },
  });

  await assert.rejects(
    () => notifier.sendContactMessage({
      name: 'Ada',
      email: 'ada@example.com',
      subject: 'Question',
      message: 'Hello',
      submittedAtIso: '2026-09-14T10:00:00.000Z',
    }),
    (error) => error?.code === 'RESEND_CONTACT_DELIVERY_REJECTED',
  );
});
