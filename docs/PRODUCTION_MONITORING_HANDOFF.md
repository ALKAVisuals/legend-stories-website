# LegendMural production monitoring handoff

Last reviewed: 18 August 2026.

Purpose: define exactly where LegendMural operations should look after the first current production deploy and during payment/withdrawal incidents. This document does not authorize PayPal Live, refunds, destructive database recovery, Resend production activation or credential changes.

## 1. Required named owners before Gate 7 GO

Do not infer these names from repository access. They must be assigned explicitly before PayPal Live is enabled.

| Responsibility | Named owner | Backup / escalation | Status |
| --- | --- | --- | --- |
| Checkout/payment incident owner | **TO ASSIGN** | **TO ASSIGN** | Open |
| Withdrawal/refund customer-operations owner | **TO ASSIGN** | **TO ASSIGN** | Open |
| Database recovery decision authority | **TO ASSIGN** | **TO ASSIGN** | Open |

The checkout/payment incident owner may contain checkout and coordinate reconciliation, but that does not automatically grant authority to restore/rewrite production data or execute refunds.

## 2. Netlify Function monitoring

Current Netlify UI path documented by Netlify:

**Site → Logs & Metrics → Functions**

Operational procedure:

1. Select the current published deploy or deliberately select the exact deploy/Deploy Preview being investigated.
2. Open the relevant Function:
   - `create-paypal-order`;
   - `capture-paypal-order`;
   - `paypal-webhook`;
   - `order-status`;
   - `create-withdrawal`.
3. Filter the time window to the incident/smoke-test period.
4. Filter by request ID, message or log level where useful.
5. Record only sanitized timestamps, route/function, public error code, deploy ID/SHA and request correlation information in incident notes.

Expected launch signals to investigate immediately:

- repeated Function 5xx responses;
- commerce bootstrap/configuration errors;
- webhook verification/reconciliation failures;
- database connectivity errors;
- withdrawal delivery failures;
- any log output containing a database URI/password, PayPal secret/token, Resend API key or full customer payload.

A secret/credential exposure is SEV-1. Stop new checkout creation and follow the incident runbook before continuing.

Netlify states Function logs are available for published deploys, branch deploys and Deploy Previews; retention depends on plan, so incident evidence should be captured promptly rather than assuming logs will remain indefinitely.

## 3. PayPal webhook monitoring

Use the **PayPal Webhooks Events dashboard** for the exact Sandbox or Live app in use.

Operational procedure:

1. Select Sandbox or Live intentionally; do not mix app environments.
2. Select the exact PayPal app associated with the configured credentials/webhook ID.
3. Filter by date/time, resource ID or event type around the incident/order.
4. Inspect event status and details.
5. Correlate the PayPal event ID/resource with the LegendMural order reference and the durable `paypal_webhook_events` record.
6. Use manual **Resend** only when the event is eligible and a resend is actually required for reconciliation.

PayPal documents that non-2xx listener responses cause webhook redelivery attempts, up to 25 attempts over 3 days. A failed event can also be resent manually from the Webhooks Events dashboard. Do not treat repeated webhook deliveries as repeated customer purchases; the LegendMural handler/event ledger is expected to remain idempotent.

Launch alert conditions:

- PayPal event remains pending/failed unexpectedly;
- webhook event is visible in PayPal but no corresponding verified ledger/reconciliation result exists in Neon;
- capture is completed at PayPal while Neon has not reached durable `paid` after the expected reconciliation window;
- event/webhook ID belongs to the wrong app/environment;
- webhook verification fails.

Any amount, currency, environment or paid-state mismatch is SEV-1 until reconciled.

## 4. Neon production monitoring

Production branch:

- project: `super-shape-69972279`;
- branch: `production` (`br-misty-cloud-as0rofc8`);
- database: `neondb`.

Use Neon Monitoring for the selected production branch/compute. Neon exposes branch-level monitoring for system/database health such as compute activity, CPU/RAM, database size, row activity and connection-related metrics depending on the current Console view/plan.

Operational checks:

- production branch/compute is the selected target;
- compute is available and wakes successfully when accessed;
- connection/error spikes correlate with Netlify Function failures;
- unexpected resource saturation is investigated before blaming PayPal;
- schema changes are never made merely to clear a runtime alert.

For application-state incidents, Monitoring alone is not authoritative. Reconcile the relevant durable rows using the reviewed read-only queries/operational tools and compare with PayPal.

## 5. Read-only withdrawal acknowledgement queue review

A failed email must remain a durable withdrawal, not become a new withdrawal submission.

Operations may review delivery state without exposing the stored name/email/declaration in routine monitoring. A safe read-only queue shape is:

```sql
SELECT
  confirmation_code,
  delivery_status,
  delivery_attempts,
  last_attempt_at,
  last_error_code,
  updated_at
FROM legend_commerce.withdrawal_acknowledgements
WHERE delivery_status <> 'sent'
ORDER BY updated_at ASC
LIMIT 100;
```

Routine incident notes should use the confirmation code and sanitized technical status only. Do not paste `consumer_name`, `confirmation_email` or `declaration` into GitHub/log notes.

When Resend production operation has been separately approved and the failure cause is fixed, use the controlled retry path documented in `docs/RESEND_PRODUCTION_ACTIVATION.md` and `docs/INCIDENT_AND_ROLLBACK_RUNBOOK.md`.

## 6. Deployment-day monitoring sequence

When Netlify deploy capacity resumes:

1. follow `docs/FIRST_PRODUCTION_DEPLOY_CHECKLIST.md`;
2. record the deployed Git SHA and Netlify deploy ID;
3. perform the no-charge order-status Neon connectivity smoke test;
4. perform the invalid checkout configuration smoke test that must fail locally without creating a PayPal order;
5. inspect the exact Function log window immediately afterward;
6. verify Neon row counts are unchanged;
7. verify PayPal Sandbox shows no unintended order caused by the invalid smoke request;
8. keep PayPal Live disabled.

Gate 6 remains deployment-blocked until this sequence can run against a fresh production deploy.

## 7. First controlled PayPal Live order monitoring sequence

This section is dormant until Gate 8 receives separate explicit approval.

For the first controlled Live order:

1. one named checkout/payment incident owner actively monitors the order;
2. record LegendMural order reference and PayPal Order ID without recording secrets;
3. verify expected amount/currency before and after capture;
4. verify Neon reaches durable `paid`;
5. verify the webhook event is received/verified/idempotently reconciled;
6. inspect Netlify logs for unexpected errors or data leakage;
7. release fulfilment only after durable paid verification;
8. if any mismatch occurs, immediately set the checkout containment process in motion and reconcile before another Live order is attempted.

## 8. Monitoring cadence for the launch window

Minimum operational policy proposed for the controlled launch window:

- **Immediately after each launch/deployment smoke test:** Netlify Function logs + Neon state check.
- **During the first controlled Live order:** active Netlify/PayPal/Neon correlation until durable paid state is confirmed.
- **After the first Live webhook reconciliation:** one complete payment-state reconciliation review.
- **Before normal checkout is declared open:** confirm no unresolved failed/pending launch events or acknowledgement failures remain.

A later steady-state cadence can be chosen after real order volume is known. Do not create noisy automated alerts solely for activity that is normal on a serverless/free-tier system (for example a sleeping Neon compute waking on demand).

## 9. Gate 7 sign-off

Gate 7 can be GO only when:

- checkout/payment incident owner is named;
- withdrawal/refund operations owner is named;
- database recovery authority is named;
- the named release operator has reviewed the incident/rollback runbook;
- Netlify Function log access is confirmed on the real account after deploys resume;
- PayPal Webhooks Events access is confirmed for the intended Sandbox/Live app;
- Neon production Monitoring access is confirmed;
- checkout-pause containment is exercised safely;
- known-good Netlify rollback is understood against an actual deploy;
- payment reconciliation and withdrawal acknowledgement retry procedures are understood.

Until those items are complete, the technical architecture may be ready but Gate 7 remains **PARTIAL**.

## Official operational references reviewed

- Netlify Function logs: https://docs.netlify.com/build/functions/logs/
- Netlify logs overview: https://docs.netlify.com/manage/monitoring/logs/
- PayPal Webhooks Events dashboard: https://developer.paypal.com/api/rest/webhooks/events-dashboard/
- PayPal webhooks overview: https://developer.paypal.com/api/rest/webhooks
- Neon Monitoring navigation/update: https://neon.com/docs/changelog/2025-04-25
