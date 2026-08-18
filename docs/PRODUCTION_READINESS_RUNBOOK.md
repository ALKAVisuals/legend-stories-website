# LegendMural production-readiness runbook

Last reviewed: 15 August 2026.

This document is a **preflight and activation plan**. It does not authorize production changes. PayPal Live, production Neon schema changes, production Netlify secrets and destructive retention jobs remain disabled until their individual gates are explicitly approved.

## 1. Current verified state

### Storefront and payments

- Netlify is the single intended production host.
- PayPal is the only intended launch payment provider.
- PayPal Live remains fail-closed and disabled.
- Active Stripe checkout/webhook/runtime code has been removed; historical Stripe-compatible schema/history may remain.
- Legal/customer-operations work is being reviewed separately in PR #96.
- The definitive LegendMural public domain is still pending. Do not replace canonicals, callback origins or email-domain settings with a guessed hostname.

### Returns

- Alka Group / LegendMural uses the Dutch business address below as the parcel-return address:
  - Schutkolk 4 d 1
  - 6582 DB Heumen
  - The Netherlands
- Returns should include the LegendMural Order ID so the parcel can be matched to the purchase.
- Registering a withdrawal remains separate from physically returning a parcel and from executing a payment refund.

### Neon project observation

Read-only inspection of Neon project `Legendmural` (`super-shape-69972279`) on 15 August 2026 found:

- primary/default branch: `production` (`br-misty-cloud-as0rofc8`);
- the `production` branch currently contains **no `legend_commerce` tables**;
- `production` is currently reported as not protected;
- the production compute reports passwordless access enabled;
- project history retention is currently 21,600 seconds (6 hours);
- an isolated `order-store-integration` branch exists with the earlier order + PayPal schema;
- an older `mcp-migration-2026-08-15T16-00-55` branch also exists and must be reviewed before anyone decides whether it is safe to remove.

Do not interpret the branch names as proof of production readiness. The default branch is currently an empty commerce baseline.

## 2. Production bootstrap proof completed

A temporary Neon branch was created from the empty `production` baseline and removed after testing.

Verified on that temporary branch:

1. migrations `001` through `006` can build the complete commerce schema from an empty production-like baseline;
2. the resulting tables include `orders`, historical `stripe_events`, `paypal_webhook_events` and `withdrawal_requests`;
3. a PayPal order ID is classified by PostgreSQL as `payment_provider=paypal`;
4. a valid withdrawal record can reference the PayPal order;
5. a dedicated temporary runtime role receives SELECT access required for order lookup and SELECT/INSERT access to the withdrawal ledger;
6. that runtime role does **not** receive UPDATE, DELETE or TRUNCATE privileges on `withdrawal_requests`.

The temporary branch used for this proof was deleted after validation. No production schema or data was changed.

## 3. Required sequence before production traffic

### Gate A — merge and code baseline

- PR #96 and any follow-up fixes must be reviewed and green.
- Re-check current `main`, open PRs and all permanent CI checks immediately before the production-preparation branch is created.
- Production changes must reference an exact reviewed `main` SHA.

### Gate B — definitive public domain

When the real LegendMural domain is confirmed:

- attach/verify the domain on the intended Netlify site;
- verify HTTPS and redirect behaviour;
- replace old GitHub Pages canonical/Open Graph origins with the definitive HTTPS origin;
- configure PayPal return/cancel allow-list/origin settings only for the final storefront origin;
- verify no preview hostname can become an authoritative production canonical.

The domain gate may not be bypassed with a temporary guessed hostname.

### Gate C — transactional email

Resend transport code exists but remains inactive.

Before activation:

- verify the LegendMural sending domain in Resend;
- choose an explicit production `from` identity;
- keep `info@alkavisuals.nl` as the agreed customer-operations/reply address unless intentionally changed;
- store the API secret only in the production secret store, never in Git or browser code;
- test withdrawal confirmation in a non-production/controlled environment;
- verify retry/idempotency behaviour and that mail failure cannot erase a recorded withdrawal.

### Gate D — Neon security and recovery decisions

Before schema activation:

- protect the production branch where supported/appropriate;
- review and explicitly decide whether passwordless access may remain enabled;
- create separate migration-owner and dedicated least-privilege runtime credentials;
- ensure the runtime credential receives only the grants represented by migrations `002`, `004` and `006`;
- establish and document a recovery point / restore procedure immediately before migration;
- review whether the current 6-hour history-retention window is sufficient for launch operations and increase it if the selected Neon plan/operational requirement calls for a longer recovery window;
- document who is allowed to run migrations and who can access production data;
- review the stale non-production branches separately; do not delete them merely as part of a production migration.

### Gate E — production database bootstrap

The current `production` branch is empty for LegendMural commerce, so production must be bootstrapped **001 -> 006**, not merely patched with `005/006`.

Production migration procedure:

1. confirm the exact repository migration files against the reviewed `main` SHA;
2. confirm a recent restore point / recovery procedure;
3. use the direct migration endpoint and migration-owner credential;
4. substitute the explicit dedicated runtime role into the role placeholders;
5. execute migrations strictly in numerical order;
6. verify all expected tables, constraints and generated provider behaviour;
7. verify runtime grants with `has_table_privilege`-style checks before giving the application a production connection string;
8. run a credentialed smoke test using synthetic data only;
9. remove synthetic records using the migration/operations credential, never by granting destructive privileges to the runtime role;
10. record the migration timestamp, reviewed commit SHA and operator in the release log.

Do not point Netlify production checkout traffic at the database until this gate passes.

### Gate F — Netlify production configuration

Only after the database gate:

- configure the production Neon runtime URL as a server-side secret;
- configure PayPal production variables separately from staging variables;
- keep `PAYPAL_ALLOW_LIVE` disabled during infrastructure validation;
- configure Resend only after Gate C is complete;
- verify logs do not expose customer payloads, PayPal secrets or database URLs;
- run the production build and same-origin API smoke checks without accepting a real payment.

### Gate G — monitoring, incident and rollback

Before enabling live payments, define at minimum:

- owner for checkout/payment incidents;
- owner for customer withdrawal/refund requests;
- how failed PayPal webhooks are detected;
- how database/API failures are detected;
- where deployment/function logs are reviewed;
- rollback procedure for a bad Netlify deployment;
- database recovery procedure and decision authority;
- how to disable new checkout initiation without losing already-paid order reconciliation.

### Gate H — PayPal Live (separate approval)

PayPal Live remains a separate release phase and requires explicit approval after all prior gates pass.

Minimum sequence:

1. verified PayPal Business account;
2. dedicated Live app/credentials;
3. Live webhook configured for the definitive HTTPS domain/environment;
4. `PAYPAL_WEBHOOK_ID` matched to that exact Live webhook;
5. production Neon/runtime role already verified;
6. monitoring and incident process active;
7. one controlled low-value real order;
8. verify browser success flow, webhook reconciliation, Neon `paid`, customer confirmation and operational fulfillment record;
9. stop and investigate on any identity, amount, currency, webhook or persistence discrepancy.

## 4. Data retention guardrail

`docs/DATA_RETENTION_POLICY.md` is the source of truth for retention categories. No automated deletion or anonymisation should be activated merely because a date threshold exists.

Before enforcement, explicitly resolve:

- which fields inside `customer`, `items`, `shipping`, `discount` and `totals` are part of statutory accounting/order evidence;
- whether OSS/IOSS retention applies;
- legal/claims holds;
- backup copies and restore behaviour;
- dry-run reporting and approval.

## 5. Explicit non-goals before the domain is known

While the definitive LegendMural domain is pending, it is safe to continue with code review, tests, documentation, isolated database preflights and operational planning.

Do **not** yet:

- activate PayPal Live;
- apply migrations to Neon `production`;
- configure production Resend sending-domain secrets;
- publish guessed canonical URLs;
- remove historical Stripe schema/data merely for cosmetic cleanup;
- run retention deletion/anonymisation against real data.
