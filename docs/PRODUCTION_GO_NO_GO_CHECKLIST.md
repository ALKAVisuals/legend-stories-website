# LegendMural production go / no-go checklist

Last reviewed: 15 August 2026.

This checklist converts the production-readiness runbook into explicit release gates. A **GO** means every mandatory item for that gate is verified. Any unresolved mandatory item means **NO-GO** for the dependent production phase.

## Gate 0 — reviewed code baseline

- [ ] PR #96 is reviewed and intentionally approved for merge.
- [ ] Permanent Quality checks are green on the exact final head SHA.
- [ ] Accessibility / purchase-flow audit is green on the exact final head SHA.
- [ ] Netlify Node 22 compatibility is green on the exact final head SHA.
- [ ] Netlify Deploy Preview is green.
- [ ] Branch is not behind `main`.
- [ ] Exact final Git SHA is recorded in the release log.
- [ ] Temporary write-enabled test workflows/scripts are absent.

**Current status:** technical checks are green on the current draft PR, but merge approval has not been given. Therefore Gate 0 is not yet a production GO.

## Gate 1 — public domain and HTTPS

- [ ] Definitive LegendMural public domain confirmed by the owner.
- [ ] Domain attached to the intended Netlify production site.
- [ ] HTTPS certificate active and valid.
- [ ] HTTP -> HTTPS redirect verified.
- [ ] `www`/apex redirect policy chosen and verified.
- [ ] Canonical URLs use only the definitive HTTPS production origin.
- [ ] Open Graph URLs use only the definitive HTTPS production origin.
- [ ] No GitHub Pages or deploy-preview origin remains authoritative.
- [ ] PayPal return/cancel origin allow-list uses the definitive production origin.

**Current status:** NO-GO until the definitive domain is supplied.

## Gate 2 — legal and customer operations

- [x] Seller/controller identified as Alka Group trading through LegendMural.
- [x] KvK and VAT details published on the Company Information surface.
- [x] Dutch parcel-return address confirmed and published before purchase.
- [x] Shipping page exists.
- [x] Returns / statutory withdrawal information exists.
- [x] Online withdrawal function exists without requiring an account.
- [x] Withdrawal registration is durable and separate from refund execution.
- [x] FAQ, Privacy and Terms of Sale pages exist.
- [ ] Final customer-support/social identities reviewed if they are to be published at launch.

**Current status:** core legal/customer-operations layer is technically ready in draft PR #96; final release still depends on merge and any unresolved public identities.

## Gate 3 — transactional email

- [ ] Definitive sending domain available.
- [ ] Sending domain verified with Resend.
- [ ] Production `from` identity approved.
- [ ] Reply/customer-operations address approved.
- [ ] Resend API key stored only as a production server-side secret.
- [ ] Controlled non-production withdrawal confirmation succeeds.
- [ ] Mail failure does not erase a durable withdrawal record.
- [ ] Logs do not expose API key or customer payload.

**Current status:** NO-GO; provider adapter exists and is tested, but production domain/identity/secret are intentionally not configured.

## Gate 4 — Neon production security and recovery

- [ ] Production branch protection policy reviewed and applied where appropriate.
- [ ] Passwordless-access policy explicitly reviewed and approved/disabled as appropriate.
- [ ] Dedicated migration-owner credential created.
- [ ] Dedicated least-privilege runtime credential created.
- [ ] Runtime role grants limited to the reviewed migrations `002`, `004`, `006` contract.
- [ ] Production access ownership/authorization documented.
- [ ] Recovery/restore procedure documented and tested sufficiently for launch.
- [ ] Current 6-hour history-retention window explicitly accepted or increased.
- [ ] Restore/recovery point available immediately before migration.

**Current status:** NO-GO. Read-only preflight identified the current branch/access/recovery observations, but no production security setting has been changed.

## Gate 5 — Neon production bootstrap

- [ ] Exact migration files `001–006` match the reviewed release SHA.
- [ ] Restore point/recovery route confirmed immediately before execution.
- [ ] Direct migration endpoint used.
- [ ] Explicit runtime role safely substituted into migration placeholders.
- [ ] Migrations executed strictly `001 -> 006`.
- [ ] Tables verified: `orders`, historical `stripe_events`, `paypal_webhook_events`, `withdrawal_requests`.
- [ ] Constraints/generated provider behaviour verified.
- [ ] PayPal Order ID derives `payment_provider=paypal`.
- [ ] Runtime SELECT/INSERT privileges verified.
- [ ] Runtime UPDATE/DELETE/TRUNCATE denial on immutable ledgers verified.
- [ ] Synthetic smoke records removed by operations/migration credential.
- [ ] Migration timestamp/operator/release SHA recorded.

**Current status:** NO-GO for production execution. The same bootstrap has been successfully proven on a temporary branch cloned from the empty production baseline.

## Gate 6 — Netlify production configuration

- [ ] Production Neon runtime URL configured server-side only.
- [ ] Correct PayPal environment variables configured.
- [ ] `PAYPAL_ALLOW_LIVE` remains disabled during infrastructure validation.
- [ ] `LEGENDMURAL_CHECKOUT_PAUSED` defaults absent/false for normal service.
- [ ] Incident operator knows how to set `LEGENDMURAL_CHECKOUT_PAUSED=true`.
- [ ] PayPal checkout, capture, webhook and order-status routes point to the intended Functions.
- [ ] Resend configured only after Gate 3.
- [ ] Logs inspected for secret/PII leakage.
- [ ] Production build passes.
- [ ] Same-origin API smoke checks pass without a real charge.

**Current status:** NO-GO until production infrastructure/domain gates are intentionally activated.

## Gate 7 — monitoring and incident readiness

- [ ] Checkout/payment incident owner assigned.
- [ ] Customer withdrawal/refund operations owner assigned.
- [ ] Netlify Function log review location/process documented.
- [ ] PayPal webhook failure detection process documented.
- [ ] Neon/API failure detection process documented.
- [ ] `LEGENDMURAL_CHECKOUT_PAUSED` containment procedure tested in a non-production environment.
- [ ] Known-good Netlify deployment rollback procedure understood.
- [ ] Database recovery decision authority assigned.
- [ ] Payment reconciliation checklist understood.
- [ ] `docs/INCIDENT_AND_ROLLBACK_RUNBOOK.md` reviewed by the release operator.

**Current status:** operational runbook exists; named owners and real production monitoring still need to be assigned/configured.

## Gate 8 — PayPal Live enablement

- [ ] Gates 0–7 are GO.
- [ ] PayPal Business account fully verified.
- [ ] Dedicated Live app/credentials configured server-side.
- [ ] Live webhook created for the definitive environment.
- [ ] `PAYPAL_WEBHOOK_ID` exactly matches the intended Live webhook.
- [ ] `PAYPAL_ALLOW_LIVE=true` enabled only after all preceding verification.
- [ ] Checkout is not paused.
- [ ] One controlled low-value real order is authorized.
- [ ] Browser return succeeds.
- [ ] Capture amount/currency/reference match expectations.
- [ ] Neon reaches durable `paid` state.
- [ ] Webhook reconciliation is visible and idempotent.
- [ ] Customer confirmation/operations record succeeds.
- [ ] Fulfillment is released only after durable paid verification.

Any mismatch during the controlled Live order is an immediate **NO-GO**: pause new checkout and use the incident runbook.

## Gate 9 — launch completion record

Record:

- release Git SHA;
- Netlify production deploy ID;
- domain/origin;
- Neon project/branch and migration timestamp;
- runtime/migration role names (never passwords/URLs);
- PayPal mode/app identity and webhook ID reference;
- Resend sending identity;
- operator(s);
- time checkout was opened;
- controlled Live order reference and outcome;
- any accepted risk/exception and owner.

Launch is not considered fully handed over until this release record exists.
