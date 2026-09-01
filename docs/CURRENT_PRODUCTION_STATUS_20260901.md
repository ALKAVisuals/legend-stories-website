# LegendMural current production status — launch readiness handoff

**Updated:** 1 September 2026  
**Repository:** `ALKAVisuals/legend-stories-website`  
**Production host:** Netlify  
**Canonical intended public origin:** `https://legendmural.com`

> **START HERE AFTER `docs/READ_ME_FIRST.md`.** This is the current operational handoff for getting the public LegendMural webshop ready for final Production release.

This document contains no passwords, API keys, database connection strings or customer payloads.

---

## 1. Scope and working method

This track concerns only the public LegendMural webshop in:

`ALKAVisuals/legend-stories-website`

Do not switch to the dashboard repository or start unrelated V3 work unless the owner explicitly changes scope.

Working rules:

1. work one meaningful step at a time;
2. fresh-check exact `main` before every repository mutation or Production action;
3. use a branch, never direct `main`;
4. inspect CI before merge;
5. do not bundle unrelated work;
6. do not deploy/publish to Netlify Production without explicit owner approval for the exact release step;
7. do not activate PayPal Live, Production email sending, V3 profile 1, production migrations or invoice issuance before their gate is reached and explicitly approved.

---

## 2. Fresh repository state on 1 September 2026

Fresh-checked `main`:

`39345bba9c1196ea68bad9c2a83f3aed5c1b3d8e`

Commit:

`Merge PR #153: V3 Gate 2 paid-order finalization foundation and readiness`

Important correction to the previous 31 August handoff:

- PR #153 is no longer open; it is merged into `main`;
- the old frozen SHA `d02d7101...` is therefore no longer the current `main`;
- do not deploy the old frozen SHA as if it were still the final candidate;
- a new exact deploy SHA must only be frozen after all remaining launch-readiness fixes are merged.

PR #153 merged the V3 Gate 2 foundation, but its own production-safety state remains:

- production Neon migrations not applied;
- profile 1 inactive by default;
- live invoice issuance off;
- no real seller/tax/legal V3 production values activated;
- no intentional Netlify Production update was part of that merge.

For the public-site release track, preserve this merged code but do not continue V3 implementation unless explicitly requested.

---

## 3. Current internal readiness percentages

These are **working estimates for project tracking**, not a legal certification.

| Area | Readiness | Current assessment |
|---|---:|---|
| Storefront UI/content core | **95%** | Main shopping experience is built and broadly tested |
| Commerce backend / PayPal / Neon pre-production architecture | **95%** | Server-authoritative and extensive sandbox/concurrency coverage exists |
| Company/legal information pages | **90%** | Strong baseline; mostly consistency/finalization work remains |
| Privacy / AVG | **80%** | Good disclosure, but retention wording and stale provider wording need cleanup |
| Cookies / tracking | **90%** | No advertising pixels/behavioural analytics found in tracked storefront code; reassess if trackers are added |
| Returns / statutory withdrawal | **95%** | 14-day right, model form and online withdrawal function exist |
| Checkout / payment-law readiness | **55%** | Flow works technically; final payment-obligation/prepayment compliance needs review/fix |
| Pricing / shipping / commercial-claim consistency | **35%** | Main launch blocker: conflicting public claims still exist |
| GPSR / product-safety presentation | **40%** | Product details exist, but manufacturer/contact/identification/safety presentation is incomplete |
| Netlify Production cutover | **0%** | Final current release has not yet been intentionally deployed and approved |
| One controlled PayPal Live + email proof | **0%** | Must happen only after Production smoke approval |

**Overall internal launch-readiness estimate: ~74%.**

The percentage is secondary to the gates below: the site is not launch-ready until the critical blockers are closed and Production/live proof is complete.

---

## 4. What is already complete / should not be re-investigated without regression evidence

- 111-product catalogue and generated product-page architecture;
- central product/variant pricing model;
- central discount and shipping calculation;
- server-authoritative order totals;
- PayPal-only launch direction;
- Neon order persistence;
- PayPal create/capture/webhook architecture;
- server-authoritative paid status;
- idempotent capture/webhook reconciliation behavior;
- real PayPal Sandbox + isolated Neon proofs from earlier release work;
- paid-return browser experience;
- mobile navigation fix;
- real iPhone Safari hamburger confirmation;
- mobile checkout/WebKit regression coverage;
- About page redesign;
- Company Information page;
- Terms page;
- Privacy page baseline;
- Shipping page baseline;
- Returns page and statutory withdrawal information;
- dedicated `withdraw.html` online withdrawal function;
- Netlify environment variable names reviewed from owner screenshots and actual values owner-confirmed as correct;
- current Netlify runtime routes and Functions architecture;
- V3 Gate 2 merged with profile 1 inactive by default.

Do not reopen solved mobile/payment-environment investigations without new evidence.

---

## 5. Current critical launch blockers

### Blocker A — conflicting pricing, shipping and returns claims

The storefront currently contains public copy that is inconsistent with the intended/authoritative launch rules.

Known examples found in the 1 September audit:

- `shop.html` still contains a **free shipping over €50** claim while the current commerce/shipping rule is **free shipping from €69 after discount**;
- `shop.html` still contains **2 to 4 working days across Europe**, while the current Shipping page deliberately does not promise a fixed delivery estimate;
- `shop.html` still contains a **30 day return window**, while the legal returns flow is built around the statutory 14-day withdrawal right;
- homepage marketing copy also contains **2 to 4 day** delivery claims;
- homepage product cards contain visible **€49,95** prices for products whose current authoritative launch variants are **€35 Compact / €45 Statement**.

This is the first storefront-code correction to perform.

### Blocker B — privacy finalization

The current Privacy page still states that the definitive Production retention schedule is future production-readiness work. That must be finalized before launch.

The Privacy page also mentions Google address/place functionality, while the current checkout implementation uses manual editable address fields. Confirm actual Production behavior and remove/update stale provider wording if Google Places is no longer loaded.

### Blocker C — checkout/payment legal presentation

The checkout technically shows subtotal, discount, shipping and total and routes to hosted PayPal.

Still to close before Dutch consumer launch:

- determine which control is legally the final payment-obligation/order button and make the wording unambiguous where required;
- verify the launch payment structure against Dutch consumer rules concerning mandatory advance payment for goods;
- make any required storefront/payment-flow change before Production release.

Do not solve this by changing button text blindly; first map the exact legal commitment point in the current PayPal flow.

### Blocker D — GPSR/product-safety information

Product pages already show useful characteristics such as product name, image, material, size, removability and Netherlands origin.

Before EU launch, add/confirm a consistent product-safety presentation covering at least the applicable manufacturer/trader identity, postal/electronic contact, sufficient product identification and any relevant warnings/safety/use information.

The implementation should be centralized/template-driven rather than hand-editing 111 generated pages.

### Blocker E — rights/IP confirmation outside repository code

Before commercial launch, the owner must separately confirm that LegendMural has the required rights/permissions for the designs, portraits, names, trademarks and other protected material used commercially.

This cannot be proven from repository code and must remain an explicit owner/business launch gate.

### Blocker F — final-domain metadata cleanup

Many pages still contain GitHub Pages canonical/Open Graph URLs. Before final Production release these should be generated/updated to the intended canonical origin `https://legendmural.com`.

This is mainly SEO/production hygiene, but should be closed before final release.

---

## 6. Exact order from current state to launch

### Phase L1 — commercial-copy consistency

1. correct visible price inconsistencies;
2. correct free-shipping threshold copy to €69 after discount;
3. remove unsupported 2–4 day delivery promises unless an approved operational SLA exists;
4. remove/replace the conflicting 30-day return claim;
5. ensure homepage, shop, product pages, cart/checkout, Shipping, Returns and Terms tell one consistent story;
6. run targeted tests + full quality/CI;
7. review before merge.

### Phase L2 — privacy + checkout legal finalization

1. set the definitive retention schedule/criteria in the Privacy notice;
2. reconcile provider wording with actual Production runtime;
3. map the PayPal legal commitment/payment-obligation point;
4. resolve the Dutch advance-payment/payment-method question;
5. implement any required checkout copy/flow changes;
6. test and review.

### Phase L3 — GPSR + final-domain cleanup

1. define centralized product-safety/manufacturer metadata;
2. render it consistently on product offers/pages;
3. add relevant use/safety warnings where applicable;
4. update canonical/OG Production origin handling to `legendmural.com`;
5. run generator parity, product-page validation and full CI.

### Phase L4 — final pre-Production audit

1. fresh-check `main`;
2. confirm all critical legal/commercial blockers closed;
3. confirm owner IP/rights gate;
4. confirm relevant CI green;
5. freeze the **new exact release SHA**;
6. only then proceed to the Netlify cutover.

### Phase F — controlled Netlify Production cutover

1. capture current live Production deploy/rollback reference if practical;
2. trigger exactly one Production build from the approved `main` SHA;
3. verify build success and deployed content/SHA;
4. perform safe smoke tests without a real payment first;
5. stop and rollback if a regression appears.

Production smoke tests must cover at least homepage/navigation, About, shop/product/cart, checkout/address input, success/cancel routes, Functions, same-origin API routing and safe Neon/order-status connectivity.

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

Only after this is the current paid-order path proven in Production.

---

## 7. Netlify / payment safety state

Current `netlify.toml` contract:

- build: `npm run build && node scripts/generate-commerce-runtime-config.mjs`;
- publish: `dist`;
- functions: `netlify/functions`;
- same-origin routes include `/api/paypal/checkout`, `/api/paypal/capture`, `/api/paypal/webhook`, `/api/order-status`.

Netlify Production environment values were owner-confirmed on 31 August 2026. Do not ask the owner to expose secret values again without new failure evidence.

PayPal Live remains guarded and must not be enabled early.

`ORDER_EMAILS_ENABLED` must not be turned on merely to test the website before the controlled final proof.

---

## 8. Critical commerce invariants to preserve during legal/content fixes

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

The exact next implementation step is:

> Create a focused storefront branch/PR that fixes only the known inconsistent public pricing, shipping, delivery and returns claims (Blocker A), without changing payment architecture, V3 activation or Production configuration.

After that step:

- run targeted/source checks and the relevant full CI;
- report exactly what changed;
- update the readiness percentages;
- merge only with owner approval;
- then continue to Phase L2.

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
