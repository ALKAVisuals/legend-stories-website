import test from 'node:test';
import assert from 'node:assert/strict';

import { handleStripeWebhook } from '../server/api/stripe-webhook.mjs';
import { createPendingOrderRecord } from '../server/orders/order-status.mjs';
import { createStripeWebhookSignature } from '../server/payments/stripe-webhook.mjs';

const secret = 'whsec_handler_test_secret';
const now = 1_800_000_000;
const reference = 'd'.repeat(64);

function checkoutEvent(overrides = {}) {
  return {
    id: 'evt_test_handler_completed',
    type: 'checkout.session.completed',
    created: now,
    livemode: false,
    data: {
      object: {
        id: 'cs_test_handler_webhook',
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

function signedRequest(event = checkoutEvent(), {
  signingSecret = secret,
  signatureOverride = '',
} = {}) {
  const rawBody = JSON.stringify(event);
  const signature = signatureOverride || createStripeWebhookSignature({
    rawBody,
    secret: signingSecret,
    timestamp: now,
  });
  return new Request('https://payments.example/api/stripe-webhook', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Stripe-Signature': `t=${now},v1=${signature}`,
    },
    body: rawBody,
  });
}

function createMemoryPaymentStore(initialOrder) {
  const orders = new Map([[initialOrder.reference, initialOrder]]);
  const events = new Set();
  let calls = 0;

  return {
    get calls() {
      return calls;
    },
    get order() {
      return orders.get(initialOrder.reference);
    },
    async processStripeEvent(event, createUpdate) {
      calls += 1;
      const existing = orders.get(event.reference);
      if (!existing) {
        const error = new Error('Order not found');
        error.code = 'ORDER_NOT_FOUND';
        throw error;
      }
      if (events.has(event.eventId)) {
        return { duplicate: true, order: existing };
      }
      const updated = createUpdate(existing);
      orders.set(event.reference, updated);
      events.add(event.eventId);
      return { duplicate: false, order: updated };
    },
  };
}

function pendingOrder() {
  return createPendingOrderRecord({
    reference,
    amountTotal: 5390,
    mode: 'test',
    paymentSessionId: 'cs_test_handler_webhook',
    createdAt: now - 60,
  });
}

test('signed webhook atomically marks the matching order paid', async () => {
  const paymentStore = createMemoryPaymentStore(pendingOrder());
  const response = await handleStripeWebhook(signedRequest(), {
    env: { STRIPE_WEBHOOK_SECRET: secret },
    paymentStore,
    now,
  });
  const result = await response.json();

  assert.equal(response.status, 200);
  assert.equal(result.received, true);
  assert.equal(result.duplicate, false);
  assert.equal(result.status, 'paid');
  assert.equal(paymentStore.order.status, 'paid');
  assert.equal(paymentStore.order.version, 1);
});

test('duplicate Stripe event IDs are acknowledged without applying a second transition', async () => {
  const paymentStore = createMemoryPaymentStore(pendingOrder());
  const first = await handleStripeWebhook(signedRequest(), {
    env: { STRIPE_WEBHOOK_SECRET: secret },
    paymentStore,
    now,
  });
  assert.equal(first.status, 200);

  const second = await handleStripeWebhook(signedRequest(), {
    env: { STRIPE_WEBHOOK_SECRET: secret },
    paymentStore,
    now,
  });
  const result = await second.json();
  assert.equal(second.status, 200);
  assert.equal(result.duplicate, true);
  assert.equal(paymentStore.order.version, 1);
});

test('invalid signatures are rejected before the payment store is called', async () => {
  const paymentStore = createMemoryPaymentStore(pendingOrder());
  const response = await handleStripeWebhook(signedRequest(checkoutEvent(), {
    signatureOverride: '0'.repeat(64),
  }), {
    env: { STRIPE_WEBHOOK_SECRET: secret },
    paymentStore,
    now,
  });
  const result = await response.json();

  assert.equal(response.status, 400);
  assert.equal(result.error.code, 'INVALID_STRIPE_SIGNATURE');
  assert.equal(paymentStore.calls, 0);
});

test('supported events fail closed when persistent atomic storage is absent', async () => {
  const response = await handleStripeWebhook(signedRequest(), {
    env: { STRIPE_WEBHOOK_SECRET: secret },
    now,
  });
  const result = await response.json();

  assert.equal(response.status, 503);
  assert.equal(result.error.code, 'PAYMENT_STORE_NOT_CONFIGURED');
});

test('unsupported signed event types are safely acknowledged without storage', async () => {
  const response = await handleStripeWebhook(signedRequest({
    id: 'evt_test_customer_created',
    type: 'customer.created',
    created: now,
    livemode: false,
    data: { object: { id: 'cus_test' } },
  }), {
    env: { STRIPE_WEBHOOK_SECRET: secret },
    now,
  });
  const result = await response.json();

  assert.equal(response.status, 200);
  assert.equal(result.ignored, true);
  assert.equal(result.eventType, 'customer.created');
});

test('webhook handler requires a secret and blocks live events by default', async () => {
  const noSecret = await handleStripeWebhook(signedRequest(), {
    env: {},
    now,
  });
  assert.equal(noSecret.status, 503);

  const liveReference = 'e'.repeat(64);
  const liveEvent = checkoutEvent({
    id: 'evt_live_handler',
    livemode: true,
    data: {
      object: {
        ...checkoutEvent().data.object,
        id: 'cs_live_handler_webhook',
        client_reference_id: liveReference,
        metadata: { order_reference: liveReference },
      },
    },
  });
  const liveResponse = await handleStripeWebhook(signedRequest(liveEvent), {
    env: { STRIPE_WEBHOOK_SECRET: secret },
    now,
  });
  const result = await liveResponse.json();
  assert.equal(liveResponse.status, 403);
  assert.equal(result.error.code, 'LIVE_WEBHOOK_DISABLED');
});
