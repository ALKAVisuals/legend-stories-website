# Order store conformance

Laatst inhoudelijk bijgewerkt: 14 augustus 2026.

## Purpose

LegendMural uses Neon Postgres as the durable order database. The order-store layer protects idempotent pending-order creation, safe reads and payment-state mutations under concurrency.

The original conformance contract was built during the Stripe-first phase and therefore still contains a legacy `processStripeEvent` capability. That capability remains tested while legacy Stripecode is present, but **Stripe is no longer the launch payment provider**.

The PayPal create/capture implementation reuses the durable pending-order and lookup capabilities and adds PayPal-specific capture persistence. A future PayPal webhook/reconciliation layer should complete the migration toward provider-neutral payment-event semantics.

## Current capabilities

Core order capabilities include:

```js
{
  persistPendingCheckout(order),
  getOrderByReference(reference)
}
```

Legacy Stripe event processing still exists temporarily:

```js
processStripeEvent(paymentEvent, createUpdate)
```

PayPal capture persistence adds the capability required to transactionally persist a verified capture.

## Conformance guarantees

The existing conformance suite verifies important durable-store behavior including:

1. new pending order creation;
2. exact read-back;
3. identical idempotent retry;
4. concurrent identical writes resolving to one create and one retry;
5. conflicting data under the same reference being rejected;
6. detached returned records;
7. transaction-safe payment mutation behavior;
8. unknown-order payment updates being rejected.

These guarantees remain relevant after Stripe removal.

## `persistPendingCheckout(order)` semantics

For a new reference:

```js
{
  created: true,
  order: completePersistedOrder
}
```

For an identical idempotent retry:

```js
{
  created: false,
  order: completeExistingOrder
}
```

For conflicting immutable data:

```text
ORDER_STORE_CONFLICT
```

The operation must be atomic and must compare the complete immutable order payload rather than relying only on a unique key.

## `getOrderByReference(reference)` semantics

Return the complete order or `null`. Returned objects must be detached values; mutating a returned value may not mutate durable state.

## Legacy `processStripeEvent`

This method remains in the codebase because the older Stripe webhook implementation is deliberately retained until PayPal staging is fully proven.

Its useful transactional properties should survive the PayPal webhook migration:

- globally unique provider event identity;
- duplicate event detection;
- lock/load referenced order;
- optimistic version enforcement;
- event and order mutation in one transaction;
- duplicate delivery must not apply the update twice.

When Stripe is removed, replace Stripe-specific naming/schema assumptions only after equivalent PayPal webhook/reconciliation behavior exists and passes real staging tests.

## PayPal capture persistence

The current PayPal flow validates and persists capture separately from the legacy Stripe event path.

It must guarantee:

- reference and PayPal order ID match the reserved order;
- amount and currency match the authoritative stored order;
- capture is idempotent;
- an already-paid order cannot be paid twice;
- successful API capture is reconciled into Neon;
- retryable database failures can be recovered without creating a second PayPal payment.

## Neon status

Neon is already selected and integrated.

Completed:

- schema/migrations;
- real isolated database run;
- conformance against real PostgreSQL;
- SERIALIZABLE transaction testing;
- row locking/version checks;
- JSONB serialization hardening;
- bounded retry/backoff for retryable transaction conflicts.

For production still required:

- separate production environment;
- dedicated least-privilege runtime role;
- backup/restore policy;
- privacy and retention policy.

## PayPal webhook migration target

The next payment-store evolution should introduce a provider-event contract suitable for PayPal webhook reconciliation without weakening the existing transaction guarantees.

Do not simply delete the old event contract first. Safe order:

1. design PayPal webhook verification and normalized event identity;
2. add transactional event reservation/reconciliation;
3. prove duplicate delivery and out-of-order behavior;
4. run PayPal Sandbox + Neon E2E;
5. only then remove Stripe-specific event capabilities and migrations if no longer required.

## Validation

Run:

```bash
npm run validate:order-store
npm run validate:neon-order-store
npm test
npm run quality
```

The complete quality chain still exercises legacy Stripe event semantics while that implementation remains in the repository.
