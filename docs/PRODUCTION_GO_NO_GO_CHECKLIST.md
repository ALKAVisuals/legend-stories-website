# LegendMural production go / no-go checklist

Last reviewed: 18 August 2026.

This checklist converts production readiness into explicit release gates. A **GO** means every mandatory item for that gate is verified. Any unresolved mandatory item means **NO-GO** for the dependent production phase.

## Gate 0 — reviewed code baseline

- [x] PRs #96, #97, #98, #99, #101, #102 and #103 intentionally merged.
- [x] Current reviewed repository baseline is `main`.
- [x] Current reviewed Git SHA is `1b5158e789de9f903cea1490853f2388631fb2a3`.
- [x] PR #101 exact-head Quality checks passed, including unit tests, Neon integration harness, Vite production build and output validation.
- [x] PR #102 documentation/handoff exact-head Quality and Accessibility checks passed before merge.
- [x] PR #103 exact-head Quality, Accessibility / purchase-flow and Netlify Node 22 compatibility checks passed before merge.
- [x] Temporary write-enabled migration/test branches used for validation were removed after use.

**Current status:** GO for the reviewed code baseline. This does not by itself activate a fresh production deployment, PayPal Live or Resend production sending.

## Gate 1 — public domain and HTTPS

- [x] Definitive public origin confirmed as `https://legendmural.com`.
- [x] Domain attached to the intended Netlify site according to the owner.
- [x] Tracked build, canonical, Open Graph, sitemap/robots and redirect configuration use the apex production origin.
- [x] Tracked Netlify configuration normalizes HTTP, `www` and the Netlify subdomain to HTTPS apex.
- [ ] HTTPS certificate state reverified against the first current production deployment.
- [ ] HTTP -> HTTPS redirect reverified against the first current production deployment.
- [ ] `www` -> apex redirect reverified against the first current production deployment.
- [ ] PayPal production return/cancel origin revalidated after that deployment.

**Current status:** CONDITIONAL. The domain is linked, but Netlify production deploy capacity is currently unavailable, so final live-origin verification must wait for the next production deployment.

## Gate 2 — legal and customer operations

- [x] Seller/controller, KvK, VAT and Dutch parcel-return address published.
- [x] Shipping, Returns/withdrawal, FAQ, Privacy and Terms of Sale surfaces exist.
- [x] Online withdrawal function does not require an account or a reason.
- [x] Withdrawal statement collects consumer name, contract-identifying Order ID and electronic confirmation address.
- [x] Withdrawal registration is durable and separate from refund execution.
- [x] Production has a separate durable acknowledgement snapshot/outbox for statement evidence and delivery state.
- [x] Statement fields in the acknowledgement record are immutable to the application runtime; only delivery metadata is updateable.
- [ ] Trader acknowledgement is actually delivered without undue delay on a durable medium after each valid online withdrawal.
- [ ] Controlled delivery proves the acknowledgement contains declaration, consumer name, Order ID, confirmation address, confirmation code and receipt date/time.
- [ ] Final customer-support/social identities reviewed if they are to be published at launch.

**Current status:** NO-GO until transactional acknowledgement delivery is configured and proven end-to-end.

## Gate 3 — statutory transactional email

- [x] Transactional provider selected: Resend.
- [x] Privacy notice identifies Resend and the reviewed international-transfer position.
- [x] Durable acknowledgement outbox exists in production so delivery failure does not erase the withdrawal statement.
- [x] Controlled operator resend script exists and refuses to resend an acknowledgement already recorded as sent.
- [x] Optional server-side `RESEND_REPLY_TO` support is implemented for both initial delivery and controlled retry.
- [x] `docs/RESEND_PRODUCTION_ACTIVATION.md` documents sending-domain, least-privilege API-key, Reply-To, delivery/failure proof and provider-retention acceptance.
- [ ] Definitive sending domain/subdomain configured and verified with Resend.
- [ ] Production `from` identity approved.
- [ ] Monitored Reply-To/customer-operations address approved.
- [ ] Provider API key stored only as a production server-side secret.
- [ ] Provider-side retention/logging behaviour operationally accepted for the production account.
- [ ] Controlled non-production acknowledgement succeeds with the final sending identity.
- [ ] Delivered content, reply routing and delivery timing verified.
- [ ] Failure + controlled resend procedure exercised without exposing secrets/customer payloads in logs.

**Current status:** NO-GO. Code, privacy, Reply-To and durable resend architecture are ready; provider/DNS/secrets/delivery proof remain intentionally inactive.

## Gate 4 — Neon production security and recovery

- [x] Neon Free-plan limitations and 6-hour history window explicitly accepted for launch preparation.
- [x] `legendmural_runtime` is the NOLOGIN privilege group.
- [x] `legendmural_app` is the least-privilege LOGIN application role and is a member of `legendmural_runtime`.
- [x] `legendmural_app` has no CREATEDB, CREATEROLE, REPLICATION or BYPASSRLS privilege.
- [x] `legendmural_migrator` remains NOLOGIN and owns the commerce schema objects created by the reviewed migrations.
- [x] `neondb_owner` is excluded from application runtime use.
- [x] Persistent original checkpoint `pre-prod-bootstrap-20260818` remains available.
- [x] Current pre-acknowledgement checkpoint `pre-ack-outbox-20260818` (`br-falling-art-asrdqbvp`) was created immediately before migrations `007–008`.
- [x] Production-derived temporary branch testing/recovery workflow has been exercised successfully.

**Current status:** GO under documented Free-plan compensating controls. This is not equivalent to Neon paid branch protection.

## Gate 5 — Neon production schema

- [x] Migrations `001–006` executed and verified on production.
- [x] PR #101 introduced additive migrations `007–008` for the durable withdrawal acknowledgement outbox.
- [x] `007–008` were first proven on a temporary production-derived branch.
- [x] Owner explicitly approved the production `007–008` execution on 18 August 2026.
- [x] New recovery checkpoint created immediately before production execution.
- [x] Migrations `007–008` executed atomically on production branch `br-misty-cloud-as0rofc8` under `legendmural_migrator` with runtime grants targeted at `legendmural_runtime`.
- [x] `withdrawal_acknowledgements` and its index are owned by `legendmural_migrator`.
- [x] `legendmural_app` has SELECT/INSERT on acknowledgements and no DELETE/TRUNCATE/table-wide UPDATE.
- [x] Immutable statement fields cannot be updated by `legendmural_app`; only reviewed delivery metadata can be updated.
- [x] Final production row counts after verification: 0 orders, 0 withdrawals, 0 acknowledgements.

**Current status:** GO. Production schema is at reviewed migration level `001–008` with no synthetic/customer rows left from verification.

## Gate 6 — Netlify production configuration

- [x] Least-privilege production database role is `legendmural_app`, never `neondb_owner`.
- [x] Production `NEON_DATABASE_URL` has been stored by the owner in the Netlify **Production** deploy context as a secret; the existing Deploy Preview value remains separate.
- [x] Connection target uses production branch/database, pooling and required TLS parameters.
- [x] Tracked routes map checkout, capture, webhook and order-status to their intended Netlify Functions.
- [x] Checkout kill switch is opt-in: `LEGENDMURAL_CHECKOUT_PAUSED=true` blocks only new checkout creation while preserving capture/webhook/status reconciliation paths.
- [x] `docs/FIRST_PRODUCTION_DEPLOY_CHECKLIST.md` defines the exact deployment and no-charge smoke procedure.
- [x] Current runtime changes through PR #103 passed Quality and Netlify Node 22 compatibility before merge.
- [ ] A fresh production deploy has consumed the new Production environment value. **Blocked by current Netlify deploy capacity.**
- [ ] Production `CHECKOUT_ALLOWED_ORIGINS`, success/cancel URLs and PayPal variables reverified for the final apex origin.
- [ ] `PAYPAL_ALLOW_LIVE` confirmed disabled during infrastructure validation.
- [ ] `PAYPAL_API_BASE` confirmed to use the intended Sandbox environment during infrastructure validation.
- [ ] Production PayPal client/webhook secret contexts inspected without exposing their values.
- [ ] Same-origin API smoke checks pass after the fresh deploy without creating a real charge.
- [ ] Netlify Function logs inspected for configuration failures and secret/PII leakage after the smoke checks.
- [ ] Resend variables remain absent/inactive until Gate 3 activation is deliberately approved.

**Current status:** CONDITIONAL / deployment-blocked. The production database secret is stored, but it is not considered runtime-proven until a fresh Netlify production deployment and no-charge smoke test succeed.

## Gate 7 — monitoring and incident readiness

- [x] Incident/rollback runbook exists.
- [x] Checkout containment model preserves capture, webhook and order-status reconciliation.
- [x] Payment reconciliation checklist exists.
- [x] Withdrawal acknowledgement failure has a durable delivery state and controlled CLI resend path.
- [x] `docs/PRODUCTION_MONITORING_HANDOFF.md` documents Netlify Function log, PayPal webhook, Neon and withdrawal-queue review procedures.
- [x] Netlify Function log review location/process documented from current Netlify guidance.
- [x] PayPal webhook delivery/failure dashboard and resend process documented from current PayPal guidance.
- [x] Neon production branch monitoring process documented.
- [ ] Checkout/payment incident owner assigned by name.
- [ ] Customer withdrawal/refund operations owner assigned by name.
- [ ] Database recovery decision authority assigned by name.
- [ ] Named owners/backups recorded in the monitoring handoff.
- [ ] Netlify Function log access confirmed on the real production account after deploys resume.
- [ ] PayPal Webhooks Events access confirmed for the intended app/environment.
- [ ] Neon production Monitoring access confirmed by the release operator.
- [ ] `LEGENDMURAL_CHECKOUT_PAUSED` containment procedure exercised in a non-production or controlled production-safe scenario.
- [ ] Known-good Netlify rollback procedure confirmed against an actual deploy once current deploy capacity resumes.
- [ ] Release operator has reviewed the incident, deploy-day and monitoring handoff documents.

**Current status:** PARTIAL. Technical monitoring, containment and reconciliation procedures are documented; named owners and live account/deploy exercises remain.

## Gate 8 — PayPal Live enablement

- [ ] Gates 0–7 are GO.
- [ ] PayPal Business account fully verified.
- [ ] Dedicated Live app/credentials configured server-side.
- [ ] Live webhook created and its ID matched exactly.
- [ ] `PAYPAL_ALLOW_LIVE=true` enabled only after separate explicit approval.
- [ ] Checkout not paused.
- [ ] One controlled low-value real order authorized.
- [ ] Browser return, capture amount/currency/reference, Neon durable paid state and webhook idempotency all verified.
- [ ] Fulfilment released only after durable paid verification.

Any mismatch during the controlled Live order is an immediate **NO-GO**: pause new checkout and use the incident runbook.

**Current status:** NO-GO. PayPal Live is intentionally not enabled.

## Gate 9 — launch completion record

Before handover, record:

- release Git SHA;
- Netlify production deploy ID;
- domain/origin;
- Neon project/branch and migration level/timestamp;
- runtime/migration role names (never passwords/URLs);
- PayPal mode/app identity and webhook ID reference;
- transactional sending identity;
- named operators/decision authorities;
- time checkout was opened;
- controlled Live order reference/outcome;
- any accepted risk/exception and owner.

Launch is not considered fully handed over until this release record exists.
