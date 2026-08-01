import test from 'node:test';
import assert from 'node:assert/strict';

import {
  StripeWebhookError,
  createStripeWebhookSignature,
  normalizeStripeWebhookEvent,
  verifyAndNormalizeStripeWebhook,
  verifyStripeWebhookSignature,
} from '../server/payments/stripe-webhook.mjs';

const secret = 'whsec_unit_test_secret';
const timestamp = 1_800_000_000;
const reference = 'a'.repeat(64);

function checkoutEvent(overrides = {}) {
  return {
    id: 'evt_test_checkout_completed',
    type: 'checkout.session.completed',
    created: timestamp,
    livemode: false,
    data: {
      object: {
        id: 'cs_test_webhook_session',
        client_reference_id: reference,
        amount_total: 5390,
        currency: 'eur',
        payment_status: 'paid',
        metadata: { order_reference: reference },
      },
    },
    ...overrides,
  };
}

function signedBody(event = checkoutEvent(), signedAt = timestamp) {
  const rawBody = Buffer.from(JSON.stringify(event), 'utf8');
  const signature = createStripeWebhookSignature({
    rawBody,
    secret,
    timestamp: signedAt,
  });
  return {
    rawBody,
    signatureHeader: `t=${signedAt},v1=${signature}`,
  };
}

test('verifies the exact raw Stripe webhook body and normalizes payment status', () => {
  const signed = signedBody();
  const verified = verifyStripeWebhookSignature({
    ...signed,
    secret,
    now: timestamp,
  });
  assert.equal(verified.timestamp, timestamp);

  const event = verifyAndNormalizeStripeWebhook({
    ...signed,
    secret,
    now: timestamp,
  });
  assert.equal(event.reference, reference);
  assert.equal(event.sessionId, 'cs_test_webhook_session');
  assert.equal(event.amountTotal, 5390);
  assert.equal(event.currency, 'EUR');
  assert.equal(event.status, 'paid');
  assert.equal(event.livemode, false);
});

test('rejects modified webhook bodies and stale signatures', () => {
  const signed = signedBody();
  const tampered = Buffer.from(signed.rawBody.toString('utf8').replace('5390', '1'), 'utf8');
  assert.throws(
    () => verifyStripeWebhookSignature({
      rawBody: tampered,
      signatureHeader: signed.signatureHeader,
      secret,
      now: timestamp,
    }),
    (error) => error instanceof StripeWebhookError
      && error.code === 'INVALID_STRIPE_SIGNATURE',
  );

  assert.throws(
    () => verifyStripeWebhookSignature({
      ...signed,
      secret,
      now: timestamp + 301,
    }),
    (error) => error instanceof StripeWebhookError
      && error.code === 'STALE_STRIPE_SIGNATURE',
  );
});

test('normalizes asynchronous and expired Checkout events', () => {
  for (const [type, expectedStatus] of [
    ['checkout.session.async_payment_succeeded', 'paid'],
    ['checkout.session.async_payment_failed', 'payment_failed'],
    ['checkout.session.expired', 'expired'],
  ]) {
    const event = checkoutEvent({ type });
    assert.equal(normalizeStripeWebhookEvent(event).status, expectedStatus);
  }
});

test('acknowledges unsupported signed event types without payment data', () => {
  const event = normalizeStripeWebhookEvent({
    id: 'evt_test_customer_created',
    type: 'customer.created',
    created: timestamp,
    livemode: false,
    data: { object: { id: 'cus_test' } },
  });
  assert.equal(event.ignored, true);
  assert.equal(event.eventType, 'customer.created');
});

test('rejects mode, reference and currency mismatches', () => {
  for (const event of [
    checkoutEvent({ livemode: true }),
    checkoutEvent({
      data: { object: { ...checkoutEvent().data.object, client_reference_id: 'wrong' } },
    }),
    checkoutEvent({
      data: { object: { ...checkoutEvent().data.object, currency: 'usd' } },
    }),
  ]) {
    assert.throws(
      () => normalizeStripeWebhookEvent(event),
      (error) => error instanceof StripeWebhookError,
    );
  }
});
