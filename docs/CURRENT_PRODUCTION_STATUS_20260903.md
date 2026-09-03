# LegendMural current production status — launch readiness handoff

**Updated:** 3 September 2026  
**Repository:** `ALKAVisuals/legend-stories-website`  
**Production host:** Netlify  
**Canonical intended public origin:** `https://legendmural.com`

> **START HERE AFTER `docs/READ_ME_FIRST.md`, then read `docs/PARALLEL_WORKSTREAM_COORDINATION.md`.** This is the current operational handoff for the public LegendMural website / launch-readiness workstream.

This document contains no passwords, API keys, database connection strings or customer payloads.

---

## 1. Scope and working method

This track concerns the **public website / launch-readiness** workstream in `ALKAVisuals/legend-stories-website`.

A separate V3 Commerce / Orders / Invoices chat may legitimately modify different server-side areas in the same repository. The mandatory ownership/reserved-path contract is:

```text
docs/PARALLEL_WORKSTREAM_COORDINATION.md
```

Working rules:

1. work one meaningful step at a time;
2. fresh-check exact `main` before every repository mutation or Production action;
3. use a dedicated branch, never direct `main` for website implementation;
4. inspect relevant tests/CI before merge;
5. re-check whether `main` moved before merge;
6. do not bundle V3 backend work into a website PR;
7. if a website task requires a V3-reserved file/responsibility, stop and coordinate first;
8. keep this handoff updated whenever a material website step is completed;
9. do not deploy/publish to Netlify Production without explicit owner approval for that exact release step;
10. do not activate PayPal Live, Production email sending, V3 Profile 1, production migrations or live invoice issuance before their separate gates are reached and explicitly approved.

Do not reconstruct the V3 workstream from this document. Its canonical handoff is in `ALKAVisuals/legendmural-dashboard`.

---

## 2. Fresh repository state and parallel-work checkpoint

Fresh-checked storefront `main` before this handoff branch was created:

```text
c6ee0faf357e4943b4ddc0e92335748c20c00c99
```

That commit is:

```text
Merge PR #164: V3 customer invoice email Slice A
```

Relevant recent state:

- PR #159 closed public-site launch Blocker A for pricing/shipping/delivery-time/returns consistency;
- PR #153 merged the V3 Gate-2 order/invoice foundation;
- PR #161 merged V3 delivery persistence;
- PR #163 merged the deterministic V3 invoice PDF renderer;
- PR #164 merged V3 customer invoice email / Resend Slice A;
- the separate V3 workstream is continuing with Gate-3 Slice B after fresh-checking whatever `main` is current at that time.

Production-safety state remains unchanged:

- production Neon V3 migrations are not applied;
- V3 Profile 1 remains inactive;
- live V3 invoice issuance remains off;
- no live V3 Resend invoice send is authorized;
- PayPal Live is not authorized by this handoff;
- no Netlify Production deploy is authorized by this handoff.

The SHA above is a coordination checkpoint, **not a permanently frozen branch base**. Every new chat must fresh-check `main` again before work.

---

## 3. Public website vs V3 ownership — mandatory

The public website chat may work on:

- storefront UI/UX and mobile/responsive behavior;
- homepage/shop/product-page presentation;
- general content;
- Privacy / Terms / Shipping / Returns;
- AVG/privacy launch-readiness;
- GPSR/product-safety presentation;
- SEO;
- canonical/Open Graph/final-domain metadata;
- other customer-facing launch-readiness work that does not modify V3 commerce/invoice/delivery internals.

The website chat must **not modify V3-reserved responsibilities**, including the following paths, without explicit coordination:

```text
server/invoices/**
server/notifications/**
server/adapters/neon-order-notification-store.mjs
server/adapters/neon-paid-order-finalizer.mjs
server/netlify/paid-order-notification-runtime.mjs
server/api/capture-paypal-order.mjs
server/payments/paypal-webhook-reconciliation.mjs
```

Also reserved to V3 are V3 order/invoice/notification migrations, immutable invoice snapshot logic, official identity allocation, V3 PDF/email delivery semantics, claim/lease/artifact metadata, Profile routing and retry/replay behavior.

If a website task appears to require any reserved area: **stop, identify the exact dependency, and coordinate before changing it.**

Full contract: `docs/PARALLEL_WORKSTREAM_COORDINATION.md`.

---

## 4. Current internal launch-readiness percentages

These percentages are working project estimates, not legal certification.

| Area | Readiness | Current assessment |
|---|---:|---|
| Storefront UI/content core | **96%** | Main shopping experience built and broadly tested |
| Commerce backend / PayPal / Neon pre-production architecture | **95%** | Server-authoritative foundation exists; separate V3 work continues without activating Production |
| Company/legal information pages | **90%** | Strong baseline; final consistency/compliance work remains |
| Privacy / AVG | **80%** | Retention wording/provider wording still needs finalization |
| Cookies / tracking | **90%** | No advertising pixels/behavioural analytics found in tracked storefront code; reassess if trackers are added |
| Returns / statutory withdrawal | **95%** | 14-day right, model form and online withdrawal function exist |
| Checkout / payment-law readiness | **55%** | Technical flow works; payment-obligation/prepayment compliance still needs review |
| Pricing / shipping / commercial-claim consistency | **95%** | Blocker A closed via PR #159 and regression-protected |
| GPSR / product-safety presentation | **40%** | Manufacturer/contact/identification/safety presentation incomplete |
| Final-domain metadata | **50%** | Intended origin known; canonical/OG cleanup remains |
| Netlify Production cutover | **0%** | No current release approved/deployed by this handoff |
| Controlled PayPal Live + email proof | **0%** | Only after Production smoke approval and separate explicit authorization |

**Overall internal public-site launch-readiness estimate: ~80%.**

The gates matter more than the percentage.

---

## 5. Completed website work — do not reopen without regression evidence

### Storefront / mobile / release foundation

- 111-product catalogue and generated product-page architecture;
- central product/variant pricing model;
- central discount and shipping calculation;
- mobile navigation fix;
- real iPhone Safari hamburger confirmation;
- mobile checkout/WebKit regression coverage;
- About page redesign;
- current legal/help page baseline.

### Commerce / payment foundation relevant to website safety

- server-authoritative order totals;
- PayPal-only launch direction;
- Neon order persistence;
- PayPal create/capture/webhook architecture;
- server-authoritative paid status;
- idempotent capture/webhook reconciliation behavior;
- PayPal Sandbox + isolated Neon proofs;
- paid-return browser experience;
- Netlify Functions/routes architecture.

The separate V3 workstream has subsequently added order/invoice/delivery foundations. Public-site work must preserve those invariants and must not modify their reserved code without coordination.

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

Completed public-copy consistency includes:

- obsolete homepage `€49,95` preview prices replaced with current `From €35` presentation;
- obsolete `€49 sticker` claim removed;
- obsolete shop free-shipping threshold `€50` replaced by **€69 after discount**;
- public shipping aligned with **NL €4,95 / EU €9,95 / US €9,95 tracked**, free from €69 after discount;
- obsolete 30-day marketing return claim replaced by statutory 14-day withdrawal summary;
- location-independent `2 to 4 days` / `2 to 4 working days` marketing promises removed;
- regression validation added against stale claims.

### Delivery-time policy — OWNER DECISION

**Do not show a concrete expected delivery time in marketing/storefront copy.** Delivery timing varies by destination and operational circumstances.

The Shipping page may retain the legal fallback that, unless otherwise agreed, consumer goods are delivered without undue delay and no later than 30 days. This is a legal boundary, not a promised delivery estimate or SLA.

---

## 6. Remaining critical public-site launch blockers

### Blocker B — privacy finalization — NEXT

The Privacy page still needs final retention wording/criteria and provider wording reconciled with the actual current Production-target runtime.

In particular:

- replace future/placeholder retention language with actual periods or sufficiently concrete criteria;
- confirm whether Google address/place functionality is actually loaded in the current target runtime;
- remove or update stale provider wording if Google Places is no longer used.

This is the exact next public-website implementation step.

### Blocker C — checkout/payment legal presentation

Still to resolve before Dutch consumer launch:

- map exactly where the consumer becomes legally bound to pay in the current PayPal flow;
- ensure the decisive order/payment control has unambiguous payment-obligation wording where legally required;
- verify the launch payment structure against Dutch consumer rules concerning mandatory advance payment for goods;
- implement only changes proven necessary by that mapping.

**Coordination note:** if this analysis would require changing V3-reserved PayPal capture/webhook/finalizer code, stop and coordinate with the V3 workstream first. Do not solve it by blindly changing backend payment code or button wording.

### Blocker D — GPSR/product-safety information

Before EU launch, add/confirm a centralized product-safety presentation covering applicable manufacturer/trader identity, postal/electronic contact, sufficient product identification and relevant warnings/use/safety information.

Implementation must be centralized/template-driven rather than manually editing 111 generated product pages.

### Blocker E — rights/IP confirmation outside repository code

Before commercial launch, the owner must separately confirm that LegendMural has the required commercial rights/permissions for designs, portraits, names, trademarks and other protected material used.

This remains an explicit business launch gate outside repository code.

### Blocker F — final-domain metadata cleanup

Replace/generate old GitHub Pages canonical/Open Graph URLs for the intended Production origin `https://legendmural.com`.

---

## 7. Exact public-site order from current state to launch

### Phase L2 — privacy + checkout legal finalization

1. finalize Privacy retention periods/criteria;
2. reconcile provider wording with actual runtime;
3. test/review the privacy change;
4. map the PayPal legal commitment/payment-obligation point without modifying V3-reserved code unless coordinated;
5. resolve the Dutch advance-payment/payment-method question;
6. implement only required public-site/checkout changes within the agreed ownership boundary;
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
4. confirm V3/website branches are reconciled and relevant CI green;
5. freeze a new exact release SHA;
6. only then proceed to a separately approved Netlify cutover.

### Phase F — controlled Netlify Production cutover

Only with explicit owner approval for that exact step:

1. capture current live Production deploy/rollback reference if practical;
2. trigger exactly one Production build from the approved frozen `main` SHA;
3. verify build success and deployed content/SHA;
4. perform safe no-charge smoke tests first;
5. stop/rollback on regression.

### Phase G — controlled Live proof

Only after Production smoke approval and separate explicit authorization:

1. activate only the approved live/email settings;
2. perform exactly one controlled PayPal Live order;
3. verify PayPal capture + webhook;
4. verify Neon authoritative `paid`;
5. verify `/api/order-status` authoritative `paid`;
6. verify the expected merchant/customer delivery path;
7. verify no duplicate notifications;
8. verify order/customer/product/shipping/total details;
9. verify funds in the PayPal business account.

Do not assume the final customer-email proof remains identical to older Profile-0 documentation; reconcile with the then-current V3 handoff before live proof.

---

## 8. Netlify / payment safety state

Current Netlify contract remains:

- build: `npm run build && node scripts/generate-commerce-runtime-config.mjs`;
- publish: `dist`;
- functions: `netlify/functions`;
- same-origin routes include `/api/paypal/checkout`, `/api/paypal/capture`, `/api/paypal/webhook`, `/api/order-status`.

PayPal Live remains guarded and must not be enabled early.

`ORDER_EMAILS_ENABLED` must not be enabled merely to test website changes before the controlled final proof.

No Netlify Production deploy is authorized by documentation maintenance or by merging a normal GitHub feature/hand-off PR.

---

## 9. Critical commerce invariants for public-site work

Preserve all of these:

- Neon is authoritative order truth;
- PayPal is payment proof;
- capture and webhook may race/retry safely;
- paid finalization remains idempotent;
- notification/email failure must not regress a persisted paid order;
- browser URL/local/session state cannot manufacture `paid`;
- browser prices/totals are not authoritative;
- immutable V3 invoice truth must not be rebuilt from current catalog/browser data;
- no secrets or customer payloads in docs, commits or client output;
- V3 Profile 1 remains inactive unless separately approved;
- reserved V3 code/semantics are changed only by the coordinated V3 workstream.

---

## 10. Exact next public-website step

**Do not deploy Netlify Production yet.**

Execute only:

> **Blocker B, part 1:** audit and finalize the Privacy page retention wording and reconcile its provider list with the actual current storefront/checkout runtime. No checkout/payment-flow changes and no V3-reserved code changes in this step.

After that:

- run targeted validation and relevant CI;
- update this handoff with the result and percentages;
- then continue to the checkout/payment-law part of Phase L2.

---

## 11. Instructions for every next public-site chat

1. Read `docs/READ_ME_FIRST.md`.
2. Read this file.
3. Read `docs/PARALLEL_WORKSTREAM_COORDINATION.md`.
4. Fresh-check current `main`.
5. Use GitHub as source of truth, not old chat history.
6. Work only on public website / launch-readiness responsibilities.
7. Do not modify V3-reserved files or behaviors without coordination.
8. Use a separate branch.
9. Before merge, re-check whether `main` moved and reconcile if necessary.
10. Report after each step: **done / result / changed files / risks / readiness percentages / exact next step**.
11. Explicitly state whether all V3-reserved files remained untouched.
12. Do not publish/deploy/activate Production without explicit permission.
13. Update this handoff whenever the website state or exact next step materially changes.
