# LegendMural incident and rollback runbook

Last reviewed: 18 August 2026.

This runbook is for operational response after production infrastructure exists. It does not authorize PayPal Live, production credential rotation, destructive recovery, refunds or Resend production activation.

## 1. First objective: stop new risk, preserve reconciliation

For a checkout/payment incident, stop **new checkout creation** while preserving the paths required to finish or reconcile orders already in flight.

Set the server-side Netlify production environment variable:

`LEGENDMURAL_CHECKOUT_PAUSED=true`

After the relevant Netlify configuration/deployment change is active, expected behavior is:

- `/api/paypal/checkout` returns HTTP 503 with `CHECKOUT_PAUSED` before Neon or PayPal checkout bootstrap runs;
- no new PayPal order is created through LegendMural checkout;
- `/api/paypal/capture` remains available for an already-approved in-flight order;
- `/api/paypal/webhook` remains available for reconciliation/recovery;
- `/api/order-status` remains available for durable browser status checks;
- withdrawal registration remains separate from this checkout pause.

Do **not** disable the database connection, PayPal webhook credentials or webhook route merely to stop new checkout creation. That can prevent reconciliation of orders already known to PayPal.

To resume new checkout creation, set `LEGENDMURAL_CHECKOUT_PAUSED=false` or remove the variable, activate the change intentionally, and perform a no-real-payment smoke check before reopening normal checkout.

## 2. Severity guide

### SEV-1 — payment integrity / data integrity risk

Examples:

- wrong amount or currency reaches PayPal;
- paid PayPal order cannot be reconciled to Neon;
- duplicate fulfilment risk;
- production database corruption or unauthorized mutation;
- secrets exposed in public output/logging;
- checkout points to the wrong PayPal environment or wrong database.

Immediate action:

1. pause new checkout creation;
2. preserve webhook/capture/status paths unless one of those paths is itself corrupting state;
3. record incident start time, deployment ID/SHA and current environment mode;
4. stop fulfilment for ambiguous orders until PayPal and Neon agree;
5. capture evidence before any cleanup SQL, rollback or restore.

### SEV-2 — checkout unavailable but integrity preserved

Examples:

- create-order endpoint returns controlled 5xx;
- PayPal API temporarily unavailable;
- Neon connection unavailable before a new checkout is created;
- browser checkout redirect fails while no payment completed.

Action:

- pause checkout if failures are persistent or widespread;
- keep webhook/order-status available;
- determine whether any PayPal orders were created before containment;
- restore service only after root cause or upstream recovery is confirmed.

### SEV-3 — customer operations / non-payment issue

Examples:

- withdrawal acknowledgement provider call fails while withdrawal + acknowledgement snapshot remain durable;
- legal/help page presentation issue;
- non-critical storefront content issue.

Do not disable payment automatically unless the issue also creates legal or payment-integrity risk.

## 3. Evidence to capture before rollback

Record at minimum:

- exact production Git SHA;
- Netlify deploy ID and deploy timestamp;
- whether `PAYPAL_ALLOW_LIVE` is enabled;
- whether `LEGENDMURAL_CHECKOUT_PAUSED` is enabled;
- PayPal mode and relevant Order ID/Capture ID, without exposing secrets;
- LegendMural order reference;
- Neon order status/version/`paid_at`;
- accepted PayPal webhook event ID/type;
- relevant sanitized Netlify Function timestamps/error codes;
- for withdrawal incidents: confirmation code, acknowledgement delivery status and attempt timestamp, without copying customer name/email/declaration into incident notes;
- incident owner and decision maker.

Never paste database URLs, PayPal secrets, Resend API keys, passwords or full customer payloads into GitHub issues/public incident notes.

## 4. Netlify deployment rollback

A storefront/runtime rollback is appropriate when the current deployment introduced a regression and the previous production deployment is known-good and schema-compatible.

Procedure:

1. pause new checkout if payment behavior is affected;
2. identify the exact previous known-good Netlify production deploy and Git SHA;
3. confirm previous code is compatible with the **current production database schema (`001–008`)** and current environment variables;
4. restore/redeploy the known-good application version through the controlled Netlify release path;
5. keep webhook reconciliation online when possible;
6. verify `/api/order-status` and webhook processing before reopening checkout;
7. inspect all orders created around the incident window before fulfilment.

Do not roll application code back across an incompatible database migration simply because an older deploy looked stable.

## 5. Database rollback / recovery boundary

Production currently contains the reviewed additive migration chain `001–008`.

Recovery checkpoints intentionally retained during launch preparation include:

- `pre-prod-bootstrap-20260818` — before the initial commerce bootstrap;
- `pre-ack-outbox-20260818` — immediately before acknowledgement migrations `007–008`.

If schema verification fails:

1. keep checkout disabled;
2. do not improvise repair SQL from memory;
3. compare actual production state with the reviewed migration chain;
4. decide whether forward repair or checkpoint/recovery is safer;
5. review exact SQL, lock and data impact before any forward repair;
6. rerun schema, ownership and least-privilege checks after recovery;
7. record the recovered state and decision authority in the release log.

A branch/checkpoint must never be deleted merely as housekeeping while it is still part of the active launch recovery plan.

## 6. Payment-state reconciliation checklist

For every affected order, establish authoritative state using both PayPal and Neon:

- LegendMural order reference;
- PayPal Order ID;
- capture status and Capture ID when present;
- expected amount and currency;
- Neon status (`payment_pending`, `paid`, etc.);
- Neon version and `paid_at`;
- accepted PayPal webhook event ID/type;
- whether browser capture response was interrupted;
- whether webhook recovery subsequently completed the order.

Never mark an order paid merely because the browser returned to `order-success.html`. Paid state must remain server-verified and durable.

## 7. Withdrawal acknowledgement / refund boundary

A statutory withdrawal registration is a customer-operations record, not an automatic PayPal refund command.

The production withdrawal flow now has two durable layers:

1. immutable `withdrawal_requests` registration;
2. `withdrawal_acknowledgements` statement snapshot plus mutable delivery metadata.

If acknowledgement delivery fails:

- keep both durable records;
- do not delete/recreate the withdrawal merely to resend email;
- use the canonical confirmation code to locate the acknowledgement;
- investigate the provider/configuration failure without logging customer payloads;
- when Resend production operation is approved/configured, use the controlled operator script `scripts/resend-withdrawal-acknowledgement.mjs <CONFIRMATION_CODE>` with server-side `NEON_DATABASE_URL`, `RESEND_API_KEY` and `RESEND_FROM` available only to the operator environment;
- the retry script must not resend when the acknowledgement is already recorded as sent;
- a refund remains a separate financial decision/process and is never implied by acknowledgement resend.

If the provider accepts the resend but later account-level delivery evidence shows a delivery problem, do not mutate the statement snapshot. Investigate delivery operationally and preserve the original confirmation code and attempt chronology.

## 8. Reopening checkout after an incident

New checkout creation may resume only when all applicable items are true:

- incident cause is understood or upstream dependency recovered;
- current production Git SHA/deploy is known and intended;
- Neon connectivity is healthy;
- PayPal mode/credentials/webhook identity match the intended environment;
- order-status and webhook paths are healthy;
- affected in-flight orders are reconciled or explicitly quarantined;
- no unexplained amount, currency, identity or persistence mismatch remains;
- controlled smoke check succeeds without an unintended real charge;
- incident owner records the reopen decision.

Then remove/set `LEGENDMURAL_CHECKOUT_PAUSED=false` and monitor the first new checkout closely.

## 9. Launch-time monitoring handoff

Before PayPal Live is enabled, the release operator must know where to review and correlate:

- Netlify Function failures by route/function and deploy;
- PayPal webhook delivery/verification failures;
- Neon branch/compute/API availability and query failures;
- acknowledgement records with failed delivery state;
- the exact deploy SHA and incident containment state.

Account-level monitoring locations and named decision owners must be confirmed on the real production accounts before Gate 7 can be marked GO.
