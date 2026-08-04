import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';

import { createAuthoritativeOrderQuote } from '../server/commerce/order-quote.mjs';
import {
  createOrderStatusUpdate,
  createPendingOrderRecord,
} from '../server/orders/order-status.mjs';
import {
  createStripeWebhookSignature,
  verifyAndNormalizeStripeWebhook,
} from '../server/payments/stripe-webhook.mjs';

const catalog = JSON.parse(
  await readFile(new URL('../data/products/catalog.json', import.meta.url), 'utf8'),
).products;
const secret = 'whsec_validation_only_secret';
const now = 1_800_000_000;
const errors = [];

for (const [index, product] of catalog.entries()) {
  const reference = createHash('sha256')
    .update(`webhook-validation:${product.page}`)
    .digest('hex');
  const sessionId = `cs_test_webhook_validation_${index}`;

  try {
    const quote = createAuthoritativeOrderQuote({
      items: [{ page: product.page, quantity: 1, price: 0.01 }],
      countryCode: 'NL',
      discountCode: 'LEGEND10',
    }, catalog);

    const stripeEvent = {
      id: `evt_test_webhook_validation_${index}`,
      type: 'checkout.session.completed',
      created: now,
      livemode: false,
      data: {
        object: {
          id: sessionId,
          client_reference_id: reference,
          amount_total: quote.amountInCents.grandTotal,
          currency: 'eur',
          payment_status: 'paid',
          metadata: { order_reference: reference },
        },
      },
    };
    const rawBody = Buffer.from(JSON.stringify(stripeEvent), 'utf8');
    const signature = createStripeWebhookSignature({
      rawBody,
      secret,
      timestamp: now,
    });
    const event = verifyAndNormalizeStripeWebhook({
      rawBody,
      signatureHeader: `t=${now},v1=${signature}`,
      secret,
      now,
    });
    const order = createPendingOrderRecord({
      reference,
      amountTotal: quote.amountInCents.grandTotal,
      currency: quote.currency,
      mode: 'test',
      paymentSessionId: sessionId,
      createdAt: now - 60,
    });
    const updated = createOrderStatusUpdate(order, event);

    if (updated.status !== 'paid') {
      errors.push(`${product.page}: signed paid event did not mark the order paid.`);
    }
    if (updated.amountTotal !== quote.amountInCents.grandTotal) {
      errors.push(`${product.page}: order amount changed during webhook processing.`);
    }
    if (updated.paymentSessionId !== sessionId) {
      errors.push(`${product.page}: Checkout Session identity was not preserved.`);
    }
    if (updated.lastStripeEventId !== stripeEvent.id) {
      errors.push(`${product.page}: Stripe event identity was not recorded.`);
    }
  } catch (error) {
    errors.push(`${product.page}: ${error.code || error.name}: ${error.message}`);
  }
}

try {
  const rawBody = Buffer.from(JSON.stringify({
    id: 'evt_test_tamper_check',
    type: 'customer.created',
    created: now,
    livemode: false,
    data: { object: { id: 'cus_test' } },
  }), 'utf8');
  const signature = createStripeWebhookSignature({ rawBody, secret, timestamp: now });
  const tampered = Buffer.from(rawBody.toString('utf8').replace('cus_test', 'cus_changed'), 'utf8');
  verifyAndNormalizeStripeWebhook({
    rawBody: tampered,
    signatureHeader: `t=${now},v1=${signature}`,
    secret,
    now,
  });
  errors.push('Tampered webhook body was accepted.');
} catch (error) {
  if (error.code !== 'INVALID_STRIPE_SIGNATURE') {
    errors.push(`Tamper check failed with unexpected error: ${error.code || error.name}.`);
  }
}

if (errors.length) {
  console.error('Stripe webhook validation failed:');
  errors.forEach((error) => console.error(`- ${error}`));
  process.exit(1);
}

console.log(
  `Stripe webhook validation passed for ${catalog.length} NL product checkouts with signed events, exact amounts and authoritative paid transitions.`,
);
