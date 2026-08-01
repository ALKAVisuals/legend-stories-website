# Neon integration activation

This repository already contains a dormant Neon Postgres order-store adapter and the provider-neutral order-store conformance suite. This document defines the remaining activation work without enabling checkout or changing Netlify.

## Pinned runtime dependencies

The integration uses:

- `@neondatabase/serverless` `1.0.2`
- `ws` `8.21.1`

The Neon driver requires Node.js 19 or newer. Repository CI currently uses Node.js 20.

## Required test secrets

The manual integration workflow requires both repository or environment secrets:

- `NEON_TEST_DATABASE_URL`: pooled TLS URL for the isolated runtime branch.
- `NEON_TEST_MIGRATION_URL`: direct TLS URL for schema migrations and fixture cleanup.

Never print either value. The workflow passes them only through process environment variables.

## Manual integration workflow

Run **Neon order-store integration** through GitHub Actions after issue #31 is complete.

The workflow:

1. refuses to run when either secret is absent;
2. installs the exact dependency lock;
3. applies `server/db/migrations/001_create_order_store.sql` through the direct migration URL;
4. clears only synthetic records in the isolated branch;
5. runs the complete provider-neutral conformance suite against the real Neon adapter;
6. clears synthetic records again even after test failure;
7. runs the normal credential-free Neon architecture validation.

## Safety boundaries

- The workflow is `workflow_dispatch` only.
- It uses `contents: read`.
- It does not create, delete, or reset Neon branches.
- It does not touch Netlify.
- It does not configure browser endpoint constants.
- It does not use Stripe keys.
- It must only target the isolated `order-store-integration` branch with synthetic data.

## Activation sequence after a green integration run

A later, separately approved deployment sprint may:

1. create thin serverless adapters for checkout, webhook, and status handlers;
2. configure a staging deployment with test Stripe keys;
3. set browser endpoint URLs only for staging;
4. complete an end-to-end test payment;
5. verify webhook-driven `paid` status and paid-only cart cleanup;
6. keep production and live Stripe mode disabled until a separate launch approval.
