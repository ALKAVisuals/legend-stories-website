# LegendMural current production status — launch readiness handoff

**Updated:** 1 September 2026  
**Repository:** `ALKAVisuals/legend-stories-website`  
**Production host:** Netlify  
**Canonical intended public origin:** `https://legendmural.com`

> **START HERE AFTER `docs/READ_ME_FIRST.md`.** This is the current operational handoff for getting the public LegendMural webshop ready for final Production release.

This document contains no passwords, API keys, database connection strings or customer payloads.

---

## 1. Scope and working method

This track concerns only the public LegendMural webshop in `ALKAVisuals/legend-stories-website`.

Working rules:

1. work one meaningful step at a time;
2. fresh-check exact `main` before every repository mutation or Production action;
3. use a branch, never direct `main`;
4. inspect CI before merge;
5. do not bundle unrelated work;
6. keep this handoff updated whenever a material step is completed;
7. do not deploy/publish to Netlify Production without explicit owner approval for the exact release step;
8. do not activate PayPal Live, Production email sending, V3 profile 1, production migrations or invoice issuance before their gate is reached and explicitly approved.

Do not switch to the dashboard repository or unrelated V3 work unless the owner explicitly changes scope.

---

## 2. Fresh repository state

Fresh-checked `main` before this documentation update:

`665464134f16dac688ae2013d94d8b448910462d`

Commit:

`Merge pull request #159 from ALKAVisuals/fix/launch-copy-consistency-20260901`

PR #159 closed launch Blocker A: public pricing, shipping, delivery-time and returns-copy consistency.

PR #153 (V3 Gate 2) is also already merged into `main`, but its production-safety state remains unchanged:

- production Neon migrations are not applied;
- V3 profile 1 remains inactive by default;
- live invoice issuance remains off;
- no real V3 seller/tax/legal Production activation is implied;
- no intentional Netlify Production update was part of either PR #153 or PR #159.

Do not freeze a final deploy SHA yet. A new exact release SHA is frozen only after all remaining launch-readiness blockers are closed.

---

## 3. Current internal readiness percentages

These percentages are working project estimates, not legal certification.

| Area | Readiness | Current assessment |
|---|---:|---|
| Storefront UI/content core | **96%** | Main shopping experience built and broadly tested |
| Commerce backend / PayPal / Neon pre-production architecture | **95%** | Server-authoritative with extensive sandbox/concurrency coverage |
| Company/legal information pages | **90%** | Strong baseline; final consistency/compliance work remains |
| Privacy / AVG | **80%** | Good disclosure; retention wording/provider wording still needs finalization |
| Cookies / tracking | **90%** | No advertising pixels/behavioural analytics found in tracked storefront code; reassess if trackers are added |
| Returns / statutory withdrawal | **95%** | 14-day right, model form and online withdrawal function exist |
| Checkout / payment-law readiness | **55%** | Technical flow works; payment-obligation/prepayment compliance still needs review |
| Pricing / shipping / commercial-claim consistency | **95%** | Blocker A closed by PR #159 and protected by regression validation |
| GPSR / product-safety presentation | **40%** | Product basics exist; manufacturer/contact/identification/safety presentation incomplete |
| Final-domain metadata | **50%** | Intended origin known; old GitHub Pages canonical/OG metadata still needs cleanup |
| Netlify Production cutover | **0%** | Current release not intentionally deployed/approved yet |
| Controlled PayPal Live + email proof | **0%** | Only after Production smoke approval |

**Overall internal launch-readiness estimate: ~80%.**

The gates matter more than the percentage. The site is not launch-ready until all critical blockers and the Production/live proof are complete.

---

## 4. Completed work — do not reopen without regression evidence

### Storefront / mobile / release foundation

- 111-product catalogue and generated product-page architecture;
- central product/variant pricing model;
- central discount and shipping calculation;
- mobile navigation fix;
- real iPhone Safari hamburger confirmation;
- mobile checkout/WebKit regression coverage;
- About page redesign;
- current legal/help page baseline.

### Commerce / payment architecture

- server-authoritative order totals;
- PayPal-only launch direction;
- Neon order persistence;
- PayPal create/capture/webhook architecture;
- server-authoritative paid status;
- idempotent capture/webhook reconciliation behavior;
- real PayPal Sandbox + isolated Neon proofs;
- paid-return browser experience;
- Netlify Functions/routes architecture;
- Netlify environment-variable names reviewed from owner screenshots and actual values owner-confirmed as correct.

Do not ask the owner to re-expose secret environment values without new failure evidence.

### Legal / consumer baseline

- Company Information page;
- Terms page;
- Privacy page baseline;
- Shipping page baseline;
- Returns page;
- statutory 14-day withdrawal information;
- model withdrawal form;
- dedicated `withdraw.html` online withdrawal function.

### Blocker A — COMPLETE via PR #159

PR #159 corrected public commercial-copy inconsistencies without touching payment architecture, V3 activation or Production configuration.

Completed changes include:

- obsolete homepage `€49,95` preview prices replaced with current `From €35` presentation;
- obsolete `€49 sticker` claim removed;
- obsolete shop free-shipping threshold `€50` replaced by **€69 after discount**;
- public shipping presentation aligned with **NL €4,95 / EU €9,95 / US €9,95 tracked**, with free shipping from €69 after discount;
- obsolete 30-day marketing return claim replaced by the statutory 14-day withdrawal summary;
- all location-independent marketing delivery-time promises such as `2 to 4 days` / `2 to 4 working days` removed from public build output;
- regression validation added so stale fixed delivery ranges, obsolete €50 threshold, 30-day marketing return claim and obsolete homepage €49/€49,95 claims fail validation.

### Delivery-time policy — OWNER DECISION

**Do not show a concrete expected delivery time anywhere in marketing/storefront copy.** Delivery timing varies by destination and operational circumstances.

The Shipping page may retain the legal fallback that, unless otherwise agreed, consumer goods are delivered without undue delay and no later than 30 days. This is a legal boundary, not a promised delivery estimate or SLA.

Do not reintroduce `2–4 days`, `2–4 working days` or another fixed delivery estimate unless the owner explicitly changes this policy.

---

## 5. Remaining critical launch blockers

### Blocker B — privacy finalization — NEXT

The Privacy page still says the definitive Production retention schedule is future production-readiness work. This must be replaced by actual retention periods or sufficiently concrete retention criteria before launch.

The Privacy page also mentions Google address/place functionality while the current checkout uses manual editable address fields. Confirm the actual current Production-target runtime and remove/update stale Google provider wording if Google Places is no longer loaded.

This is the exact next implementation step.

### Blocker C — checkout/payment legal presentation

The checkout shows subtotal, discount, shipping and total and routes to hosted PayPal.

Still to resolve before Dutch consumer launch:

- map exactly where the consumer becomes legally bound to pay in the current PayPal flow;
- ensure the decisive order/payment control has unambiguous payment-obligation wording where legally required;
- verify the launch payment structure against Dutch consumer rules concerning mandatory advance payment for goods;
- implement only the changes proven necessary by that mapping.

Do not solve this by blindly renaming a button.

### Blocker D — GPSR/product-safety information

Before EU launch, add/confirm a centralized product-safety presentation covering at least applicable manufacturer/trader identity, postal/electronic contact, sufficient product identification and relevant warnings/use/safety information.

Implementation must be centralized/template-driven rather than manually editing 111 generated product pages.

### Blocker E — rights/IP confirmation outside repository code

Before commercial launch, the owner must separately confirm that LegendMural has the required commercial rights/permissions for designs, portraits, names, trademarks and other protected material used.

This cannot be proven from repository code and remains an explicit business launch gate.

### Blocker F — final-domain metadata cleanup

Old GitHub Pages canonical/Open Graph URLs still need to be replaced/generated for the intended Production origin `https://legendmural.com`.

This is mainly SEO/Production hygiene but must be closed before final release.

---

## 6. Exact order from current state to launch

### Phase L2 — privacy + checkout legal finalization

1. finalize Privacy retention periods/criteria;
2. reconcile provider wording with the actual current runtime;
3. test/review the privacy change;
4. then map the PayPal legal commitment/payment-obligation point;
5. resolve the Dutch advance-payment/payment-method question;
6. implement any required checkout copy/flow changes;
7. run targeted tests + full relevant CI.

### Phase L3 — GPSR + final-domain cleanup

1. define centralized product-safety/manufacturer metadata;
2. render it consistently on product offers/pages;
3. add relevant use/safety warnings where applicable;
4. update canonical/OG Production-origin handling to `legendmural.com`;
5. run generator parity, product-page validation and full CI.

### Phase L4 — final pre-Production audit

1. fresh-check `main`;
2. confirm all critical legal/commercial blockers closed;
3. confirm owner IP/rights gate;
4. confirm relevant CI green;
5. freeze the new exact release SHA;
6. only then proceed to the Netlify cutover.

### Phase F — controlled Netlify Production cutover

1. capture current live Production deploy/rollback reference if practical;
2. trigger exactly one Production build from the approved `main` SHA;
3. verify build success and deployed content/SHA;
4. perform safe smoke tests without a real payment first;
5. stop and rollback if a regression appears.

### Phase G — controlled Live proof

Only after Production smoke approval:

1. activate the explicitly required Production live/email settings at the approved proof point;
2. perform exactly one controlled PayPal Live order;
3. verify PayPal capture + webhook;
4. verify Neon authoritative `paid`;
5. verify `/api/order-status` authoritative `paid`;
6. verify exactly one merchant email;
7. verify exactly one customer email;
8. verify no duplicate notifications;
9. verify order/customer/product/shipping/total details;
10. verify funds in the PayPal business account.

---

## 7. Netlify / payment safety state

Current Netlify contract remains:

- build: `npm run build && node scripts/generate-commerce-runtime-config.mjs`;
- publish: `dist`;
- functions: `netlify/functions`;
- same-origin routes include `/api/paypal/checkout`, `/api/paypal/capture`, `/api/paypal/webhook`, `/api/order-status`.

Netlify Production environment values were owner-confirmed on 31 August 2026. Do not reopen value-by-value inspection without new failure evidence.

PayPal Live remains guarded and must not be enabled early.

`ORDER_EMAILS_ENABLED` must not be enabled merely to test the website before the controlled final proof.

---

## 8. Critical commerce invariants

Preserve all of these during compliance/content work:

- Neon is authoritative order truth;
- PayPal is payment proof;
- capture and webhook may race/retry safely;
- finalization remains idempotent;
- notification/email failure must not regress a persisted paid order;
- browser URL/local/session state cannot manufacture `paid`;
- browser prices/totals are not authoritative;
- no secrets or customer payloads in docs, commits or client output;
- V3 profile 1 remains inactive unless separately approved.

---

## 9. Exact next step

**Do not deploy Netlify Production yet.**

The exact next implementation step is now:

> **Blocker B, part 1:** audit and finalize the Privacy page retention wording and reconcile its provider list with the actual current storefront/checkout runtime. No checkout/payment-flow changes in this step.

After that step:

- run targeted validation and relevant CI;
- update this handoff with the result and percentages;
- then continue to the checkout/payment-law part of Phase L2.

---

## 10. Instructions for every next chat

1. Read `docs/READ_ME_FIRST.md`.
2. Read this file.
3. Fresh-check current `main`.
4. Use GitHub as source of truth, not old chat history.
5. Work only on the public website unless the owner changes scope.
6. Work one meaningful step at a time.
7. Report after each step: **done / result / risks / readiness percentages / exact next step**.
8. Do not publish or deploy without explicit permission.
9. Update this handoff whenever the state or exact next step materially changes.
