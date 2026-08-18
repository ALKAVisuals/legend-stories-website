#!/usr/bin/env node

import { createNeonWithdrawalStore } from '../server/adapters/neon-withdrawal-store.mjs';
import { createResendWithdrawalNotifier } from '../server/notifications/resend-withdrawal-notifier.mjs';
import { sendWithdrawalConfirmation } from '../server/notifications/withdrawal-confirmation.mjs';

const CONFIRMATION_CODE_PATTERN = /^LM-WD-[A-F0-9]{16}$/;

function requiredEnv(name) {
  const value = String(process.env[name] || '').trim();
  if (!value) throw new Error(`${name} is required.`);
  return value;
}

function errorCode(error) {
  return String(error?.code || error?.name || 'UNKNOWN').slice(0, 120);
}

async function main() {
  const confirmationCode = String(process.argv[2] || '').trim().toUpperCase();
  if (!CONFIRMATION_CODE_PATTERN.test(confirmationCode)) {
    throw new Error('Pass one canonical withdrawal confirmation code, for example LM-WD-0123456789ABCDEF.');
  }

  const store = createNeonWithdrawalStore({
    connectionString: requiredEnv('NEON_DATABASE_URL'),
  });
  const notifier = createResendWithdrawalNotifier({
    apiKey: requiredEnv('RESEND_API_KEY'),
    from: requiredEnv('RESEND_FROM'),
  });

  const acknowledgement = await store.getAcknowledgementByConfirmationCode(confirmationCode);
  if (!acknowledgement) {
    throw new Error('No acknowledgement exists for that confirmation code.');
  }
  if (acknowledgement.deliveryStatus === 'sent') {
    console.log(`Acknowledgement ${confirmationCode} is already recorded as sent; no retry performed.`);
    return;
  }

  const attemptedAt = Math.floor(Date.now() / 1000);
  try {
    const delivery = await sendWithdrawalConfirmation(notifier, {
      name: acknowledgement.consumerName,
      email: acknowledgement.confirmationEmail,
      orderId: acknowledgement.orderId,
      declaration: acknowledgement.declaration,
      confirmationCode: acknowledgement.confirmationCode,
      withdrawnAt: acknowledgement.withdrawnAt,
    });
    await store.recordAcknowledgementDelivery({
      confirmationCode,
      status: 'sent',
      attemptedAt,
      providerMessageId: delivery.providerMessageId,
    });
    console.log(`Acknowledgement ${confirmationCode} accepted for delivery and recorded as sent.`);
  } catch (error) {
    try {
      await store.recordAcknowledgementDelivery({
        confirmationCode,
        status: 'failed',
        attemptedAt,
        errorCode: errorCode(error),
      });
    } catch (stateError) {
      console.error(`Delivery-state persistence also failed: ${errorCode(stateError)}.`);
    }
    throw new Error(`Acknowledgement retry failed: ${errorCode(error)}.`);
  }
}

main().catch((error) => {
  console.error(error.message || 'Withdrawal acknowledgement retry failed.');
  process.exitCode = 1;
});
