# LegendMural incident and rollback runbook

Last reviewed: 15 August 2026.

This runbook is for operational response after production infrastructure exists. It does not authorize PayPal Live, production migrations, production credential changes or destructive recovery actions.

## 1. First objective: stop new risk, preserve reconciliation

For a checkout/payment incident, the preferred first containment action is to stop **new checkout creation** while preserving the paths needed to finish or reconcile orders already in flight.

Set the server-side Netlify production environment variable:

`LEGENDMURAL_CHECKOUT_PAUSED=true`

Expected effect after the relevant Netlify configuration/deployment change is active:

- `/api/paypal/checkout` returns HTTP 503 with `CHECKOUT_PAUSED` before Neon or PayPal checkout bootstrap runs;
- no new PayPal order should be created through the LegendMural checkout endpoint;
- `/api/paypal/capture` remains available for an already-approved in-flight order;
- `/api/paypal/webhook` remains available for PayPal reconciliation/recovery;
- `/api/order-status` remains available so the browser can observe a durable paid/pending result;
- withdrawal registration remains separate from this checkout pause mechanism.

Do **not** disable the database connection, PayPal webhook credentials or the webhook route merely to stop new checkout creation. Doing so could block reconciliation for orders that have already reached PayPal.

To resume new checkout creation, set `LEGENDMURAL_CHECKOUT_PAUSED=false` or remove the variable, deploy/apply the configuration intentionally, and perform a no-real-payment smoke check before normal operation resumes.

## 2. Severity guide

### SEV-1 — payment integrity / data integrity risk

Examples:

- wrong amount or currency reaches PayPal;
- paid PayPal order cannot be reconciled to Neon;
- duplicate fulfillment risk;
- production database corruption or unauthorized mutation;
- secrets exposed in public output/logging;
- checkout points to the wrong PayPal environment or wrong database.

Immediate action:

1. pause new checkout creation;
2. preserve webhook/capture/status paths unless they are themselves the source of corruption;
3. record incident start time, deployment ID/SHA and current environment mode;
4. stop fulfillment for ambiguous orders until PayPal and Neon agree;
5. do not run cleanup SQL or destructive rollback before evidence is captured.

### SEV-2 — checkout unavailable but integrity preserved

Examples:

- create-order endpoint returns controlled 5xx;
- PayPal API temporarily unavailable;
- Neon connection unavailable before a new checkout is created;
- browser checkout redirect fails while no payment has completed.

Action:

- pause checkout if failures are persistent or widespread;
- keep webhook/order-status available;
- verify whether any PayPal orders were already created before containment;
- restore service only after the root cause or upstream recovery is confirmed.

### SEV-3 — non-payment customer operations issue

Examples:

- withdrawal confirmation email unavailable while the withdrawal ledger still records the request;
- legal/help page presentation issue;
- non-critical storefront content issue.

Do not disable payment automatically unless the issue creates a legal or payment-integrity risk.

## 3. Evidence to capture before rollback

Record at minimum:

- exact production Git SHA;
- Netlify deploy ID and deploy timestamp;
- whether `PAYPAL_ALLOW_LIVE` is enabled;
- whether `LEGENDMURAL_CHECKOUT_PAUSED` is enabled;
- PayPal mode and relevant PayPal Order ID(s)/Capture ID(s), without exposing secrets;
- LegendMural order reference(s);
- Neon order status/version/paid_at for affected references;
- PayPal webhook event IDs and types already accepted by the event ledger;
- relevant sanitized Netlify Function log timestamps/error codes;
- incident owner and decision maker.

Never paste database URLs, PayPal secrets, Resend API keys or full customer payloads into GitHub issues or public incident notes.

## 4. Netlify deployment rollback

A storefront/runtime code rollback is appropriate when the current deployment introduced a regression and the previous production deployment is known-good and schema-compatible.

Procedure:

1. pause new checkout creation if payment behavior is affected;
2. identify the exact previous known-good Netlify production deploy and Git SHA;
3. confirm that the previous code is compatible with the **current production database schema** and environment variables;
4. restore/redeploy the known-good application version through the normal controlled Netlify release path;
5. keep webhook reconciliation online during the rollback when possible;
6. verify `/api/order-status` and webhook processing before reopening checkout;
7. inspect all orders created around the incident window before fulfillment.

Do not roll application code back across an incompatible database migration merely because the prior deploy was visually stable.

## 5. Database rollback / recovery boundary

Production schema migrations `001–006` are expected to be additive bootstrap migrations on the initially empty LegendMural production commerce baseline. A failed or partially applied production migration must not be repaired ad hoc from memory.

If migration verification fails:

1. keep checkout disabled;
2. do not provide the runtime application with the production database credential;
3. compare actual schema state with the reviewed migration chain;
4. use the documented Neon recovery/restore procedure if recovery is safer than a forward repair;
5. if a forward repair is proposed, review the exact SQL and lock/data impact before execution;
6. rerun schema, provider-derivation and privilege checks after recovery;
7. record the recovered state and operator decision in the release log.

Database recovery authority must be decided before Live. A code operator should not automatically be assumed to have authority to restore or rewrite production data.

## 6. Payment-state reconciliation checklist

For every affected order around a payment incident, establish the authoritative state using both PayPal and Neon.

Check:

- LegendMural order reference;
- PayPal Order ID;
- PayPal capture status and Capture ID when present;
- expected amount and currency;
- Neon status (`payment_pending`, `paid`, etc.);
- Neon version and `paid_at`;
- accepted PayPal webhook event ID/type;
- whether a browser capture response was interrupted;
- whether webhook recovery subsequently completed the order.

Never mark an order paid merely because the browser returned to `order-success.html`. Paid state must remain server-verified/durable.

## 7. Withdrawal/refund incident boundary

A statutory withdrawal registration is a customer-operations record, not an automatic PayPal refund command.

If withdrawal email delivery fails:

- keep the recorded withdrawal if it was durably accepted;
- use the confirmation code/order reference to handle the customer request operationally;
- do not delete and recreate the withdrawal merely to resend an email;
- do not execute a refund unless the refund decision/process separately authorizes it.

Refund/reversal state handling remains a separate financial workflow and should not be improvised through direct database updates.

## 8. Reopening checkout after an incident

New checkout creation may resume only when all applicable items are true:

- incident cause is understood or the upstream dependency is confirmed recovered;
- current production Git SHA/deploy is known and intended;
- Neon connectivity is healthy;
- PayPal mode/credentials/webhook identity match the intended environment;
- order-status and webhook paths are healthy;
- affected in-flight orders have been reconciled or explicitly quarantined for manual review;
- no unexplained amount, currency, identity or persistence mismatch remains;
- a controlled smoke check succeeds without creating an unintended real charge;
- the incident owner records the reopen decision.

Then remove/set `LEGENDMURAL_CHECKOUT_PAUSED=false` and monitor the first new checkout closely.
