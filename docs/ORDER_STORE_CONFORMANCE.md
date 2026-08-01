# Order Store Conformance

## Purpose

Checkout creation, Stripe webhook processing and the browser return flow now depend on one logical order store. A future database adapter must implement all three capabilities consistently:

```js
{
  persistPendingCheckout(order),
  processStripeEvent(paymentEvent, createUpdate),
  getOrderByReference(reference),
}
```

The repository does not select or configure a database provider. The contract and conformance suite are provider-neutral.

## Central capability contract

`server/orders/store-contract.mjs` defines the canonical method names and validates complete or capability-specific adapters.

The existing server boundaries use the same contract:

- Checkout requires `persistPendingCheckout`;
- the Stripe webhook requires `processStripeEvent`;
- order-status lookup requires `getOrderByReference`.

A partial adapter may be injected into one isolated handler during development, but a production order store must pass the complete contract.

## Conformance suite

`server/orders/store-conformance.mjs` exports:

```js
runOrderStoreConformance(createStore)
```

`createStore` must return a fresh, isolated adapter for every scenario. The suite verifies:

1. all three required capabilities exist;
2. a new pending order is created and can be read back exactly;
3. an identical retry returns the same order with `created: false`;
4. two concurrent identical writes resolve as exactly one creation and one retry;
5. conflicting data under the same reference is rejected with `ORDER_STORE_CONFLICT`;
6. retrieved records are detached from durable state;
7. two concurrent deliveries of the same Stripe event apply the order update exactly once;
8. a Stripe event for an unknown order is rejected with `ORDER_NOT_FOUND`.

## Required semantics

### `persistPendingCheckout(order)`

For a new reference:

```js
{
  created: true,
  order: completePersistedOrder,
}
```

For an identical idempotent retry:

```js
{
  created: false,
  order: completeExistingOrder,
}
```

For a conflicting retry, reject with:

```text
ORDER_STORE_CONFLICT
```

The operation must be atomic. A unique reference constraint alone is not sufficient unless the adapter also loads and compares the complete immutable order payload.

### `processStripeEvent(paymentEvent, createUpdate)`

For a new event ID:

```js
{
  duplicate: false,
  order: updatedOrder,
}
```

For a previously committed event ID:

```js
{
  duplicate: true,
  order: currentOrder,
}
```

The following must happen in one database transaction:

1. reserve or check the globally unique Stripe event ID;
2. lock/load the referenced order;
3. call `createUpdate(order)` only for a new event;
4. enforce the optimistic version increment;
5. write the updated order;
6. mark the event ID processed;
7. commit both changes together.

A duplicate event must never call `createUpdate` a second time.

### `getOrderByReference(reference)`

Return the complete order or `null`. Returned objects must be detached values; mutating a returned object may not mutate durable state.

## Reference implementation

`tests/support/reference-order-store.mjs` is an in-memory transactional reference used only by tests and validation. It is not a production database adapter and must never be used as durable storage.

## Testing a future adapter

A provider adapter should include its own integration test:

```js
import { runOrderStoreConformance } from './server/orders/store-conformance.mjs';
import { createDatabaseOrderStore } from './server/adapters/database-order-store.mjs';

await runOrderStoreConformance(async () => {
  const database = await createIsolatedTestDatabase();
  return createDatabaseOrderStore(database);
});
```

Each suite run requires an isolated schema, transaction namespace or temporary database.

## Database requirements

Any selected database must support:

- unique order references;
- globally unique Stripe event IDs;
- transactions spanning event and order writes;
- row locking or equivalent serializable conflict protection;
- optimistic order versions;
- durable JSON or normalized storage for the immutable fulfillment payload;
- encrypted transport, access controls, backups and retention/deletion procedures.

## Current deployment status

No database adapter, credentials, secrets, serverless adapter or Netlify configuration is included. Checkout and order-status endpoint constants remain empty, so the storefront still cannot initiate a hosted payment.

## Validation

Run:

```bash
npm run validate:order-store
npm test
npm run quality
```

The validation command runs the provider-neutral suite against the transactional reference adapter. A future real adapter must run the same suite against an isolated instance of its actual database.
