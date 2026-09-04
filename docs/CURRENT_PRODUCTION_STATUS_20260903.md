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

The PayPal-only correction branch was created from fresh `main`:

`1b3b42e3e348d6720157e675a1b7cbb379aaf661`

Branch:

`docs/blocker-c-paypal-only-20260904`

PR #183 previously recorded external after-delivery provider research. That research remains useful background, but its recommendation to pursue Riverty/Mollie is **superseded by the owner's explicit business decision on 4 September 2026: LegendMural remains PayPal-only for now.** Do not treat Mollie, Riverty, Klarna or another payment provider as an approved implementation direction.

At this checkpoint, storefront `main` also contains separate V3 work including PR #182. That V3 work is outside this website track; do not reconstruct or modify its implementation from this handoff.

Recent substantive website merges include:

- PR #172 — production-preview WebKit regression hardening;
- PR #173 — Privacy-audit handoff;
- PR #174 — Privacy/AVG launch wording and contract tests;
- PR #183 — Blocker C read-only checkout/payment-method research handoff, now partially superseded on provider direction by the PayPal-only owner decision above.

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
| Checkout / payment-law presentation | **65%** | Read-only audit complete; PayPal-only Dutch advance-payment solution still unresolved |
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

### Blocker C — checkout/payment-law presentation — AUDIT COMPLETE, PAYPAL-ONLY SOLUTION OPEN

#### Current checkout mapping

The current LegendMural storefront uses a two-stage hosted PayPal journey:

1. the public checkout drawer shows totals and the button **`Continue to payment`**;
2. that button validates the customer/address, creates a hosted PayPal checkout and redirects to PayPal;
3. the PayPal order is created with `intent: CAPTURE` and `user_action: PAY_NOW`;
4. the customer approves the payment on PayPal;
5. after return, the server capture/status flow verifies payment before the order is treated as paid.

Working conclusion: the LegendMural **`Continue to payment`** button is a transition to the payment provider, not the final payment-obligation control. Do not rename it to wording that falsely suggests the consumer is already paying on LegendMural. A controlled PayPal Sandbox proof is still required later to visually confirm the final PayPal control and order-total presentation before launch.

#### Dutch advance-payment blocker

Authoritative ACM guidance currently states that for consumer goods not yet delivered a seller may require at most 50% advance payment, while full advance payment may still be offered voluntarily if the consumer also has a real option to pay at least 50% after delivery.

Source: `https://www.acm.nl/nl/verkoop-aan-consumenten/de-koop-sluiten/betaalmogelijkheden-aanbieden`

The existing PayPal-only launch structure captures the full order amount and therefore does **not** by itself provide the required Dutch after-delivery alternative.

This cannot be solved with checkout copy alone.

#### Canonical owner decision — PayPal only

On 4 September 2026 the owner explicitly confirmed:

> **For now LegendMural focuses only on PayPal.**

Therefore:

- do not implement Mollie;
- do not implement Riverty;
- do not implement Klarna;
- do not introduce another payment provider merely to solve Blocker C;
- previous external-provider research is background only and is not the approved business direction.

The next investigation must stay inside PayPal and determine whether an official PayPal-native flow available to Dutch buyers can satisfy the Dutch advance-payment requirement.

#### Known PayPal limitation requiring fresh research

Prior official PayPal developer research did not list the Netherlands as a Pay Later buyer market. That means PayPal Pay Later cannot currently be assumed to solve the Dutch requirement. This must be fresh-checked against current PayPal documentation before any conclusion or implementation.

If no PayPal-native after-delivery option exists for Dutch buyers, the remaining PayPal-only architecture may require a partial-payment structure, for example no more than 50% at order time with a later PayPal balance payment. That would materially affect payment status, paid-order finalization, invoice timing, reconciliation and potentially the canonical order lifecycle.

Such a solution belongs partly or wholly to the V3 Commerce / Orders / Invoices workstream. The website track must stop before modifying any protected PayPal capture/webhook/finalizer/Profile/invoice/delivery behavior.

A small later website-only improvement remains likely after the payment structure is decided: clearly present the actual PayPal payment arrangement before the consumer leaves LegendMural. Do not implement that wording until the payment structure is proven.

### Blocker D — GPSR / product-safety presentation

Add/confirm centralized public manufacturer/trader identity, postal/electronic contact, sufficient product identification and applicable use/safety information. Implement centrally/template-driven rather than manually editing 111 pages.

### Blocker E — commercial rights/IP owner gate

Before commercial launch, the owner must separately confirm required commercial rights/permissions for designs, portraits, names, trademarks and other protected material. This cannot be proven from repository code.

### Blocker F — final-domain metadata / SEO

Replace remaining preview/GitHub Pages canonical/Open Graph references with correct `https://legendmural.com` handling and verify generated/public metadata.

---

## 6. Exact website release order from here

1. **Blocker C:** read-only PayPal-only feasibility research; if a PayPal-native Dutch solution exists, define the smallest coordinated implementation. If not, stop and coordinate any partial-payment architecture with V3 before code changes.
2. **Blocker D:** centralized GPSR/product-safety presentation.
3. **Blocker F:** `legendmural.com` canonical/Open Graph/SEO cleanup.
4. **Final website audit:** confirm legal/content/UI gates, owner IP gate and relevant CI; coordinate with V3 track and freeze an exact release SHA.
5. **Production only after explicit approval:** controlled Netlify Production cutover and later live proof at the correct shared release gate.

---

## 7. Exact next step

**Do not deploy Netlify Production yet. Do not add Mollie, Riverty, Klarna or another payment provider.**

The exact next website step is:

> **Blocker C, PayPal-only part 2: perform a fresh read-only audit of official PayPal capabilities for Dutch buyers. Determine whether PayPal itself offers a compliant after-delivery or delayed-payment route for the Netherlands. If not, determine at architecture level whether a PayPal-only maximum-50%-at-order + later-balance flow is feasible, and identify the exact V3-owned dependencies before any code change.**

Do not change checkout/payment/V3 code during this research step.

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
