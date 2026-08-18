# LegendMural Neon Free-plan production controls

Last reviewed: 18 August 2026.

## Decision

LegendMural remains on the Neon **Free** plan for the current launch-preparation phase. This is an intentional cost decision, not an assumption that Free provides the same safeguards as a paid Neon plan.

The Free plan does not provide protected branches and currently limits instant-restore history to 6 hours. LegendMural therefore uses compensating controls until an upgrade is justified by production volume or risk.

## Accepted limitations

- `production` cannot be marked as a Neon protected branch on the current plan.
- The project history window remains 6 hours.
- The Free-plan recovery model must not rely only on point-in-time restore.
- Production database operations therefore require explicit operator approval and a pre-change recovery point.

## Production role model

The following roles now exist on the Neon production branch:

- `legendmural_runtime` — NOLOGIN privilege group used by migrations `002`, `004` and `006`.
- `legendmural_app` — NOLOGIN application role that is a member of `legendmural_runtime`.
- `legendmural_migrator` — NOLOGIN migration-owner role with `CONNECT` and `CREATE` on `neondb`, but without `CREATEDB`, `CREATEROLE`, `REPLICATION` or `BYPASSRLS`.

The roles remain NOLOGIN intentionally. Login credentials should be created just-in-time when production configuration is ready, stored only in the relevant secret manager / Netlify production environment, and never committed to the repository or copied into documentation.

`neondb_owner` is an operator/admin role and must not be used as the application runtime credential.

## Verified least-privilege contract

On 18 August 2026 a temporary child branch cloned from the current empty production baseline was used to execute the exact migration chain from Git commit `5bb4783ec83438bb1ebe5f25922fbd2a8d50e4a4`:

1. `001_create_order_store.sql`
2. `002_grant_order_store_runtime.sql`
3. `003_add_paypal_reconciliation.sql`
4. `004_grant_paypal_reconciliation_runtime.sql`
5. `005_create_withdrawal_requests.sql`
6. `006_grant_withdrawal_runtime.sql`

The migrations were executed under `legendmural_migrator`, with `legendmural_runtime` substituted for `__LEGEND_RUNTIME_ROLE__`.

The validation proved:

- all commerce tables and indexes are owned by `legendmural_migrator`;
- `legendmural_app` can use the privileges inherited from `legendmural_runtime`;
- `orders`: SELECT, INSERT and UPDATE are available; DELETE and TRUNCATE are denied;
- `stripe_events`: SELECT and INSERT are available; UPDATE, DELETE and TRUNCATE are denied;
- `paypal_webhook_events`: SELECT and INSERT are available; UPDATE, DELETE and TRUNCATE are denied;
- `withdrawal_requests`: SELECT and INSERT are available; UPDATE, DELETE and TRUNCATE are denied;
- a synthetic PayPal order ID generated `payment_provider=paypal`;
- a synthetic PayPal webhook record and withdrawal record could be inserted by the app role.

The temporary migration-validation branch was deleted after the test.

## Free-plan recovery point

A persistent child branch named `pre-prod-bootstrap-20260818` was created from the empty production baseline before production schema bootstrap.

- Branch ID: `br-long-field-aspnw4co`
- Parent: `production` (`br-misty-cloud-as0rofc8`)
- Purpose: preserve the pre-bootstrap baseline and role structure independently of the 6-hour production history window.

This branch must not be deleted until the production bootstrap and first controlled end-to-end launch validation have been completed and the release operator has intentionally retired the checkpoint.

The checkpoint is a compensating control, not a replacement for a proper backup strategy. If the product grows materially, upgrading Neon to gain protected branches and a longer restore window should be reconsidered.

## Free-plan operating rules

1. No destructive production database action is performed by automation without explicit operator approval.
2. Production schema migrations require a named pre-change recovery point.
3. Migrations are first proven on a child branch cloned from the current production baseline.
4. The migration URL must use the migration-owner credential and a direct, non-pooled endpoint.
5. The application runtime URL must use the least-privilege app credential, never `neondb_owner`.
6. Production credentials are created just-in-time and stored server-side only.
7. PayPal Live remains disabled until database, Netlify, email and monitoring gates are complete.
8. Temporary validation branches are deleted after successful verification.
9. The persistent pre-bootstrap checkpoint is retained through controlled launch verification.
10. An upgrade to Neon Launch is reconsidered once real customer/order volume makes branch protection and longer point-in-time recovery materially valuable.

## Current production state after this validation

As of 18 August 2026:

- production branch remains the default root branch;
- production is not protected because the organization is on Neon Free;
- history retention remains 6 hours;
- production contains no `legend_commerce` schema or commerce tables;
- production migrations `001–006` have **not** been executed;
- PayPal Live has not been enabled;
- no production Netlify database secret has been configured by this work;
- `pre-prod-bootstrap-20260818` is the preserved pre-bootstrap recovery checkpoint.

Production bootstrap remains a separate explicit approval step.