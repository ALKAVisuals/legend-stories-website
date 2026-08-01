# ADR 0001 — Neon Postgres for durable order storage

- Status: Accepted
- Date: 2026-08-01
- Scope: Checkout reservations, Stripe webhook idempotency and public order-status lookup

## Decision

LegendMural will use **Neon Postgres** as the durable order database, created in **AWS Europe (Frankfurt)**. The future server adapter will run in **Netlify Functions**, but this ADR does not add or modify Netlify configuration.

The production order-store implementation must use the existing provider-neutral interface:

```js
{
  persistPendingCheckout(order),
  processStripeEvent(paymentEvent, createUpdate),
  getOrderByReference(reference),
}
```

Runtime database operations that require conditional decisions will use an interactive PostgreSQL transaction through the Neon serverless driver's `Client` API over WebSockets. Every write transaction must use `SERIALIZABLE` isolation, explicit row locking and optimistic version checks.

## Why Neon

### Exact fit for the current architecture

LegendMural needs a transactional Postgres database, not a complete backend platform. Neon provides managed Postgres, serverless connection options and an official Netlify Functions integration guide.

### Transaction and concurrency model

The current order-store contract requires:

- atomic pending-order creation;
- exact idempotent retries;
- row locking while processing Stripe events;
- a globally unique Stripe event ID;
- optimistic order versions;
- rollback of the event reservation when the referenced order is missing;
- exactly-once execution of `createUpdate()` for duplicate webhook deliveries.

PostgreSQL supports this model directly. The Neon serverless driver supports interactive transactions through its `Client`/`Pool` interface and non-interactive transactions over HTTP. This adapter uses the interactive path because Stripe event processing must inspect a locked row before calculating the next order state.

### Serverless and Netlify compatibility

Neon documents a direct integration with Netlify Functions. The production runtime will use one short-lived client per transaction and close it in `finally`; no database connection may outlive a function request.

### European location and privacy

The production project must be created in `aws-eu-central-1` (Frankfurt). Customer and order data must not be copied to preview branches unless it is anonymized. Development and CI branches should use synthetic conformance fixtures only.

### Test isolation

Neon database branches are a strong match for the existing provider-neutral conformance suite. A future integration workflow can create an isolated branch, apply migrations, run all order-store scenarios and delete the branch without sharing mutable test state.

## Alternatives considered

### Supabase Postgres

Supabase is a strong managed-Postgres alternative with EU regions, connection pooling, daily backups and optional point-in-time recovery. It was not selected because LegendMural currently needs only the database layer; Supabase Auth, Storage, Realtime and Data API would add platform surface that is not required for checkout.

### Cloudflare D1

D1 is attractive for low operational cost, Western Europe locality and built-in Time Travel. It uses SQLite semantics rather than PostgreSQL, however. Selecting it would require a separate concurrency and locking design instead of implementing the existing Postgres-oriented contract directly.

### Self-managed Postgres

Rejected for the current stage because operating upgrades, failover, encrypted backups, monitoring and disaster recovery would add disproportionate risk and maintenance.

## Required production configuration

No values are committed to Git. A deployment will eventually require:

- `DATABASE_URL`: pooled Neon runtime connection string with TLS required;
- `DATABASE_MIGRATION_URL`: direct Neon connection used only by migration tooling;
- `STRIPE_SECRET_KEY`;
- `STRIPE_WEBHOOK_SECRET`;
- checkout success/cancel URLs and allowed origins;
- an explicit live-payment enablement flag.

The runtime database role must be dedicated to the application and must not own unrelated schemas. Migration credentials must not be available to browser code or ordinary request handlers.

## Backup and recovery policy

Before live payment activation:

1. configure a paid Neon plan appropriate for production;
2. verify the available restore window and snapshot policy in the Neon console;
3. perform and document one restore drill against a non-production branch;
4. define order-data retention and deletion procedures;
5. export periodic logical backups if the selected plan's native retention does not meet the business requirement.

## Deployment boundary

This ADR does **not**:

- create a Neon account or project;
- add database credentials;
- install the Neon runtime driver;
- create Netlify Functions;
- modify Netlify settings;
- configure browser endpoint URLs;
- enable Stripe test or live payments.

Those actions require a real Neon project and an isolated test branch so that the database adapter can run the existing conformance suite against actual PostgreSQL.

## Official references

- Neon Netlify Functions guide: https://neon.com/docs/guides/netlify-functions
- Neon serverless driver and transaction modes: https://neon.com/docs/serverless/serverless-driver
- Neon security and GDPR controls: https://neon.com/security
- Neon Frankfurt infrastructure: https://neon.com/docs/changelog/2026-02-20
- Supabase database overview: https://supabase.com/docs/guides/database/overview
- Supabase regions: https://supabase.com/docs/guides/platform/regions
- Cloudflare D1 overview: https://developers.cloudflare.com/d1/
- Cloudflare D1 data location: https://developers.cloudflare.com/d1/configuration/data-location/
