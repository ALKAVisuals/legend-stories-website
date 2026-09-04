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

The Blocker-C legal-verification handoff branch was created from fresh `main`:

`990b2b77b136d20fb350f8bc376a4669611e22d4`

Branch:

`docs/blocker-c-100-upfront-legal-verification-20260904`

Canonical owner payment decision remains:

> **LegendMural is PayPal-only for now. A customer places an order, pays 100% immediately through PayPal, and only after verified full payment does LegendMural process/produce and later deliver the order.**

The owner explicitly rejected split payments, deposits, a later balance and additional payment providers. Do not revive those directions unless the owner explicitly reverses that decision in the future.

At this checkpoint, storefront `main` also contains separate V3 work. That V3 work is outside this website track; do not reconstruct or modify its implementation from this handoff.

Recent substantive website merges include:

- PR #172 — production-preview WebKit regression hardening;
- PR #173 — Privacy-audit handoff;
- PR #174 — Privacy/AVG launch wording and contract tests;
- PR #183 — Blocker C payment-method research handoff;
- PR #184 — canonical PayPal-only owner direction;
- PR #185 — historical PayPal feasibility research;
- PR #186 — removed the split-payment direction and made 100% upfront PayPal-only canonical.

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
| Checkout / payment-law presentation | **68%** | Legal verification complete; mandatory 100% upfront remains an unresolved Dutch consumer launch conflict |
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

### Blocker C — checkout/payment-law presentation — LEGAL VERIFICATION COMPLETE, OWNER/LEGAL GATE OPEN

#### Current checkout mapping

The current LegendMural storefront uses a two-stage hosted PayPal journey:

1. the public checkout drawer shows totals and the button **`Continue to payment`**;
2. that button validates customer/address details, creates a hosted PayPal checkout and redirects to PayPal;
3. the PayPal order is created with `intent: CAPTURE` and `user_action: PAY_NOW`;
4. the customer approves the full payment on PayPal;
5. after return, server-side capture/status logic verifies full payment before the order is treated as paid.

Working conclusion remains: LegendMural's **`Continue to payment`** button is a transition to the payment provider, not the final payment-obligation control. Do not rename it to wording that falsely suggests payment already occurs on LegendMural. A controlled PayPal Sandbox proof is still required later to visually confirm the final PayPal control and final-order-total presentation before launch.

#### Canonical owner payment model — fixed

- PayPal is the only payment provider for now;
- customer pays **100% of the order total when placing the order**;
- processing/production starts only after verified full payment;
- delivery happens later;
- no split payment, deposit or later balance;
- no Mollie, Riverty, Klarna or another payment provider merely to solve Blocker C;
- do not redesign V3 for split-payment states.

The current technical payment architecture already matches this owner intent.

#### Targeted Dutch legal verification — 4 September 2026

The read-only legal verification used current ACM/ConsuWijzer guidance and the relevant Civil Code provisions.

Authoritative/current sources used:

- ACM, **Betaalmogelijkheden aanbieden**: `https://www.acm.nl/nl/verkoop-aan-consumenten/de-koop-sluiten/betaalmogelijkheden-aanbieden`
- ACM ConsuWijzer, **Wat zijn mijn rechten bij een aanbetaling?**: `https://consument.acm.nl/rekeningen-en-incassoprocedures/wat-zijn-mijn-rechten-bij-een-aanbetaling`
- Burgerlijk Wetboek Boek 7, Article 26: `https://wetten.overheid.nl/BWBR0005290/`
- Burgerlijk Wetboek Boek 7, Articles 5 and 6: `https://wetten.overheid.nl/BWBR0005290/`
- Burgerlijk Wetboek Boek 6, Article 230p: `https://wetten.overheid.nl/BWBR0005289/`

Findings:

1. **The current LegendMural catalogue is a consumer-goods sale.** The tracked catalogue contains 111 physical wall stickers with two predefined variants, Compact (30 cm longest side) and Statement (45 cm longest side). A consumer chooses from predefined catalogue designs and predefined sizes.
2. **Article 7:26(2) BW is directly relevant.** It states that payment is due at delivery and that, in a consumer sale, the buyer can be required to prepay at most half of the purchase price.
3. **Current ACM business guidance is explicit for webshops.** A seller may offer payment of the whole amount in advance, but must also give the customer a real possibility to pay at least 50% after delivery. A standard checkout in which 100% prepayment is the only route does not satisfy that ACM guidance.
4. **An individual consumer may voluntarily agree to more than 50% in a genuinely agreed individual arrangement.** ConsuWijzer notes that this can be agreed where the consumer voluntarily accepts it. Article 7:6(2) BW also treats standard-terms clauses that deviate from Article 26 to the consumer's disadvantage as unreasonably onerous. This does not provide a safe basis for treating LegendMural's standard non-negotiated 100%-only webshop checkout as compliant.
5. **Producing the sticker only after payment does not remove the consumer-sale classification.** Article 7:5 BW expressly covers relevant consumer transactions where the movable item still has to be made. “Made after ordering” therefore does not itself create an advance-payment exception.
6. **The ordinary catalogue products are not made-to-specification merely because the customer chooses Compact or Statement.** The sizes and designs are predefined by LegendMural. The repository already distinguishes standard catalogue products from truly custom/personalised work.
7. **The personalised-goods rule does not solve the advance-payment issue.** Article 6:230p BW contains an exception from the statutory distance-selling withdrawal right for genuinely personalised / made-to-consumer-specification goods. That exception concerns withdrawal. No corresponding personalised-goods exception was found in Article 7:26 for mandatory advance payment.
8. **Even a truly personalised future LegendMural order should not automatically be treated as exempt from the 50% advance-payment rule.** Such an order may have a different withdrawal-right position and may be separately negotiated, but personalization itself is not a statutory Article-7:26 exemption.

#### Legal conclusion for the fixed business model

For **standard Dutch consumer orders through the current LegendMural catalogue**, the available authoritative sources do **not** support closing Blocker C while 100% advance payment through PayPal is mandatory and no after-delivery payment route exists.

This is a launch-readiness conclusion, not a court judgment or formal legal opinion. Because the owner has fixed the business model at 100% upfront PayPal-only and explicitly rejected split payments/additional providers, the website track must **not invent a technical workaround**.

Blocker C is therefore explicitly **parked but not closed**. Before a Dutch consumer Production launch under the unchanged model, obtain a specific Dutch consumer-law opinion if the owner wants to rely on a legal interpretation that permits the 100%-only checkout. If that external opinion does not establish a lawful basis, the commercial payment model itself remains the launch conflict.

Do not change checkout, PayPal or V3 code merely to hide or word around this conflict. Copy cannot override the payment rule.

#### Superseded directions — do not revive

The following are not part of the current LegendMural roadmap:

- 50/50 payments;
- deposit + later balance;
- second PayPal payment after delivery;
- PayPal Facturering/Invoicing for a later balance;
- V3 split-payment states;
- Mollie, Riverty, Klarna or another provider as an automatic Blocker-C fix.

### Blocker D — GPSR / product-safety presentation

Add/confirm centralized public manufacturer/trader identity, postal/electronic contact, sufficient product identification and applicable use/safety information. Implement centrally/template-driven rather than manually editing 111 pages.

### Blocker E — commercial rights/IP owner gate

Before commercial launch, the owner must separately confirm required commercial rights/permissions for designs, portraits, names, trademarks and other protected material. This cannot be proven from repository code.

### Blocker F — final-domain metadata / SEO

Replace remaining preview/GitHub Pages canonical/Open Graph references with correct `https://legendmural.com` handling and verify generated/public metadata.

---

## 6. Exact website release order from here

1. **Blocker C remains an explicit launch gate:** 100% upfront PayPal-only is the fixed owner model, but the current Dutch legal verification does not establish that a mandatory 100%-only checkout is compliant for standard Dutch consumer orders. Park this gate pending a specific Dutch consumer-law opinion or an explicit future owner change in commercial model. Do not introduce split payments or another provider from this track.
2. **Blocker D:** continue website work with centralized GPSR/product-safety presentation while Blocker C is parked; this does not mean Blocker C is closed.
3. **Blocker F:** `legendmural.com` canonical/Open Graph/SEO cleanup.
4. **Final website audit:** confirm legal/content/UI gates, owner IP gate and relevant CI; Blocker C must still be resolved before Dutch consumer Production launch.
5. **Production only after explicit approval:** controlled Netlify Production cutover and later live proof at the correct shared release gate.

---

## 7. Exact next step

**Do not deploy Netlify Production. Do not change the fixed PayPal-only/full-prepayment flow. Do not implement split payments. Do not modify V3 payment/finalization code.**

Blocker C's targeted legal verification is complete and the unresolved conflict is now documented. It is explicitly parked pending external Dutch legal confirmation or a future owner business decision.

The exact next website step is:

> **Blocker D, part 1: perform a read-only GPSR/product-safety audit of the actual LegendMural wall-sticker catalogue and current public product presentation. Determine the correct manufacturer/economic-operator identity, product-identification information and only those safety/use warnings that are supported by the actual product/material/production facts. Do not invent warnings and do not edit 111 pages manually. Produce a centralized/template-driven implementation plan before changing product pages.**

No Production deployment is authorized by this handoff.

---

## 8. Rules for every next website chat

1. Read `docs/READ_ME_FIRST.md`.
2. Read this file.
3. Read `docs/PARALLEL_WORKSTREAM_COORDINATION.md`.
4. Fresh-check current `main` before creating a branch.
5. Use GitHub as source of truth, not old chat history.
6. Work one meaningful website step at a time.
7. Never modify V3-reserved files/responsibilities without explicit coordination.
8. Immediately before merge, re-check whether `main` moved; if so compare/rebase/update and rerun relevant CI.
9. Never deploy/publish without explicit owner permission for that exact Production step.
10. After each completed website step report: changed files, V3 untouched status, branch + PR, starting `main`, whether `main` moved, tests/CI, updated readiness and exact next step.
