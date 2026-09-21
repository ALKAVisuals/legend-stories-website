# LegendMural storefront — READ ME FIRST

> **CURRENT OVERRIDE — 21 September 2026:** read [`CURRENT_STATUS_20260921.md`](CURRENT_STATUS_20260921.md) immediately after this heading. It supersedes older Cloudflare/P3/V3 runtime-state statements where they conflict. The current repository targets normal V3 checkout with P3 disabled, but the last directly proven remote P3 state found in Actions was still enabled; the exact next Production safety action is a separately approved P3 `disable` workflow run.

**Repository:** `ALKAVisuals/legend-stories-website`  
**Scope:** public LegendMural webshop / launch-readiness plus explicitly scoped Cloudflare/payment runtime work  
**Current runtime state:** Cloudflare hosting/DNS migration complete; PayPal P1/P2/P3 complete; Production order-email runtime enabled; customer checkout still fail-closed  
**Synchronized Cloudflare status:** [`CLOUDFLARE_CURRENT_STATUS_20260916.md`](CLOUDFLARE_CURRENT_STATUS_20260916.md)  
**P3 proof:** [`CLOUDFLARE_PAYPAL_P3_PROOF_20260914.md`](CLOUDFLARE_PAYPAL_P3_PROOF_20260914.md)  
**P3 controlled-payment plan:** [`CLOUDFLARE_PAYPAL_P3_CONTROLLED_PAYMENT_PLAN_20260914.md`](CLOUDFLARE_PAYPAL_P3_CONTROLLED_PAYMENT_PLAN_20260914.md)  
**P2 proof:** [`CLOUDFLARE_PAYPAL_P2_PROOF_20260914.md`](CLOUDFLARE_PAYPAL_P2_PROOF_20260914.md)  
**P1 proof:** [`CLOUDFLARE_PAYPAL_P1_PROOF_20260914.md`](CLOUDFLARE_PAYPAL_P1_PROOF_20260914.md)  
**Active Cloudflare migration handoff:** [`CLOUDFLARE_MIGRATION_HANDOFF_20260911.md`](CLOUDFLARE_MIGRATION_HANDOFF_20260911.md)  
**Canonical Cloudflare post-cutover proof:** [`CLOUDFLARE_PHASE4_POST_CUTOVER_PROOF_20260911.md`](CLOUDFLARE_PHASE4_POST_CUTOVER_PROOF_20260911.md)  
**PayPal Live activation plan:** [`CLOUDFLARE_PAYPAL_LIVE_ACTIVATION_PLAN_20260911.md`](CLOUDFLARE_PAYPAL_LIVE_ACTIVATION_PLAN_20260911.md)  
**General website next-chat handoff:** [`NEXT_CHAT_HANDOFF_20260905_V2.md`](NEXT_CHAT_HANDOFF_20260905_V2.md)  
**Final pre-release checklist:** [`FINAL_PRE_RELEASE_CHECKLIST_20260904.md`](FINAL_PRE_RELEASE_CHECKLIST_20260904.md)  
**Cross-track coordination:** [`PARALLEL_WORKSTREAM_COORDINATION.md`](PARALLEL_WORKSTREAM_COORDINATION.md)  
**Blocker C legal request package:** [`BLOCKER_C_DUTCH_CONSUMER_LAW_REQUEST_20260905.md`](BLOCKER_C_DUTCH_CONSUMER_LAW_REQUEST_20260905.md)

> **Every new chat working on the public website or Production payment/runtime path must start here.**

## Active Cloudflare / PayPal checkpoint — synchronized 16 September 2026

The Cloudflare hosting/DNS migration is **100% complete for its defined scope**. PayPal Stage P1, P2 and the controlled P3 Live-payment proof are complete. Production order-email runtime activation is also complete.

P3 proved exactly one controlled **EUR 0.01** Live PayPal order end to end: durable Neon `payment_pending`, buyer approval, capture/webhook reconciliation and final durable `paid` state. The sanitized proof is in `docs/CLOUDFLARE_PAYPAL_P3_PROOF_20260914.md`.

On 16 September 2026, the guarded Production workflow deployed exact commit `553fa04ca56c856721040f0748d3dea5a2f193e3` to `legendmural-cloudflare-production`. GitHub Actions run `35065848714` completed successfully. Preflight proved order emails were still off before deployment; postdeploy verification proved they were on afterward. The live checkout proof still returned `CHECKOUT_PAUSED`.

Current proven Production runtime state:

```text
PAYPAL_ALLOW_LIVE=true
LEGENDMURAL_CHECKOUT_PAUSED=true
P3_TEST_CHECKOUT_ENABLED=false
ORDER_EMAILS_ENABLED=true
V3_PROFILE1_ORDER_CREATION_ENABLED=false
V3_INVOICE_RECONCILIATION_ENABLED=false
V3_INVOICE_STORAGE_ENABLED=false
V3_DASHBOARD_INVOICE_API_ENABLED=false
```

Customer checkout remains deliberately paused. Successful P3 and order-email activation are **not** permission to launch customer commerce.

Production is now configured to send the existing paid-order emails when that normal runtime path is reached. This activation did **not** create another real-money order and therefore does not by itself prove a newly delivered real Production order email. Any new real-money/email end-to-end proof requires separate explicit approval.

During P3, Production Neon required one minimal schema repair because the current order-store adapter expected `document_profile_version`. The exact repair and proof are recorded in the P3 proof/current-status docs. Do not infer that the full V3 migration set was activated; the V3 runtime flags remain off.

### Retained internal P3 harness

The original P3 plan described the EUR 0.01 mechanism as temporary. After the successful proof, the owner explicitly chose to retain it as a **disabled internal regression/test harness** for future controlled end-to-end and possible dashboard-integration tests.

Permanent rules:

- `P3_TEST_CHECKOUT_ENABLED=false` by default;
- the P3 token remains encrypted server-side and never enters GitHub/chat/client code;
- the internal test item remains absent from the public catalog/navigation/sitemap/ordinary product pages;
- discovering the internal slug is never sufficient to create a controlled checkout;
- any future real-money use requires a separately authorized controlled test window.

This owner decision supersedes the earlier mandatory-removal instruction in the P3 plan for the current project state.

### Refund

No refund is recorded as completed. A refund is a separate money-moving Production action and requires explicit owner approval immediately before execution.

## What is still not authorized

Do not enable or execute any of the following without a new explicit scope/approval:

- general customer checkout;
- a new controlled real-money/order-email proof;
- V3 Profile 1 order creation;
- V3 invoice reconciliation;
- V3 invoice storage / Production R2 writes;
- dashboard invoice API activation;
- Netlify decommission;
- unrelated LegendMural dashboard changes;
- changes to Technisch Bouwadvies.

Do not rerun completed Cloudflare Gate 0, Phase 4, P1, P2, P3 or the Production order-email activation merely because an older document says they are pending. The synchronized current-status and proof files supersede older checkpoint language.

## Current public-website / launch-readiness state

The newest detailed general website continuation state remains `docs/NEXT_CHAT_HANDOFF_20260905_V2.md` unless a newer general website handoff is added.

The storefront is technically far advanced, but final customer launch is still blocked by remaining non-P3 launch gates. In particular:

- **Blocker C**: Dutch 100%-upfront consumer-payment legal gate remains open/parked pending written specialist verification using `docs/BLOCKER_C_DUTCH_CONSUMER_LAW_REQUEST_20260905.md`;
- **Blocker D part 2B**: remains intentionally deferred because the required production/material facts are not available;
- **Blocker E**: remains partially evidenced/deferred; do not repeatedly reopen the deferred recognizable-person/title commercial-use question unless the owner does so.

Do not manufacture technical work to bypass these launch gates.

## Required startup order

1. Read this file.
2. For Cloudflare/Production payment/runtime work, read `CLOUDFLARE_CURRENT_STATUS_20260916.md`.
3. Read `CLOUDFLARE_PAYPAL_P3_PROOF_20260914.md` before questioning or rerunning P3.
4. Read `CLOUDFLARE_PAYPAL_P3_CONTROLLED_PAYMENT_PLAN_20260914.md` for historical P3 controls; where its mandatory-removal rule conflicts with the later owner decision, the current status/P3 proof controls.
5. Read `CLOUDFLARE_MIGRATION_HANDOFF_20260911.md` for detailed migration/runtime continuation boundaries.
6. Keep `CLOUDFLARE_PAYPAL_LIVE_ACTIVATION_PLAN_20260911.md` as the high-level P1 -> P2 -> P3 approval contract.
7. For general public-website work, read `NEXT_CHAT_HANDOFF_20260905_V2.md` and the final pre-release checklist.
8. Read `PARALLEL_WORKSTREAM_COORDINATION.md` before crossing website/V3/dashboard responsibilities.
9. Fresh-check current `main`, open PRs and Production runtime state before any mutation.
10. Work one meaningful step at a time.
11. Use a task-specific branch; never write directly to `main`.
12. Inspect relevant CI before merge.
13. Immediately before merge, fresh-check `main`; compare/rebase if it changed.
14. Do not deploy or publish to Production without explicit owner approval for that exact release step.
15. Do not open customer checkout, trigger a new controlled real-money/order-email proof, enable V3 Profile 1, run additional Production migrations, issue V3 invoices, or move money unless the explicitly scoped workstream and owner approval authorize that exact action.

## Source-of-truth rule

GitHub is the source of truth. Do not reconstruct current website or Cloudflare/payment progress from old chat history.

For Cloudflare/payment runtime work, `CLOUDFLARE_CURRENT_STATUS_20260916.md` and `CLOUDFLARE_PAYPAL_P3_PROOF_20260914.md` are the active compact continuation state. Older dated status notes may contain useful history but do not override them.

For ordinary public-website/launch-readiness work, the newest general website handoff/current status and `PARALLEL_WORKSTREAM_COORDINATION.md` remain authoritative unless replaced by a newer synchronized handoff.

The separate LegendMural V3/dashboard tracks maintain their own handoffs and decisions. Do not reconstruct or overwrite those tracks from this document.

## Public website scope

This track may work on:

- storefront UI/UX, homepage, shop and product presentation;
- responsive/mobile improvements;
- general public content;
- Privacy, Terms, Shipping and Returns;
- AVG/privacy launch-readiness;
- GPSR/product-safety presentation;
- SEO/canonical/Open Graph metadata;
- general visual website improvements;
- launch-readiness blockers that do not modify V3-owned backend responsibilities.

## V3/backend boundary

Without explicit cross-track approval, ordinary website work must not modify V3 invoice/notification adapters, paid-order finalization, Profile-0/Profile-1 routing, invoice snapshot/PDF/Resend/retry code or V3 order/invoice/notification migrations.

An explicitly scoped Cloudflare/payment-runtime task may touch only the narrow integration surface required by that task and must preserve all payment/runtime guardrails.

## Required report after website or runtime work

Always report:

- files changed;
- whether V3-owned/protected files remained untouched or exactly which approved integration file changed;
- branch + PR;
- starting `main` SHA;
- whether `main` changed during the work;
- tests/CI result;
- exact next step.

## Safety

Never commit secrets, customer payloads, database credentials, PayPal secrets or email-provider API keys. Never ask the owner to paste secrets into chat or GitHub documentation.
