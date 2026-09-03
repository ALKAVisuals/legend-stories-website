# LegendMural current production status — public website launch-readiness

**Updated:** 3 September 2026  
**Repository:** `ALKAVisuals/legend-stories-website`  
**Scope:** public LegendMural storefront / launch-readiness only  
**Production host:** Netlify  
**Canonical intended public origin:** `https://legendmural.com`

> **START HERE AFTER `docs/READ_ME_FIRST.md`.** This is the operational handoff for the public website track only. The separate LegendMural V3 chat owns V3 Commerce / Orders / Invoices backend and delivery work in the same repository.

This document contains no passwords, API keys, database connection strings or customer payloads.

---

## 1. Responsibility boundary

This track may work on:

- storefront UI/UX, homepage, shop and product presentation;
- responsive/mobile improvements;
- general public content;
- Privacy, Terms, Shipping and Returns;
- AVG/privacy launch-readiness;
- GPSR/product-safety presentation;
- SEO, canonical/Open Graph metadata and `legendmural.com` metadata;
- general visual website improvements;
- launch-readiness blockers that do not modify the V3 commerce backend.

The separate V3 chat owns V3 invoice delivery, immutable invoice snapshots, V3 Neon invoice reads, claim-token security, PDF artifacts, V3 notification persistence/delivery/retries, Profile-0/Profile-1 commerce routing and any later V3 production cutover.

### Protected V3/backend surface — do not change in this website track

Without explicit cross-track approval, do not modify:

- `server/invoices/**`;
- `server/notifications/**`;
- `server/adapters/neon-order-notification-store.mjs`;
- V3 invoice/notification Neon adapters;
- paid-order finalizer code;
- PayPal capture/webhook reconciliation code;
- Profile-0/Profile-1 routing;
- V3 invoice snapshot/PDF/Resend/retry code;
- V3 order/invoice/notification migrations.

If a website task appears to require one of those surfaces, stop and report the exact file/dependency before changing it.

---

## 2. Fresh repository checkpoint

Fresh-checked `main` before creating the current website documentation branch:

`c6ee0faf357e4943b4ddc0e92335748c20c00c99`

The website documentation branch was created directly from that exact SHA:

`docs/current-launch-status-20260903`

This SHA is a checkpoint only. Before every new website branch and immediately before every merge, fresh-check `main` again because the V3 track may merge unrelated work in parallel.

Do not reconstruct V3 progress in this file. V3 status belongs to the separate V3 handoff maintained by that track.

---

## 3. Current website launch-readiness

These percentages are internal project-tracking estimates, not legal certification.

| Area | Readiness | Current assessment |
|---|---:|---|
| Storefront UI/content core | **96%** | Main shopping experience built and broadly tested |
| Company/legal information pages | **90%** | Strong baseline; final compliance consistency remains |
| Privacy / AVG | **80%** | Retention/provider wording still needs finalization |
| Cookies / tracking | **90%** | No advertising pixels/behavioural analytics found in the tracked storefront baseline; reassess if trackers are added |
| Returns / statutory withdrawal | **95%** | 14-day right, model form and online withdrawal function exist |
| Checkout / payment-law presentation | **55%** | Consumer-facing commitment/payment-obligation and advance-payment compliance still require review |
| Pricing / shipping / commercial-claim consistency | **95%** | Blocker A closed by PR #159 and protected by validation |
| GPSR / product-safety presentation | **40%** | Manufacturer/contact/identification/safety presentation incomplete |
| Final-domain metadata / SEO | **50%** | Intended domain known; old preview/GitHub Pages metadata still needs cleanup |
| Netlify Production cutover | **0%** | Not part of the current website step |
| Controlled Live proof | **0%** | Only after all launch gates and explicit owner approval |

**Overall public website launch-readiness estimate: ~80%.**

The launch gates matter more than the percentage.

---

## 4. Completed public website work — do not reopen without regression evidence

### Storefront / mobile / content

- 111-product catalogue and generated product-page architecture;
- central public product/variant presentation;
- mobile navigation fix;
- real iPhone Safari hamburger confirmation;
- mobile checkout/WebKit regression coverage;
- About page redesign;
- current Company, Terms, Privacy, Shipping and Returns page baselines.

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

Public pricing, shipping, delivery-time and returns-copy inconsistencies were corrected.

Authoritative public launch rules are:

- Compact: **€35 incl. VAT**;
- Statement: **€45 incl. VAT**;
- `LEGEND10`: 10% discount;
- Netherlands shipping: **€4.95**;
- EU shipping: **€9.95**;
- United States: **€9.95 tracked**;
- free shipping from **€69 after discount**;
- no unsupported fixed `2–4 day` marketing delivery promise;
- no conflicting `30-day return` marketing promise against the statutory withdrawal flow.

Owner policy remains: do not publish a concrete expected delivery time in general storefront marketing copy. The Shipping page may state the legal fallback that, unless otherwise agreed, consumer goods are delivered without undue delay and no later than 30 days.

---

## 5. Remaining public website launch blockers

### Blocker B — Privacy / AVG finalization — EXACT NEXT STEP

The Privacy page still needs a final launch audit focused on:

1. replacing future/placeholder retention wording with accurate concrete periods or sufficiently concrete criteria;
2. reconciling the listed third-party/provider wording with the actual Production-target website/runtime;
3. removing stale provider references where the public website no longer uses the referenced functionality;
4. ensuring the public notice matches the website data actually collected and used.

This step is website/privacy work only. Do not change payment, invoice, notification or V3 backend code while doing it.

### Blocker C — checkout/payment-law presentation

Before Dutch consumer launch:

- map where the consumer becomes legally bound to pay in the current hosted PayPal journey;
- verify that the decisive consumer-facing control has legally sufficient payment-obligation wording where required;
- verify the launch payment structure against Dutch rules concerning advance payment for goods;
- make only public website/checkout presentation changes that are proven necessary.

If the required solution would modify protected PayPal reconciliation, paid-order finalizer, Profile routing or other V3-owned backend code, stop and coordinate first.

### Blocker D — GPSR / product-safety presentation

Before EU launch, add/confirm centralized public product-safety information covering the applicable manufacturer/trader identity, postal/electronic contact, sufficient product identification and relevant warnings/use/safety information.

This should be template/data-driven, not 111 manual product-page edits.

### Blocker E — commercial rights/IP owner gate

Before commercial launch, the owner must separately confirm the required commercial rights/permissions for designs, portraits, names, trademarks and other protected material. This cannot be proven from repository code.

### Blocker F — final-domain metadata / SEO

Replace remaining preview/GitHub Pages canonical/Open Graph references with correct `https://legendmural.com` handling and verify the Production-domain metadata output.

---

## 6. Public website release order

### Phase L2 — privacy first

1. complete Blocker B Privacy/AVG audit;
2. implement only the required public privacy/content changes;
3. run targeted validation and relevant CI;
4. update this handoff;
5. then continue to Blocker C checkout/payment-law presentation.

### Phase L3 — GPSR + metadata

1. complete centralized GPSR/product-safety presentation;
2. complete canonical/OG/SEO Production-domain cleanup;
3. run product-generation/parity and relevant quality checks;
4. update this handoff.

### Phase L4 — final public pre-Production audit

1. fresh-check `main`;
2. confirm all website/legal blockers are closed;
3. confirm the owner IP/rights gate;
4. confirm relevant CI green;
5. coordinate with the V3 track so no parallel backend change is accidentally omitted from release review;
6. freeze an exact approved release SHA.

### Production

No Netlify Production cutover, PayPal Live activation, production email activation, V3 Profile 1 activation or V3 production migration is authorized by this document. Those actions require their own explicit owner approval at the correct gate.

---

## 7. Parallel GitHub working rules

1. Read `docs/READ_ME_FIRST.md` and this file before website work.
2. Fresh-check `main` before every new website branch.
3. Use a website-specific feature branch; never write directly to `main`.
4. Keep PRs limited to public website/launch-readiness scope.
5. Immediately before merge, fresh-check `main` again.
6. If `main` changed due to V3 work, compare/rebase first and rerun relevant CI.
7. Never merge an old V3 branch or V3 PR as part of website work.
8. Never modify the protected V3/backend surface merely to make a website PR convenient.
9. Do not deploy/publish without explicit owner permission for that exact Production step.
10. Never commit secrets or customer payloads.

---

## 8. Required report after every website step

Every completed website step must report:

- what was changed;
- exact files changed;
- whether all V3-owned/protected files remained untouched;
- branch and PR;
- exact `main` SHA used as the starting point;
- whether `main` changed during the work;
- tests/CI result;
- updated readiness and exact next step.

---

## 9. Exact next step

**Do not deploy Netlify Production yet.**

The next implementation step for this website track is exactly:

> **Blocker B, part 1: perform a read-only audit of the current Privacy page and the actual public storefront/runtime provider usage, then define the smallest required Privacy/AVG wording changes.**

Do not change checkout/payment flow, V3 commerce backend, invoice delivery or Production settings in this step.
