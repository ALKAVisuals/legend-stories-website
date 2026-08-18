# LegendMural launch completion record

Status: **NOT LAUNCHED — TEMPLATE ONLY**

Last reviewed: 18 August 2026.

Purpose: provide the final auditable handoff record after all production gates pass. This repository is public, so this file must remain **sanitized**. Never record credentials, connection strings, API keys, access tokens, passwords, full customer data, real customer email/address data, or raw payment-provider payloads here.

## 1. Release identity

| Field | Launch value |
| --- | --- |
| Final release Git SHA | `TO RECORD` |
| Netlify production deploy ID | `TO RECORD` |
| Netlify deploy timestamp (UTC) | `TO RECORD` |
| Definitive public origin | `https://legendmural.com` |
| Release operator | `TO ASSIGN / RECORD` |
| Launch decision authority | `TO ASSIGN / RECORD` |
| Time normal checkout opened (UTC) | `TO RECORD` |

## 2. Database production baseline

| Field | Launch value |
| --- | --- |
| Neon project ID | `super-shape-69972279` |
| Production branch | `production` / `br-misty-cloud-as0rofc8` |
| Database | `neondb` |
| Reviewed migration level | `001–008` |
| Application runtime role | `legendmural_app` |
| Runtime privilege group | `legendmural_runtime` |
| Migration owner role | `legendmural_migrator` |
| Broad owner excluded from runtime | `neondb_owner` — confirm `YES` |
| Original recovery checkpoint retained | `pre-prod-bootstrap-20260818` — `YES/NO + decision` |
| Pre-acknowledgement checkpoint retained | `pre-ack-outbox-20260818` — `YES/NO + decision` |

Do not put a database URL or password into this record.

## 3. Gate sign-off

| Gate | Required final status | Launch result | Evidence / note |
| --- | --- | --- | --- |
| 0 — reviewed code baseline | GO | `TO RECORD` | final SHA/checks |
| 1 — domain / HTTPS | GO | `TO RECORD` | apex + redirects verified |
| 2 — legal / customer operations | GO | `TO RECORD` | withdrawal acknowledgement E2E verified |
| 3 — transactional email | GO | `TO RECORD` | verified sender + delivery/retry proof |
| 4 — Neon security / recovery | GO | `TO RECORD` | role/recovery controls |
| 5 — Neon production schema | GO | `TO RECORD` | migrations `001–008` |
| 6 — Netlify production config | GO | `TO RECORD` | fresh deploy + no-charge smoke/log review |
| 7 — monitoring / incident readiness | GO | `TO RECORD` | owners + access + containment/rollback |
| 8 — controlled PayPal Live enablement | GO | `TO RECORD` | controlled Live payment verified |

Gate 9 is complete only after this record is finalized and the private launch evidence is stored in the approved private operations location.

## 4. Netlify production validation

Record only non-secret results:

- Production deploy consumed the intended `NEON_DATABASE_URL`: `YES / NO`
- Runtime database role confirmed as `legendmural_app`: `YES / NO`
- Production origin values confirmed for `https://legendmural.com`: `YES / NO`
- `PAYPAL_ALLOW_LIVE` state **before** Gate 8: `false / absent`
- PayPal environment during Gate 6: `Sandbox`
- Gate 6 read-only order-status smoke: `PASS / FAIL`
- Gate 6 invalid checkout/no-PayPal-order smoke: `PASS / FAIL`
- Production DB rows unchanged after Gate 6 smoke: `YES / NO`
- Function logs reviewed for secrets/PII: `PASS / FAIL`
- HTTPS apex / HTTP redirect / www redirect: `PASS / FAIL`

Do not paste environment-variable values into this file.

## 5. PayPal production activation

Public-safe launch facts:

| Field | Launch value |
| --- | --- |
| PayPal mode after Gate 8 | `Live` only after approval |
| PayPal Business verification | `CONFIRMED / NOT CONFIRMED` |
| Dedicated Live app identity reviewed | `YES / NO` |
| Live webhook identity matched | `YES / NO` |
| `PAYPAL_ALLOW_LIVE=true` enabled after Gates 0–7 GO | `YES / NO` |
| Controlled Live order outcome | `PASS / FAIL` |
| Expected amount/currency matched | `YES / NO` |
| Neon reached durable `paid` | `YES / NO` |
| Webhook reconciliation/idempotency verified | `YES / NO` |
| Fulfilment released only after durable paid state | `YES / NO` |

### Private payment evidence

Do **not** put a real PayPal Order ID, Capture ID, LegendMural customer order reference or customer details in this public repository.

- Approved private evidence location/reference: `TO RECORD`
- Private controlled-order evidence reviewed by: `TO RECORD`
- Review timestamp: `TO RECORD`

## 6. Transactional withdrawal acknowledgement

| Field | Launch value |
| --- | --- |
| Resend production sender/domain verified | `YES / NO` |
| Monitored Reply-To approved | `YES / NO` |
| Least-privilege production API key stored server-side | `YES / NO` |
| Controlled acknowledgement delivered | `YES / NO` |
| Provider delivery state/inbox receipt verified | `YES / NO` |
| Reply routing verified | `YES / NO` |
| Controlled failure + retry verified | `YES / NO` |
| Logs free of secrets/unnecessary customer payload | `YES / NO` |

### Private acknowledgement evidence

Do not put a real consumer email, declaration payload tied to a customer, or confirmation code from a real customer into this public repository.

- Approved private evidence location/reference: `TO RECORD`
- Evidence reviewed by: `TO RECORD`
- Review timestamp: `TO RECORD`

## 7. Monitoring and incident ownership

| Responsibility | Primary | Backup / escalation | Confirmed access |
| --- | --- | --- | --- |
| Checkout/payment incident | `TO RECORD` | `TO RECORD` | `YES / NO` |
| Withdrawal/refund operations | `TO RECORD` | `TO RECORD` | `YES / NO` |
| Database recovery decisions | `TO RECORD` | `TO RECORD` | `YES / NO` |

Operational access verified:

- Netlify Function logs: `YES / NO`
- PayPal Webhooks Events dashboard: `YES / NO`
- Neon production Monitoring: `YES / NO`
- Checkout-pause procedure understood/tested: `YES / NO`
- Known-good Netlify rollback procedure understood/tested: `YES / NO`

## 8. Accepted risks / exceptions

Every accepted launch exception must have an owner and review date.

| Risk / exception | Why accepted | Owner | Review/expiry date |
| --- | --- | --- | --- |
| Neon Free-plan limitations (if still applicable) | `TO RECORD` | `TO RECORD` | `TO RECORD` |
| Other | `NONE / TO RECORD` | `TO RECORD` | `TO RECORD` |

Do not write “accepted” without a named owner and a concrete follow-up/review point.

## 9. Recovery checkpoint retirement

Do not delete the retained Neon recovery checkpoints as incidental housekeeping.

After successful launch validation, explicitly decide for each checkpoint:

- keep temporarily;
- replace with a newer deliberate checkpoint/recovery strategy;
- retire/delete after the approved retention/recovery window.

Decision authority: `TO RECORD`

Decision: `TO RECORD`

Date/time: `TO RECORD`

## 10. Final launch declaration

Complete only when every dependent gate is GO.

- [ ] Final release SHA/deploy recorded.
- [ ] Gates 0–8 are GO.
- [ ] Controlled PayPal Live order passed.
- [ ] Transactional acknowledgement delivery passed.
- [ ] Named monitoring/incident owners recorded.
- [ ] Private payment/customer evidence stored outside this public repository.
- [ ] Accepted risks have owners/review dates.
- [ ] Launch decision authority approves opening normal checkout.

**Final launch state:** `NOT LAUNCHED / GO-LIVE APPROVED / PAUSED`

**Approved by:** `TO RECORD`

**Timestamp (UTC):** `TO RECORD`
