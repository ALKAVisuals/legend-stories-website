# Stripe Webhook and Order Status Contract

## Current status

The repository contains a platform-neutral Stripe webhook handler, but it is not deployed and cannot update orders without two server-side dependencies:

1. `STRIPE_WEBHOOK_SECRET`, a Stripe signing secret beginning with `whsec_`;
2. a persistent `paymentStore` implementing the atomic event-processing contract.

No webhook secret, database adapter, Netlify function or deployment configuration is included.

## Security boundary

`server/payments/stripe-webhook.mjs` verifies Stripe webhook requests from the exact raw request bytes before parsing JSON.

The verifier:

- parses the `Stripe-Signature` timestamp and all `v1` signatures;
- calculates an HMAC-SHA256 signature using the webhook secret;
- compares signatures with `timingSafeEqual`;
- rejects modified request bodies;
- rejects signatures outside the configured time tolerance;
- validates Stripe event identity, Checkout Session identity and test/live mode;
- requires a 64-character order reference in both the Checkout Session and metadata;
- requires integer-cent amounts and EUR currency;
- ignores unrelated, correctly signed Stripe event types.

Live webhook events are rejected unless the server explicitly sets:

```text
STRIPE_ALLOW_LIVE=true
```

## Supported events

The current payment-status contract handles:

- `checkout.session.completed`;
- `checkout.session.async_payment_succeeded`;
- `checkout.session.async_payment_failed`;
- `checkout.session.expired`.

A completed Checkout Session is only marked `paid` when Stripe reports `payment_status: paid`. Otherwise it enters `payment_processing`.

## Order status rules

The order record contains at least:

- `reference`;
- `status`;
- `amountTotal` in integer cents;
- `currency`;
- `mode` (`test` or `live`);
- `paymentSessionId`;
- `version`.

Before applying an event, `server/orders/order-status.mjs` requires exact equality for:

- order reference;
- amount in cents;
- currency;
- test/live mode;
- Checkout Session ID when one is already stored.

A paid order cannot be downgraded by an older failure or expiry event. A later, correctly signed paid event can recover a non-paid state when all order fields still match.

## Atomic payment-store contract

The webhook handler requires:

```js
paymentStore.processStripeEvent(paymentEvent, createUpdate)
```

The adapter must perform the following in one atomic transaction:

1. check whether `paymentEvent.eventId` was already processed;
2. load the order by `paymentEvent.reference`;
3. call `createUpdate(order)` only for a new event;
4. save the updated order with optimistic version protection;
5. record the Stripe event ID as processed;
6. commit both writes together.

The method returns:

```js
{
  duplicate: false,
  order: updatedOrder,
}
```

For a previously processed event it returns:

```js
{
  duplicate: true,
  order: existingOrder,
}
```

A non-transactional implementation is not acceptable because Stripe retries webhook events and simultaneous deliveries are possible.

## HTTP behavior

`server/api/stripe-webhook.mjs`:

- accepts only `POST` with `application/json`;
- limits the raw body to 1 MiB;
- does not enable browser CORS;
- returns `503` when the secret or persistent store is missing;
- returns `400` for invalid signatures or invalid Stripe events;
- returns `409` for order identity, amount, currency, mode or session conflicts;
- acknowledges unrelated signed event types with `200`;
- acknowledges duplicate supported events with `200` without applying a second update.

## Future deployment checklist

1. Create the pending order record before returning the Checkout Session URL to the browser.
2. Persist the Stripe Checkout Session ID on that order.
3. Implement the atomic `paymentStore` contract in a durable database.
4. Deploy a thin adapter around `handleStripeWebhook()`.
5. Configure a Stripe test webhook endpoint and `whsec_` secret.
6. Test valid, duplicate, delayed, modified and out-of-order events.
7. Add an authenticated order-status lookup for the return page.
8. Clear the browser cart only after the server reports the matching order as paid.
9. Add refund and dispute handling before enabling live mode.

## Validation

Run:

```bash
npm run validate:stripe-webhook
npm test
npm run quality
```

The catalog-wide webhook validation signs and verifies a paid Checkout event for all 111 products and checks exact order amounts before transitioning each test order to paid.
