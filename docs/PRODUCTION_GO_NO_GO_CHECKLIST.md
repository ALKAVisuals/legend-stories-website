# LegendMural production go / no-go checklist

Last reviewed: 18 August 2026.

This checklist converts the production-readiness runbook into explicit release gates. A **GO** means every mandatory item for that gate is verified. Any unresolved mandatory item means **NO-GO** for the dependent production phase.

## Gate 0 — reviewed code baseline

- [x] PR #96 was reviewed and intentionally merged.
- [x] Permanent Quality checks were green on the exact final reviewed heads.
- [x] Accessibility / purchase-flow audit was green on the exact final reviewed heads.
- [x] Netlify Node 22 compatibility passed where its path-filtered commerce/runtime scope applied.
- [x] Netlify Deploy Previews were green for the reviewed release-preparation PRs.
- [x] Current reviewed repository baseline is `main`.
- [x] Current reviewed Git SHA is `5bb4783ec83438bb1ebe5f25922fbd2a8d50e4a4`.
- [x] Temporary write-enabled test workflows/scripts are absent from the reviewed baseline.

**Current status:** GO for the reviewed code baseline. PR #96, the production-origin PR #97 and the Resend readiness PR #98 have been merged. This does not by itself activate production infrastructure.

## Gate 1 — public domain and HTTPS

- [x] Definitive LegendMural public domain confirmed by the owner: `https://legendmural.com`.
- [x] Domain attached to the intended Netlify production site according to the owner.
- [ ] HTTPS certificate state independently verified in the final deployed production environment.
- [ ] HTTP -> HTTPS redirect independently verified in the final deployed production environment.
- [ ] `www` -> apex redirect independently verified in the final deployed production environment.
- [x] Canonical production origin in tracked build code is `https://legendmural.com`.
- [x] Open Graph/canonical production-origin migration is enforced by the production build validator.
- [x] The tracked production build rejects the historical GitHub Pages origin as authoritative output.
- [ ] PayPal production return/cancel allow-list revalidated against the final deployed origin during Gate 6.

**Current status:** CONDITIONAL. The owner confirms the domain resolves and serves the site, but the live site is still an older Netlify deployment because the current Netlify deploy allowance is exhausted. Final HTTPS/redirect/runtime-origin checks must therefore be repeated when the current build can actually be deployed.

## Gate 2 — legal and customer operations

- [x] Seller/controller identified as Alka Group trading through LegendMural.
- [x] KvK and VAT details published on the Company Information surface.
- [x] Dutch parcel-return address confirmed and published before purchase.
- [x] Shipping page exists.
- [x] Returns / statutory withdrawal information exists.
- [x] Online withdrawal function exists without requiring an account or a reason.
- [x] Withdrawal statement collects the consumer name, contract-identifying Order ID and the electronic confirmation address.
- [x] Final withdrawal action is explicit and unambiguous.
- [x] Withdrawal registration is durable and separate from refund execution.
- [ ] The trader acknowledgement is sent without undue delay on a durable medium after each valid online withdrawal.
- [ ] The durable acknowledgement includes the declaration content, consumer name, Order ID, confirmation address, confirmation code, and receipt date/time.
- [ ] End-to-end non-production proof confirms a valid withdrawal remains recorded even if acknowledgement delivery fails.
- [x] FAQ, Privacy and Terms of Sale pages exist.
- [ ] Final customer-support/social identities reviewed if they are to be published at launch.

**Current status:** NO-GO. The registration flow exists, but launch remains blocked until durable acknowledgement delivery is configured and proven end-to-end.

## Gate 3 — statutory transactional email

- [x] Transactional provider selected: Resend.
- [ ] Definitive sending domain/subdomain configured and verified with Resend.
- [ ] Production `from` identity approved.
- [ ] Reply/customer-operations address approved.
- [ ] Provider API key stored only as a production server-side secret.
- [x] Public Privacy notice identifies Resend and the reviewed international-transfer position before production activation.
- [ ] Provider-side retention/logging behaviour for withdrawal acknowledgement data operationally accepted/documented for the production account.
- [ ] Controlled non-production withdrawal acknowledgement succeeds with the final sending identity.
- [ ] Acknowledgement arrives at the customer-provided electronic confirmation address without undue delay.
- [ ] Delivered content includes the withdrawal declaration and receipt date/time.
- [ ] Mail failure does not erase or reverse a durable withdrawal record.
- [ ] Failure handling gives operations enough signal to resend the acknowledgement without exposing secrets or customer payload in logs.

**Current status:** NO-GO. Provider/privacy readiness is merged, but production DNS, sending identity, API key and delivery proof are intentionally not activated yet.

## Gate 4 — Neon production security and recovery

- [x] Neon plan reviewed: organization is currently on Free and the limitations are explicitly accepted for the current launch-preparation phase.
- [x] Branch-protection policy reviewed. Protected branches are unavailable on the current Free plan, so compensating controls are required instead.
- [x] Passwordless-access setting reviewed as Neon account-authenticated interactive tooling; it is not treated as the application runtime authentication method.
- [x] NOLOGIN privilege role `legendmural_runtime` created on production.
- [x] NOLOGIN application role `legendmural_app` created on production and linked to `legendmural_runtime`.
- [x] NOLOGIN migration-owner role `legendmural_migrator` created with limited database-create capability and without CREATEDB/CREATEROLE/REPLICATION/BYPASSRLS.
- [x] Runtime grant contract limited to the reviewed migrations `002`, `004`, `006` and proven on a production-derived test branch.
- [x] `neondb_owner` is explicitly excluded from application runtime use.
- [x] Free-plan recovery procedure and compensating controls documented in `docs/NEON_FREE_PLAN_PRODUCTION_CONTROLS.md`.
- [x] Current 6-hour history window explicitly accepted as a Free-plan limitation for this phase.
- [x] Persistent pre-bootstrap recovery checkpoint `pre-prod-bootstrap-20260818` (`br-long-field-aspnw4co`) created from production.
- [x] Production-derived branch creation/recovery-point workflow tested.
- [x] Production application login credential remains intentionally deferred until Gate 6 so a long-lived unused runtime secret is not created early.

**Current status:** GO for the Free-plan security/recovery model with documented compensating controls. This is not equivalent to Neon Launch/Scale protection. Reconsider a paid plan when real order/customer volume increases.

## Gate 5 — Neon production bootstrap

- [x] Exact migration files `001–006` verified against reviewed release SHA `5bb4783ec83438bb1ebe5f25922fbd2a8d50e4a4`.
- [x] Persistent pre-bootstrap recovery checkpoint exists before production execution.
- [x] Migration-owner role proven capable of applying `001–006` on a production-derived branch.
- [x] Explicit runtime role substitution with `legendmural_runtime` proven before production execution.
- [x] Explicit owner approval obtained for Gate 5 production migrations on 18 August 2026.
- [x] Production execution used the authenticated Neon operator session with `SET ROLE legendmural_migrator`; no standalone migration password was created.
- [x] Migrations `001 -> 006` executed atomically on production branch `br-misty-cloud-as0rofc8`.
- [x] Production tables verified: `orders`, historical `stripe_events`, `paypal_webhook_events`, `withdrawal_requests`.
- [x] Production ownership verified: commerce tables and indexes owned by `legendmural_migrator`.
- [x] Constraints/generated provider behaviour verified after production execution.
- [x] Synthetic PayPal Order ID derived `payment_provider=paypal` on production.
- [x] `legendmural_app` SELECT/INSERT rights verified on production.
- [x] `orders` UPDATE allowed while DELETE/TRUNCATE remain denied to `legendmural_app`.
- [x] UPDATE/DELETE/TRUNCATE denied on immutable Stripe, PayPal webhook and withdrawal ledgers.
- [x] Synthetic PayPal webhook and withdrawal inserts succeeded during the production smoke test.
- [x] Synthetic smoke records removed immediately after verification.
- [x] Final production row counts verified as zero for all four commerce tables.
- [x] Production migration operator/release SHA recorded in the Gate 5 audit documentation.

**Current status:** GO. Production contains the reviewed commerce schema and is empty after smoke-test cleanup. No application runtime credential, Netlify production secret, Resend production secret or PayPal Live setting was activated by Gate 5.

## Gate 6 — Netlify production configuration

- [ ] Just-in-time least-privilege Neon application credential created and configured server-side only.
- [ ] Production Neon runtime URL uses `legendmural_app`, never `neondb_owner`.
- [ ] Correct PayPal environment variables configured.
- [ ] `PAYPAL_ALLOW_LIVE` remains disabled during infrastructure validation.
- [ ] `LEGENDMURAL_CHECKOUT_PAUSED` defaults absent/false for normal service.
- [ ] Incident operator knows how to set `LEGENDMURAL_CHECKOUT_PAUSED=true`.
- [ ] PayPal checkout, capture, webhook and order-status routes point to the intended Functions.
- [ ] Statutory withdrawal email is configured only after Gate 3 preparation is complete.
- [ ] Logs inspected for secret/PII leakage.
- [ ] Production build passes.
- [ ] Same-origin API smoke checks pass without a real charge.

**Current status:** NO-GO until production infrastructure secrets/configuration are intentionally activated.

## Gate 7 — monitoring and incident readiness

- [ ] Checkout/payment incident owner assigned.
- [ ] Customer withdrawal/refund operations owner assigned.
- [ ] Netlify Function log review location/process documented.
- [ ] PayPal webhook failure detection process documented.
- [ ] Neon/API failure detection process documented.
- [ ] Withdrawal acknowledgement delivery-failure detection and resend procedure documented.
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
- [ ] Statutory/customer confirmation operations record succeeds.
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
- transactional sending identity;
- operator(s);
- time checkout was opened;
- controlled Live order reference and outcome;
- any accepted risk/exception and owner.

Launch is not considered fully handed over until this release record exists.
