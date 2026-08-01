# Sprint 2Q — Stripe test Checkout endpoint

## Decision record

This sprint adds the server-side Stripe Checkout boundary without changing hosting or the live storefront checkout button.

### Why no deployment adapter yet

The current project instruction is to keep the work in GitHub and not modify Netlify. Serverless platforms expose different request and environment APIs, so the repository exports a standards-based `Request` → `Response` handler instead of committing a platform-specific wrapper.

### Why no browser redirect yet

The static storefront does not currently have a deployed checkout endpoint. Replacing the existing placeholder before an endpoint URL exists would break checkout. Frontend activation is intentionally deferred until a serverless platform and test endpoint are available.

### Why Stripe REST instead of an SDK dependency

The small Stripe client uses the documented HTTPS API with form-encoded parameters. This keeps the runtime dependency surface unchanged, supports Node 20 `fetch`, and makes test/live key enforcement explicit. A Stripe SDK adapter can be introduced later without changing the authoritative quote or Checkout Session payload contract.

## Exit criteria

- Stripe test keys accepted and live keys blocked by default;
- all product prices resolved from the central catalog;
- discount and shipping policies resolved server-side;
- exact integer-cent line-item reconciliation;
- deterministic idempotency keys;
- customer and origin validation;
- server-controlled success and cancellation URLs;
- all 111 catalog products convertible to a Stripe test Checkout Session;
- no Netlify, deployment, secret, webhook or live storefront changes.
