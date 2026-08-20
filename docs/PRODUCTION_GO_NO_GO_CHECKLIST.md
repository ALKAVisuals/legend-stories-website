# LegendMural production go / no-go checklist

Last reviewed: 20 August 2026.

This checklist converts production readiness into explicit release gates. A **GO** means every mandatory item for that gate is verified. Any unresolved mandatory item means **NO-GO** for the dependent production phase.

The repository baseline is `main`. Do not hard-code a rolling preparation SHA here. The **exact final release Git SHA** must be captured in `docs/LAUNCH_COMPLETION_RECORD.md` at Gate 9 when the deploy candidate is frozen.

## Gate 0 — reviewed code baseline

- [x] Core launch-preparation PRs #96, #97, #98, #99 and #101 intentionally merged.
- [x] Gate 6/7 readiness PRs #102, #103, #104 and #105 intentionally merged.
- [x] Commerce logging hardening PR #107 intentionally merged after reviewed checks.
- [x] PayPal capture-denied reconciliation PR #109 intentionally merged on 19 August 2026.
- [x] Current reviewed repository baseline is `main`.
- [x] Public production code does not depend on an unmerged staging branch.
- [x] Temporary write-enabled migration/test branches used for production-derived validation were removed after use.
- [ ] Final release SHA recorded in the launch completion record after the deploy candidate is frozen.

**Current status:** GO for the reviewed pre-deploy code baseline. This does not by itself activate a fresh production deployment, PayPal Live or customer-facing transactional delivery.

## Gate 1 — public domain and HTTPS

- [x] Definitive public origin confirmed as `https://legendmural.com`.
- [x] Domain attached to the intended Netlify site according to the owner.
- [x] Tracked build, canonical, Open Graph, sitemap/robots and redirect configuration use the apex production origin.
- [x] Tracked Netlify configuration normalizes HTTP, `www` and the Netlify subdomain to HTTPS apex.
- [ ] HTTPS certificate state reverified against the first current production deployment.
- [ ] HTTP -> HTTPS redirect reverified against the first current production deployment.
- [ ] `www` -> apex redirect reverified against the first current production deployment.
- [ ] PayPal return/cancel origin revalidated after that deployment.

**Current status:** CONDITIONAL. The domain is linked, but Netlify production deploy capacity is currently unavailable, so final live-origin verification waits for the next current production deployment.

## Gate 2 — legal and customer operations

- [x] Seller/controller, KvK, VAT and Dutch parcel-return address published.
- [x] Shipping, Returns/withdrawal, FAQ, Privacy and Terms of Sale surfaces exist.
- [x] Online withdrawal function does not require an account or a reason.
- [x] Withdrawal statement collects consumer name, contract-identifying Order ID and electronic confirmation address.
- [x] Withdrawal registration is durable and separate from refund execution.
- [x] Production has a separate durable acknowledgement snapshot/outbox for statement evidence and delivery state.
- [x] Statement fields in the acknowledgement record are immutable to the application runtime; only delivery metadata is updateable.
- [x] Production transactional-email configuration has been prepared so acknowledgement delivery can be exercised after a current deploy.
- [ ] Trader acknowledgement is actually delivered without undue delay on a durable medium after each valid online withdrawal.
- [ ] Controlled delivery proves the acknowledgement contains declaration, consumer name, Order ID, confirmation address, confirmation code and receipt date/time.
- [ ] Final customer-support/social identities reviewed if they are to be published at launch.

**Current status:** NO-GO until the configured acknowledgement path is proven end-to-end on a current deployment.

## Gate 3 — statutory transactional email

- [x] Transactional provider selected: Resend.
- [x] Privacy notice identifies Resend and the reviewed international-transfer position.
- [x] Durable acknowledgement outbox exists in production so delivery failure does not erase the withdrawal statement.
- [x] Controlled operator resend script exists and refuses to resend an acknowledgement already recorded as sent.
- [x] Optional server-side `RESEND_REPLY_TO` support is implemented for both initial delivery and controlled retry.
- [x] Resend delivery uses a stable withdrawal-specific idempotency key.
- [x] Definitive sending domain/subdomain configured and verified with Resend.
- [x] Required DNS records for the sending identity have been configured and verified.
- [x] Production `from` identity configured.
- [x] Monitored Reply-To/customer-operations address configured.
- [x] Provider API key stored only as a production server-side secret in Netlify.
- [x] `docs/RESEND_PRODUCTION_ACTIVATION.md` documents sending-domain, least-privilege API-key, Reply-To, delivery/failure proof and provider-retention acceptance.
- [x] Provider-side retention/logging behaviour operationally accepted for the production account by the owner on 19 August 2026.
- [ ] A current deployed acknowledgement succeeds with the final production sending identity.
- [ ] Delivered content, provider delivery state, inbox receipt, reply routing and delivery timing verified.
- [ ] Controlled failure + retry procedure exercised without exposing secrets/customer payloads in logs.

**Current status:** NO-GO for final launch. Provider/domain/DNS/API-key/FROM/Reply-To and provider-retention acceptance are complete; production delivery, reply and controlled retry evidence still require a current deployment.

## Gate 4 — Neon production security and recovery

- [x] Neon Free-plan limitations and 6-hour history window explicitly accepted for launch preparation.
- [x] `legendmural_runtime` is the NOLOGIN privilege group.
- [x] `legendmural_app` is the least-privilege LOGIN application role and is a member of `legendmural_runtime`.
- [x] `legendmural_app` has no CREATEDB, CREATEROLE, REPLICATION or BYPASSRLS privilege.
- [x] `legendmural_migrator` remains NOLOGIN and owns the commerce schema objects created by the reviewed migrations.
- [x] `neondb_owner` is excluded from application runtime use.
- [x] Persistent original checkpoint `pre-prod-bootstrap-20260818` remains available.
- [x] Pre-acknowledgement checkpoint `pre-ack-outbox-20260818` (`br-falling-art-asrdqbvp`) remains available.
- [x] Production-derived temporary branch testing/recovery workflow has been exercised successfully.

**Current status:** GO under documented Free-plan compensating controls. This is not equivalent to Neon paid branch protection.

## Gate 5 — Neon production schema

- [x] Migrations `001–006` executed and verified on production.
- [x] Additive migrations `007–008` for the durable withdrawal acknowledgement outbox were first proven on a production-derived temporary branch.
- [x] Owner explicitly approved production `007–008` execution on 18 August 2026.
- [x] Recovery checkpoint created immediately before production execution.
- [x] Migrations `007–008` executed atomically on production branch `br-misty-cloud-as0rofc8` under `legendmural_migrator` with runtime grants targeted at `legendmural_runtime`.
- [x] `withdrawal_acknowledgements` and its index are owned by `legendmural_migrator`.
- [x] `legendmural_app` has SELECT/INSERT on acknowledgements and no DELETE/TRUNCATE/table-wide UPDATE.
- [x] Immutable statement fields cannot be updated by `legendmural_app`; only reviewed delivery metadata can be updated.
- [x] Final production row counts after migration verification: 0 orders, 0 withdrawals, 0 acknowledgements.

**Current status:** GO. Production schema is at reviewed migration level `001–008` with no synthetic/customer rows left from migration verification.

## Gate 6 — Netlify production configuration

- [x] Least-privilege production database role is `legendmural_app`, never `neondb_owner`.
- [x] Production `NEON_DATABASE_URL` has been stored by the owner in the Netlify **Production** deploy context as a secret; Deploy Preview remains separate.
- [x] Connection target uses production branch/database, pooling and required TLS parameters.
- [x] Production `CHECKOUT_SUCCESS_URL` is configured for `https://legendmural.com/order-success.html`.
- [x] Production `CHECKOUT_CANCEL_URL` is configured for `https://legendmural.com/order-cancelled.html`.
- [x] Production `CHECKOUT_ALLOWED_ORIGINS` is configured for `https://legendmural.com`.
- [x] `PAYPAL_ALLOW_LIVE=false` was explicitly confirmed during pre-launch preparation and remains the required safety state until Gate 8 approval.
- [x] Production Resend API key/FROM/Reply-To values have been prepared in the Production context.
- [x] Tracked routes map checkout, capture, webhook and order-status to their intended Netlify Functions.
- [x] Checkout kill switch is opt-in: `LEGENDMURAL_CHECKOUT_PAUSED=true` blocks only new checkout creation while preserving capture/webhook/status reconciliation paths.
- [x] Automated coverage proves the checkout pause returns before database/PayPal bootstrap.
- [x] `docs/FIRST_PRODUCTION_DEPLOY_CHECKLIST.md` defines the exact deployment and no-charge smoke procedure.
- [x] Unexpected commerce fallback logging is hardened so checkout/capture/order-status/withdrawal do not dump complete error objects.
- [ ] A fresh production deploy has consumed the prepared Production environment values. **Blocked by current Netlify deploy capacity.**
- [ ] Production PayPal endpoint/client/webhook values reverified as one coherent environment immediately before the first current deploy; do not mix Sandbox and Live credentials.
- [ ] Same-origin API smoke checks pass after the fresh deploy without creating a real charge.
- [ ] Netlify Function logs inspected for configuration failures and secret/PII leakage after the smoke checks.
- [ ] Production Resend configuration proven by a controlled acknowledgement after the fresh deploy.

**Current status:** CONDITIONAL / deployment-blocked. Production configuration is substantially prepared, but none of the newly stored values are considered runtime-proven until a fresh Netlify production deployment and controlled smoke/E2E checks succeed.

## Gate 7 — monitoring and incident readiness

- [x] Incident/rollback runbook exists.
- [x] Checkout containment model preserves capture, webhook and order-status reconciliation.
- [x] Checkout containment code path is covered by automated tests and runs before database/PayPal bootstrap.
- [x] Payment reconciliation checklist exists.
- [x] Withdrawal acknowledgement failure has a durable delivery state and controlled CLI resend path.
- [x] `docs/PRODUCTION_MONITORING_HANDOFF.md` documents Netlify Function log, PayPal webhook, Neon and withdrawal-queue review procedures.
- [x] Netlify Function log review location/process documented from current Netlify guidance.
- [x] PayPal webhook delivery/failure dashboard and resend process documented from current PayPal guidance.
- [x] Neon production branch monitoring process documented.
- [x] Checkout/payment incident owner assigned by name.
- [x] Customer withdrawal/refund operations owner assigned by name.
- [x] Database recovery decision authority assigned by name.
- [x] Named owners/backups recorded in the monitoring handoff; no backup is currently assigned and that temporary state is explicit.
- [ ] Netlify Function log access confirmed against a current production deployment.
- [ ] PayPal Webhooks Events delivery visibility confirmed for the intended Live app after a controlled event.
- [ ] Neon production Monitoring access confirmed by the release operator.
- [ ] `LEGENDMURAL_CHECKOUT_PAUSED` containment exercised against an actual non-production/current deployment; automated coverage alone is not an operations drill.
- [ ] Known-good Netlify rollback procedure confirmed against an actual deploy once current deploy capacity resumes.
- [x] Release operator has reviewed the incident, deploy-day and monitoring handoff documents on 20 August 2026.

**Current status:** PARTIAL. Technical monitoring, containment and reconciliation procedures are prepared, the three primary operational owners are assigned and the release-operator review is complete; real deployment/account exercises remain.

## Gate 8 — PayPal Live enablement

- [ ] Gates 0–7 are GO.
- [ ] PayPal Business account fully verified for launch use.
- [x] Dedicated Live REST app `LegendMural Production` created.
- [ ] Live client credentials stored and reverified in the Netlify Production context as a coherent Live configuration.
- [ ] Live webhook registration and exact webhook ID matched to the Netlify Production value.
- [ ] Live webhook event selection verified against the event types currently supported by the production reconciler, including `PAYMENT.CAPTURE.DENIED` from PR #109.
- [ ] Production API base confirmed as the official Live endpoint immediately before activation.
- [ ] `PAYPAL_ALLOW_LIVE=true` enabled only after separate explicit approval.
- [ ] Checkout not paused.
- [ ] One controlled low-value real order authorized.
- [ ] Browser return, capture amount/currency/reference, Neon durable paid state and webhook idempotency all verified.
- [ ] Fulfilment released only after durable paid verification.

Any mismatch during the controlled Live order is an immediate **NO-GO**: pause new checkout and use the incident runbook.

**Current status:** NO-GO. The dedicated Live app exists, but Live runtime activation remains intentionally blocked behind the remaining gates and separate explicit approval.

## Gate 9 — launch completion record

- [x] Sanitized launch record template exists at `docs/LAUNCH_COMPLETION_RECORD.md` on the launch-readiness branch.
- [ ] Final release Git SHA recorded.
- [ ] Netlify production deploy ID/timestamp recorded.
- [ ] Domain/origin verification outcome recorded.
- [ ] Neon branch/migration level and runtime role names recorded without secrets/URLs.
- [ ] PayPal mode/app/webhook identity reference and controlled Live outcome recorded without real customer/payment identifiers in the public repo.
- [ ] Transactional sending identity and acknowledgement proof recorded, with customer evidence kept in an approved private location.
- [ ] Named operators/decision authorities recorded.
- [ ] Accepted risks/exceptions have a named owner and review date.
- [ ] Recovery-checkpoint retirement/retention decision recorded explicitly after successful launch validation.

Launch is not considered fully handed over until this release record is completed.