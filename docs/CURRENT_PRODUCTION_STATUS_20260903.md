# LegendMural current production status — public website launch-readiness

**Updated:** 4 September 2026  
**Repository:** `ALKAVisuals/legend-stories-website`  
**Scope:** public LegendMural storefront / launch-readiness only  
**Production host:** Netlify  
**Canonical intended public origin:** `https://legendmural.com`

> **START HERE AFTER `docs/READ_ME_FIRST.md`.** Also read `docs/PARALLEL_WORKSTREAM_COORDINATION.md` before changing the repository.

GitHub is the source of truth. Do not reconstruct current website progress from old chats.

---

## 1. Workstream boundary

This track owns the public website and launch-readiness: UI/UX, homepage/shop/product presentation, responsive/mobile, Privacy/AVG, Terms/Shipping/Returns, GPSR/product-safety presentation, SEO and canonical/Open Graph/final-domain metadata.

The separate V3 chat owns Commerce / Orders / Invoices backend and delivery work.

Without explicit cross-track approval, this website track must not modify the V3-reserved files or responsibilities listed in `docs/PARALLEL_WORKSTREAM_COORDINATION.md`, including invoice/notification code, paid-order finalization, PayPal capture/webhook reconciliation, Profile-0/Profile-1 routing, V3 migrations, invoice snapshots, PDF delivery and V3 retry/delivery behavior.

If a website task appears to require a protected V3 file or responsibility, stop and report the exact dependency before changing anything.

---

## 2. Current repository checkpoint

The 50/50-removal handoff branch was created from fresh `main`:

`45cce6ed49df1342dd000a82934567be4f231863`

Branch:

`docs/blocker-c-remove-50-50-20260904`

PR #184 made the owner's business direction canonical: **LegendMural remains PayPal-only for now.**

PR #185 recorded a possible 50% deposit + later-balance architecture as a research direction. That direction is now **explicitly superseded by the owner decision on 4 September 2026 that LegendMural will not use split payments, deposits or a later balance.** Do not revive or implement that architecture.

The canonical payment business model is now:

> **Customer places the order and pays 100% immediately through PayPal. Only after full payment does LegendMural process/produce and later deliver the order.**

At this checkpoint, storefront `main` also contains separate V3 work. That V3 work is outside this website track; do not reconstruct or modify its implementation from this handoff.

Recent substantive website merges include:

- PR #172 — production-preview WebKit regression hardening;
- PR #173 — Privacy-audit handoff;
- PR #174 — Privacy/AVG launch wording and contract tests;
- PR #183 — Blocker C read-only checkout/payment-method research handoff;
- PR #184 — canonical PayPal-only owner direction;
- PR #185 — PayPal-only feasibility research, with its 50/50 implementation direction now superseded by the owner decision above.

Before every new website branch and immediately before every merge, fresh-check `main` because the V3 workstream may merge in parallel.

No Netlify Production deployment, PayPal Live activation, Production email activation, V3 Profile 1 activation or Production migration is authorized by this handoff.

---

## 3. Current public website readiness

These percentages are internal project-tracking estimates, not legal certification.

| Area | Readiness | Current assessment |
|---|---:|---|
| Storefront UI/content core | **96%** | Main shopping experience built and broadly tested |
| Company/legal information pages | **92%** | Strong baseline; later final consistency review remains |
| Privacy / AVG | **95%** | Audit and public wording implementation complete; final launch audit still applies |
| Cookies / tracking | **90%** | Functional storage documented; no advertising pixels/behavioural analytics found in tracked baseline |
| Returns / statutory withdrawal | **95%** | 14-day right, model form and online withdrawal function exist |
| Checkout / payment-law presentation | **68%** | Owner model is fixed at 100% upfront PayPal-only; exact Dutch legal applicability still needs targeted verification |
| Pricing / shipping / commercial-claim consistency | **95%** | Blocker A closed via PR #159 |
| GPSR / product-safety presentation | **40%** | Manufacturer/contact/identification/safety presentation incomplete |
| Final-domain metadata / SEO | **50%** | Old preview/GitHub Pages metadata still needs cleanup |
| Netlify Production cutover | **0%** | Not authorized yet |
| Controlled Live proof | **0%** | Only after all launch gates and explicit owner approval |

**Overall public website launch-readiness estimate: ~84%.**

The unresolved launch gates matter more than the average percentage.

---

## 4. Completed public website work — do not reopen without regression evidence

### Storefront / mobile / content

- 111-product catalogue and generated product-page architecture;
- central public product/variant presentation;
- mobile navigation fix and real iPhone Safari confirmation;
- mobile checkout/WebKit regression coverage;
- initial WebKit stabilization via PR #169;
- production-preview WebKit hardening via PR #172;
- About page redesign;
- Company, Terms, Privacy, Shipping and Returns page baselines.

### Legal / consumer baseline

- Company Information page;
- Terms page;
- Shipping page baseline;
- Returns page;
- statutory 14-day withdrawal information;
- model withdrawal form;
- dedicated `withdraw.html` online withdrawal function.

### Blocker A — pricing/shipping/commercial consistency — COMPLETE via PR #159

Authoritative public launch rules remain:

- Compact: **€35 incl. VAT**;
- Statement: **€45 incl. VAT**;
- `LEGEND10`: 10% discount;
- Netherlands shipping: **€4.95**;
- EU shipping: **€9.95**;
- United States: **€9.95 tracked**;
- free shipping from **€69 after discount**;
- no fixed marketing delivery estimate such as `2–4 days`;
- no conflicting `30-day return` marketing promise.

Owner policy: do **not** publish a concrete expected delivery time in general storefront marketing copy. The Shipping page may state the legal fallback that, unless otherwise agreed, consumer goods are delivered without undue delay and no later than 30 days. This is not an expected delivery estimate.

### Blocker B — Privacy / AVG — COMPLETE via PR #174

The Privacy audit established the actual public data/provider baseline, and the owner approved the ordinary contact/support retention policy of **12 months after the request is resolved**.

The merged Privacy implementation:

- removes the stale Google Places/address-assistance statement;
- documents manual/local checkout-address processing accurately;
- covers the homepage contact form and ordinary support correspondence;
- documents functional `localStorage` and temporary `sessionStorage` use;
- documents PayPal, Netlify, Neon, Resend, Google Fonts and jsDelivr at a public-facing level;
- removes internal Resend launch/API-key/test-gate wording from the public notice;
- states the 7-year statutory administration baseline;
- states the conditional 10-year OSS/IOSS rule where applicable;
- states the approved 12-month ordinary contact/support period;
- uses an up-to-5-year policy for non-fiscal consumer-right/contractual claim evidence where needed, subject to shorter sufficiency and applicable holds;
- explicitly avoids claiming that automated deletion is already enforced for every category;
- includes Privacy contract-test coverage in Quality CI.

---

## 5. Remaining public website launch blockers

### Blocker C — checkout/payment-law presentation — 100% UPFRONT PAYPAL-ONLY MODEL FIXED, LEGAL VERIFICATION OPEN

#### Current checkout mapping

The current LegendMural storefront uses a two-stage hosted PayPal journey:

1. the public checkout drawer shows totals and the button **`Continue to payment`**;
2. that button validates the customer/address, creates a hosted PayPal checkout and redirects to PayPal;
3. the PayPal order is created with `intent: CAPTURE` and `user_action: PAY_NOW`;
4. the customer approves the full payment on PayPal;
5. after return, the server capture/status flow verifies full payment before the order is treated as paid.

Working conclusion: the LegendMural **`Continue to payment`** button is a transition to the payment provider, not the final payment-obligation control. Do not rename it to wording that falsely suggests the consumer is already paying on LegendMural. A controlled PayPal Sandbox proof is still required later to visually confirm the final PayPal control and order-total presentation before launch.

#### Canonical owner payment model — 100% upfront, PayPal only

The owner has explicitly decided that LegendMural will use this payment model:

- PayPal is the only payment provider for now;
- the customer pays **100% of the order total when placing the order**;
- processing/production starts only after full payment;
- delivery happens later;
- LegendMural will **not** use 50/50 payments;
- LegendMural will **not** use a deposit + later balance;
- LegendMural will **not** use Mollie, Riverty, Klarna or another payment provider merely to solve Blocker C;
- do not redesign V3 for split-payment states unless the owner explicitly reverses this decision in the future.

This model matches the current technical payment architecture, which is already full-payment-only.

#### Legal question that remains open

Prior ACM research indicates that Dutch consumer rules can restrict mandatory advance payment for consumer goods that have not yet been delivered. However, **do not treat a 50/50 workaround as the project solution**. Before changing the business model or payment architecture, perform a targeted legal verification of the exact LegendMural situation.

That verification must determine, using current authoritative Dutch/EU sources:

1. whether the Dutch advance-payment restriction applies to LegendMural's actual online sale of physical wall stickers under the intended order/production model;
2. whether any legally relevant exception, classification or contract/product characteristic changes that conclusion;
3. whether made-to-order production, customization/personalization or production only after payment is legally relevant, but only where those characteristics actually apply to the LegendMural product being sold;
4. whether a Dutch webshop may lawfully require 100% upfront payment in this exact situation;
5. if not, whether the owner must change the commercial model before Dutch launch — without automatically assuming split payments are acceptable or desired.

Do not implement checkout/payment changes while this legal applicability question remains unresolved.

#### Superseded direction from PR #185

The following earlier research direction is **not approved and must not be implemented**:

- 50% PayPal deposit;
- balance-due state;
- second PayPal payment after delivery;
- PayPal Facturering/Invoicing for the remaining balance;
- V3 `deposit_paid`, `balance_due` or similar split-payment lifecycle.

Those ideas remain historical research only. They are not part of the current LegendMural roadmap.

#### Technical baseline remains aligned with owner intent

The present implementation is intentionally full-payment-only:

- `server/payments/paypal-checkout.mjs` creates one PayPal order for the full authoritative grand total with `intent: CAPTURE`;
- `server/orders/checkout-persistence.mjs` requires the hosted checkout grand total to equal the authoritative full order total and stores one PayPal payment session;
- `server/payments/paypal-capture.mjs` requires the captured total to equal the full stored order amount;
- `server/api/capture-paypal-order.mjs` treats a verified full capture as the paid transition;
- V3 paid-order finalization/invoice issuance follows only after verified full payment.

Do not alter these V3/payment semantics from the website track unless the legal verification produces a concrete blocker and the owner explicitly approves a new business direction.

A small website-only checkout disclosure improvement may still be needed later, but only after the legal position of the 100% upfront model is resolved.

### Blocker D — GPSR / product-safety presentation

Add/confirm centralized public manufacturer/trader identity, postal/electronic contact, sufficient product identification and applicable use/safety information. Implement centrally/template-driven rather than manually editing 111 pages.

### Blocker E — commercial rights/IP owner gate

Before commercial launch, the owner must separately confirm required commercial rights/permissions for designs, portraits, names, trademarks and other protected material. This cannot be proven from repository code.

### Blocker F — final-domain metadata / SEO

Replace remaining preview/GitHub Pages canonical/Open Graph references with correct `https://legendmural.com` handling and verify generated/public metadata.

---

## 6. Exact website release order from here

1. **Blocker C:** targeted read-only legal verification of the owner's fixed 100%-upfront PayPal-only model. Do not design or implement split payments. If the model is lawful for the intended LegendMural sales, keep the existing full-payment architecture and only implement any necessary public checkout wording. If the model is not lawful, stop and report the exact launch conflict to the owner before any payment-code change.
2. **Blocker D:** centralized GPSR/product-safety presentation.
3. **Blocker F:** `legendmural.com` canonical/Open Graph/SEO cleanup.
4. **Final website audit:** confirm legal/content/UI gates, owner IP gate and relevant CI; coordinate with V3 track and freeze an exact release SHA.
5. **Production only after explicit approval:** controlled Netlify Production cutover and later live proof at the correct shared release gate.

---

## 7. Exact next step

**Do not deploy Netlify Production yet. Do not add another payment provider. Do not implement split payments. Do not change PayPal/V3 code during this next step.**

The exact next step is:

> **Blocker C: perform a targeted read-only legal verification of LegendMural's fixed business model: physical wall stickers sold online, PayPal-only, 100% of the order paid immediately when the order is placed, processing/production only after payment, and delivery later. Determine from current authoritative Dutch/EU sources whether 100% mandatory advance payment is lawful for the actual LegendMural products and whether any relevant exception or product classification applies. If the answer is no, report the exact legal launch conflict to the owner; do not default back to a 50/50 architecture.**

No checkout/payment/V3 code may be changed during this legal-verification step.

---

## 8. Rules for every next website chat

1. Read `docs/READ_ME_FIRST.md`.
2. Read this file.
3. Read `docs/PARALLEL_WORKSTREAM_COORDINATION.md`.
4. Fresh-check current `main` before creating a branch.
5. Use GitHub as source of truth, not old chat history.
6. Work one meaningful website step at a time.
7. Never modify V3-reserved files/responsibilities without explicit coordination.
8. Immediately before merge, re-check whether `main` moved; if so compare/rebase and rerun relevant CI.
9. Never deploy/publish without explicit owner permission for that exact Production step.
10. After each completed website step report: changed files, V3 untouched status, branch + PR, starting `main`, whether `main` moved, tests/CI, updated readiness and exact next step.
