# Durable Checkout Persistence Contract

## Current status

The Checkout Session endpoint now requires a durable order store before it can return a Stripe Checkout URL.

No database adapter, Stripe secret, Netlify function or deployment configuration is included. With no `checkoutStore`, the endpoint returns `503 CHECKOUT_STORE_NOT_CONFIGURED` before contacting Stripe.

## Why this boundary is required

A Stripe webhook can only verify and update an order that already exists. A browser return URL is not payment proof and cannot safely create or mark an order paid.

The server flow is therefore:

1. validate the request and calculate the authoritative catalog quote;
2. create a Stripe Checkout Session with a deterministic idempotency key;
3. build an authoritative `payment_pending` order record;
4. atomically persist that pending order;
5. validate the store result against the Checkout reference, amount, currency, mode and session ID;
6. only then return the Stripe Checkout URL to the browser.

If persistence fails, the endpoint does not expose the Checkout URL. A retry uses the same Stripe idempotency key, allowing Stripe to return the same Checkout Session while storage is retried.

## Store interface

A future durable adapter must provide:

```js
checkoutStore.persistPendingCheckout(order)
```

It must atomically create the order by its 64-character reference or return the existing identical order.

New order result:

```js
{
  created: true,
  order: persistedOrder,
}
```

Idempotent retry result:

```js
{
  created: false,
  order: existingIdenticalOrder,
}
```

The adapter must reject conflicts. It may not silently return an order with a different:

- order reference;
- status;
- amount in cents;
- currency;
- test/live mode;
- Stripe Checkout Session ID.

## Pending order record

The server-generated record includes:

- deterministic order reference;
- `payment_pending` status;
- amount and totals in integer cents;
- EUR currency;
- test/live mode;
- Stripe Checkout Session ID;
- authoritative product names, prices, quantities and pages;
- normalized customer and delivery address;
- discount and shipping details;
- optimistic version number.

Browser-supplied names, prices and totals are not stored as authority.

## Failure behavior

- Missing store: Stripe is not contacted and the endpoint returns `503`.
- Store unavailable after Stripe session creation: the Checkout URL is withheld and the endpoint returns `503`.
- Existing conflicting order: the Checkout URL is withheld and the endpoint returns `409`.
- Invalid store result: the Checkout URL is withheld and the endpoint returns `503`.
- Successful identical retry: the existing pending order is accepted.

## Relationship to webhooks

The pending record is the source that `paymentStore.processStripeEvent()` later loads and updates after Stripe signature verification.

A production adapter can implement both interfaces on the same database-backed service:

```js
{
  persistPendingCheckout(order),
  processStripeEvent(paymentEvent, createUpdate),
}
```

Both methods require durable, atomic, idempotent database operations.

## Future deployment work

1. Select a durable database.
2. Implement unique constraints on order reference and Stripe event ID.
3. Implement `persistPendingCheckout()` transactionally.
4. Implement `processStripeEvent()` transactionally with optimistic version checks.
5. Add encryption/access controls for customer address data.
6. Add retention, deletion and audit policies.
7. Deploy thin adapters around the Checkout and webhook handlers.
8. Test interrupted requests, duplicate requests, Stripe retries and database outages in test mode.

## Validation

Run:

```bash
npm run validate:checkout-persistence
npm test
npm run quality
```

The catalog-wide validation creates and persists an authoritative pending Checkout record for every one of the 111 products and verifies fail-closed behavior when no store exists.
