# LegendMural data retention policy

Status: production-readiness policy; enforcement is **not yet enabled**.

Last reviewed: 18 August 2026.

## Purpose

This document defines the retention classes for the durable commerce data currently represented in the LegendMural repository. It is deliberately separate from cleanup code: no production row may be deleted or anonymised until the production database, accounting flow, VAT/OSS position and restore/back-up procedure have been reviewed against this policy.

The policy follows two principles:

1. Dutch tax/business administration records that form part of the sales, debtor/creditor, ledger or invoice administration are retained for the applicable statutory administration period. The current baseline is at least 7 years; records subject to the EU One Stop Shop / Import One Stop Shop rules may require 10 years.
2. Personal data that is not required for that statutory administration must not inherit the longest retention period automatically. It is retained only while necessary for the stated purpose, including a documented period for handling or defending contractual claims where appropriate.

This is an engineering/operations retention policy, not a substitute for case-specific legal or tax advice.

## Retention classes

### R7 — statutory commerce record: minimum 7 years

Use for fields that are part of the authoritative order/payment record and are needed to reconstruct the sale, amount, payment, fulfilment and accounting trail.

Baseline expiry: no earlier than 7 years after the record ceases to have current administrative value. If an affected transaction falls under a statutory 10-year regime such as OSS/IOSS, use R10 instead.

Deletion/anonymisation: only after the applicable statutory period and after accounting/tax hold checks pass.

### R10 — statutory special commerce record: minimum 10 years when applicable

Conditional class for records that must be kept for 10 years because the transaction is within an applicable statutory regime such as OSS/IOSS. This class is not assumed for every order; production activation must determine whether and when it applies.

### R5 — contractual claim / consumer-right evidence: target 5 years

Use for non-fiscal evidence that remains reasonably necessary to establish, exercise or defend contractual claims after the operational case is closed. Five years is an internal target aligned with the general Dutch limitation period for contractual performance claims; it is not a tax-retention rule.

The timer should start when the relevant operational/legal claim context is closed or ceases to have current value, not blindly at row creation.

### R-OPS — short operational retention

Use for temporary operational/support/security data that is not part of the statutory accounting record and is not required for an unresolved claim. A concrete duration must be documented before such a data set is introduced. Do not default these data to R7/R10.

### HOLD — retention hold

Any deletion/anonymisation job must skip records subject to an active legal, tax, chargeback, fraud/security, warranty, dispute or regulatory hold. Holds must be explicit and reviewable rather than implemented by indefinite retention of all data.

## Current database field matrix

### `legend_commerce.orders`

| Field / data group | Class | Reason / treatment |
| --- | --- | --- |
| `reference` | R7/R10 | Authoritative order identifier used to reconstruct the sale and link payment/withdrawal evidence. |
| `status` | R7/R10 | Order/payment state needed for the sales and payment audit trail. |
| `amount_total`, `currency` | R7/R10 | Core financial/accounting facts. |
| `mode` | R7/R10 | Needed to distinguish test/live financial records and prevent false reconciliation. |
| `payment_session_id`, generated `payment_provider` | R7/R10 | Payment reconciliation identifiers; do not store full provider payloads merely because these identifiers are retained. |
| `created_at`, `updated_at`, `paid_at`, `version` | R7/R10 | Transaction chronology/audit integrity. |
| `items` | R7/R10 | What was sold; required to reconstruct the order and tax/commercial record. |
| `discount`, `totals` | R7/R10 | Price, discount and total calculation evidence. |
| `shipping` | R7/R10 only to the extent required to reconstruct delivery/tax treatment; otherwise minimise | Delivery destination/method can be commercially and tax relevant, but personal address detail must not be duplicated elsewhere without need. Any future split schema should separate fiscal facts from operational address fields so the latter can be minimised when lawful. |
| `customer` | R7/R10 only to the extent it forms part of the required sales/debtor/invoice record; otherwise minimise | Customer identity/contact data may be part of the statutory commerce record. Future schema work should avoid adding optional profile/marketing data to this JSON object. |
| legacy Stripe event summary fields on `orders` | R7/R10 while needed for payment reconciliation | Keep only the identifiers/types/timestamps already stored; do not expand to raw webhook bodies. |

Important: because `customer` and `shipping` are currently JSON blobs inside the authoritative order row, field-level expiry inside those blobs cannot safely be automated until the exact JSON contract and accounting requirements are frozen. Production cleanup must not simply delete these blobs from statutory records.

### `legend_commerce.stripe_events`

| Field / data group | Class | Reason / treatment |
| --- | --- | --- |
| `event_id`, `event_type`, `order_reference`, `stripe_created_at`, `processed_at` | R7/R10 while part of payment reconciliation evidence | Minimal idempotency/audit record. Raw Stripe payloads are intentionally not stored in this table. |

### `legend_commerce.paypal_webhook_events`

| Field / data group | Class | Reason / treatment |
| --- | --- | --- |
| `event_id`, `event_type`, `order_reference`, `paypal_order_id`, `paypal_capture_id`, `mode`, `paypal_created_at`, `processed_at` | R7/R10 while part of payment reconciliation evidence | Minimal verified payment/reconciliation evidence. Keep the existing design choice not to retain complete provider webhook payloads. |

### `legend_commerce.withdrawal_requests`

| Field / data group | Class | Reason / treatment |
| --- | --- | --- |
| `order_reference`, `payment_session_id` | R5, subject to HOLD; linked R7/R10 order remains separately retained | Evidence connecting the withdrawal notice to the purchase. The underlying order/accounting record has its own statutory retention class. |
| `confirmation_code` | R5, subject to HOLD | Reference assigned to the withdrawal notice. Code creation is not by itself proof that the statutory acknowledgement was delivered; delivery evidence must be assessed separately. |
| `withdrawn_at`, `created_at` | R5, subject to HOLD | Timing evidence for the statutory withdrawal process and potential disputes. |

A withdrawal row must not be deleted merely because the refund was completed if a dispute/chargeback/legal hold remains open. Conversely, the withdrawal table must not automatically be retained for the full fiscal period simply because the linked order is R7/R10.

The immutable withdrawal row intentionally remains minimal. Consumer name, confirmation email and the declaration snapshot belong to the separate acknowledgement evidence record below rather than being added as mutable or duplicate statement fields to `withdrawal_requests`.

### `legend_commerce.withdrawal_acknowledgements`

This table is the durable statutory acknowledgement snapshot/outbox proposed by migrations `007–008`. It is separate from the immutable withdrawal registration so delivery can be retried and evidenced without allowing the underlying withdrawal statement to be rewritten.

| Field / data group | Class | Reason / treatment |
| --- | --- | --- |
| `order_reference`, `payment_session_id`, `confirmation_code` | R5, subject to HOLD | Links the acknowledgement evidence to the same consumer-right event and contract without duplicating the full order payload. |
| `consumer_name` | R5, subject to HOLD | Name submitted for the statutory withdrawal acknowledgement and needed to reproduce/evidence the acknowledgement. |
| `confirmation_email` | R5, subject to HOLD | Electronic confirmation address used to deliver and, if necessary, retry the acknowledgement. Do not repurpose for marketing. |
| `declaration` | R5, subject to HOLD | Immutable snapshot of the withdrawal declaration that was acknowledged. Preserving the snapshot prevents later template changes from altering historical evidence. |
| `withdrawn_at`, `created_at` | R5, subject to HOLD | Receipt chronology for the acknowledgement and underlying withdrawal. |
| `delivery_status`, `delivery_attempts`, `last_attempt_at`, `sent_at`, `updated_at` | R5, subject to HOLD | Limited delivery evidence used to distinguish pending/failed/sent acknowledgement handling and support a controlled retry. |
| `provider_message_id` | R5, subject to HOLD | Minimal provider-side message reference used for delivery investigation/reconciliation; not a substitute for the statutory statement itself. |
| `last_error_code` | R5, subject to HOLD; minimise | Sanitised technical failure code only. Do not store provider response bodies, email content or arbitrary error text in this field. |

The runtime may update only the delivery metadata columns. It must not update the name, confirmation email, declaration, confirmation code, order identifiers or original withdrawal timestamp. DELETE/TRUNCATE remain outside the runtime role.

The acknowledgement evidence must not automatically be retained for the full fiscal R7/R10 period solely because the linked order is retained longer. Its R5 timer and any HOLD need a concrete case-closure/start rule before destructive enforcement is enabled.

Any transactional-email provider may additionally process the minimum statement data needed to deliver the statutory acknowledgement, subject to the production provider contract, privacy notice, transfer safeguards and provider-side retention configuration.

## Data deliberately not retained in the current reconciliation schema

The PayPal reconciliation migration explicitly stores identifiers and timestamps rather than complete provider webhook payloads. Preserve this minimisation decision unless a specific documented purpose requires additional fields.

Do not add any of the following to long-lived commerce storage without a separate purpose, legal basis and retention class:

- marketing profiles or inferred interests;
- advertising identifiers;
- complete payment-provider webhook/request bodies when the minimal reconciliation fields suffice;
- card/bank credentials or secrets;
- arbitrary browser/device fingerprints;
- customer-support free text copied into the order record when a separate scoped support record would suffice.

## Production enforcement requirements

Before any automated retention job is enabled, all of the following are required:

1. Confirm whether LegendMural uses OSS/IOSS or another regime that makes R10 applicable to any transaction set.
2. Freeze and document the exact `customer`, `shipping`, `items`, `discount` and `totals` JSON contracts used in production.
3. Identify which customer/shipping subfields are required in the statutory sales/accounting record and which can lawfully be minimised earlier.
4. Define the exact clock/start event for every R5 data set (for example case closure / final resolution) rather than calculating from row creation blindly.
5. Implement explicit retention holds for open disputes, chargebacks, warranty matters, tax investigations and legal claims.
6. Verify backup/snapshot retention. Deleting a production row while retaining the same personal data indefinitely in restorable backups does not satisfy the policy goal.
7. Add a dry-run retention report that returns counts and candidate IDs only; review it before enabling deletion/anonymisation.
8. Require a second explicit production approval before the first destructive run.
9. Log retention actions without logging the personal data being removed.
10. Update the public Privacy notice when the production schedule is activated and concrete periods can be stated accurately.
11. Before transactional withdrawal email is activated, verify the actual provider, processing location/transfer position, safeguards and operational retention of provider-side message data.
12. Before acknowledgement retention is enforced, define how failed/pending delivery cases and resend investigations keep the R5 clock open until the operational case is resolved.

## Public Privacy notice mapping

Until enforcement and the JSON-field split are confirmed, the public notice should describe the retention criteria accurately rather than promise a deletion date the system cannot yet guarantee. Before public launch, the notice must be reconciled with this policy and the final production configuration, including the provider actually used for statutory withdrawal acknowledgements.

## Source basis reviewed

- Netherlands Tax Administration: the basic business administration, including debtor/creditor, purchase/sales and ledger data, has a 7-year retention obligation; some records/regimes require 10 years.
- Netherlands Tax Administration: invoices are generally retained for 7 years, with longer periods in specified cases.
- Autoriteit Persoonsgegevens: the GDPR does not set one universal personal-data retention period; personal data must not be kept longer than necessary, while other laws can impose concrete periods.
- Dutch Civil Code Book 3, article 3:307: the general limitation period for a contractual performance claim is five years after the claim becomes due. This supports the R5 internal claim-evidence target but does not convert R5 into a statutory tax-retention period.

## Change control

Changes to an R7/R10 classification, the R5 duration, the start event for a retention clock, or any destructive enforcement mechanism require explicit review. Production deletion must never be activated as an incidental side effect of a schema migration or deploy.
