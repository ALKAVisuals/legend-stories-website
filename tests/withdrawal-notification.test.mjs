import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createWithdrawalConfirmationMessage,
  sendWithdrawalConfirmation,
  WithdrawalNotificationError,
} from '../server/notifications/withdrawal-confirmation.mjs';

const base = {
  email: 'Customer@Example.com',
  orderId: '82T24251E7500724R',
  confirmationCode: 'WD-ABC12345',
  withdrawnAt: 1786819200,
};

test('creates a normalized provider-neutral withdrawal confirmation message', () => {
  const message = createWithdrawalConfirmationMessage(base);
  assert.equal(message.to, 'customer@example.com');
  assert.equal(message.template, 'withdrawal-confirmation');
  assert.match(message.subject, /82T24251E7500724R/);
  assert.equal(message.data.orderId, '82T24251E7500724R');
  assert.equal(message.data.confirmationCode, 'WD-ABC12345');
  assert.equal(message.data.withdrawnAt, base.withdrawnAt);
  assert.match(message.data.withdrawnAtIso, /^2026-/);
});

test('rejects invalid destination email before any transport call', async () => {
  let calls = 0;
  const notifier = {
    async sendWithdrawalConfirmation() {
      calls += 1;
      return { accepted: true };
    },
  };

  await assert.rejects(
    sendWithdrawalConfirmation(notifier, { ...base, email: 'not-an-email' }),
    (error) => error instanceof WithdrawalNotificationError
      && error.code === 'INVALID_WITHDRAWAL_NOTIFICATION',
  );
  assert.equal(calls, 0);
});

test('requires an explicit configured notification transport', async () => {
  await assert.rejects(
    sendWithdrawalConfirmation(null, base),
    (error) => error instanceof WithdrawalNotificationError
      && error.code === 'WITHDRAWAL_NOTIFIER_NOT_CONFIGURED',
  );
});

test('passes only the normalized confirmation message to the provider adapter', async () => {
  let received;
  const notifier = {
    async sendWithdrawalConfirmation(message) {
      received = message;
      return { accepted: true, providerMessageId: 'provider-123' };
    },
  };

  const result = await sendWithdrawalConfirmation(notifier, base);
  assert.equal(result.accepted, true);
  assert.equal(result.providerMessageId, 'provider-123');
  assert.equal(received.to, 'customer@example.com');
  assert.deepEqual(Object.keys(received).sort(), ['data', 'subject', 'template', 'to']);
});

test('fails closed when the transport does not accept the confirmation', async () => {
  const notifier = {
    async sendWithdrawalConfirmation() {
      return { accepted: false };
    },
  };

  await assert.rejects(
    sendWithdrawalConfirmation(notifier, base),
    (error) => error instanceof WithdrawalNotificationError
      && error.code === 'WITHDRAWAL_NOTIFICATION_NOT_ACCEPTED',
  );
});
