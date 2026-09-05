# LegendMural public website — next-chat handoff

**Date:** 5 September 2026  
**Repository:** `ALKAVisuals/legend-stories-website`  
**Scope:** public storefront / website launch-readiness only  
**Production host:** Netlify  
**Canonical intended public origin:** `https://legendmural.com`

> This is the newest public-website continuation checkpoint. A new website chat should read `docs/READ_ME_FIRST.md`, then this file, then `docs/CURRENT_PRODUCTION_STATUS_20260903.md`, `docs/FINAL_PRE_RELEASE_CHECKLIST_20260904.md` and `docs/PARALLEL_WORKSTREAM_COORDINATION.md`.

GitHub is the source of truth. Do not reconstruct current website progress from old chats.

---

## 1. Repository checkpoint

Fresh `main` at the start of this handoff:

`94a662efa93a3f3c2a6ac80c4a2959c6ba53e67e`

That current `main` includes separate V3 work through **PR #197 — V3 dashboard invoice support API**. That V3 work is outside the public-website track. Do not modify or reinterpret it from this handoff.

Latest substantive public-website merge:

- **PR #194 — tracked-source commercial cleanup**
- website merge commit: `66277015b5bb34fc8655641e47431ce6fcb2ea2d`

No Netlify Production deployment, PayPal Live activation, Production email activation, V3 Production migration, Profile 1 activation or real live payment/email proof has been authorized from the website track.

Always fresh-check `main` before a new branch and immediately before merge because the V3 track shares this repository and may move `main` in parallel.

---

## 2. What is already complete — do not redo without regression evidence

### Storefront / catalogue / commercial source

- 111-product catalogue and managed product-page architecture are in place.
- Compact is **30 cm longest side / €35 incl. VAT**.
- Statement is **45 cm longest side / €45 incl. VAT**.
- `LEGEND10` is 10% off.
- NL shipping is €4.95.
- EU shipping is €9.95.
- US shipping is €9.95 tracked.
- Free shipping starts at **€69 after discount**.
- No fixed `2–4 day` marketing delivery promise remains in tracked homepage/shop source.
- No conflicting `30 day return window` promise remains in tracked homepage/shop source.
- `index.html` and `shop.html` now use canonical 30/45-cm source identities instead of old 50-cm data attributes.
- Legacy 50-cm aliases remain only in the commerce runtime for backwards compatibility.
- `tests/tracked-source-commercial-contract.test.mjs` protects this source contract.

### Privacy / legal-information baseline

- Privacy/AVG audit and public wording implementation are complete to the current planned baseline.
- Company Information, Terms, Shipping, Returns and Privacy pages exist.
- Returns explains the 14-day statutory withdrawal right for standard catalogue purchases.
- `withdraw.html` provides a dedicated online withdrawal function.
- Functional browser storage and relevant providers are documented.
- No advertising pixels or behavioural analytics were found in the audited tracked baseline.

### GPSR part 2A

All 111 managed product pages centrally expose:

- unique `LM-2026-xxxxx` Product ID;
- manufacturer identity: **Alka Group, trading through LegendMural**;
- Dutch manufacturer postal address;
- manufacturer electronic contact;
- equivalent Product/manufacturer identity in Product JSON-LD.

Do not manually edit 111 product pages; use the managed template/generator architecture.

### Final-domain / SEO source

Tracked website metadata is normalized to `https://legendmural.com`:

- canonical URLs;
- Open Graph URLs and absolute social media URLs;
- homepage apex canonical;
- all 111 catalogue canonicals;
- `sitemap.xml`;
- `robots.txt`.

Live-domain proof still waits for an authorized Production cutover.

### Browser / CI baseline

Recent website work has passed the normal gates, including:

- Quality checks;
- Accessibility and purchase-flow audit;
- Mobile WebKit checkout regression;
- managed product-page/catalog validation;
- production build validation.

PR #194 passed Quality, Accessibility/purchase-flow and Mobile WebKit before merge.

---

## 3. Current readiness estimate

These are internal tracking estimates, not legal certification.

| Area | Readiness | Status |
|---|---:|---|
| Storefront UI/content core | **97%** | Main storefront built/tested; tracked commercial source normalized |
| Company/legal information pages | **92%** | Strong baseline; final live consistency check later |
| Privacy / AVG | **95%** | Audit/implementation complete to current baseline |
| Cookies / tracking | **90%** | Functional storage documented; no behavioural trackers found in audited baseline |
| Returns / statutory withdrawal | **95%** | 14-day right + model/online withdrawal flow present |
| Checkout / payment-law presentation | **68%** | Technical flow works; Dutch 100%-upfront legal gate remains open |
| Pricing / shipping / commercial consistency | **100%** | Source/runtime/build aligned; live proof later |
| GPSR / product-safety presentation | **65%** | Part 2A complete; part 2B intentionally deferred |
| Final-domain metadata / SEO | **90%** | Source/build ready; live-domain proof later |
| Netlify Production cutover | **0%** | Not authorized |
| Controlled Live proof | **0%** | Gated until later explicit release approval |

**Overall public website launch-readiness estimate: ~88%.**

The remaining release gates matter more than the average percentage.

---

## 4. Open / parked launch gates

### Blocker C — Dutch consumer 100%-upfront payment legal gate — OPEN / PARKED

Canonical owner decision remains:

- PayPal only for now;
- customer pays **100% immediately when the order is placed**;
- processing/production starts only after verified full payment;
- delivery happens later;
- no 50/50 split;
- no deposit + later balance;
- no second PayPal invoice/balance payment;
- do not introduce another payment provider merely to solve this gate.

Targeted legal research already concluded that current Dutch consumer guidance does not provide a basis for declaring mandatory 100% advance payment on the standard physical catalogue cleared for Dutch consumer launch.

**Do not redesign payment/V3 code from this website track.** If the unchanged model is to launch to Dutch consumers, this gate needs a specific Dutch consumer-law basis/opinion or a later explicit owner commercial-model change.

### Blocker D part 2B — GPSR material/product-safety completion — DEFERRED BY OWNER

Part 2A is complete. The remaining facts are not currently available:

- exact self-adhesive vinyl/media;
- exact ink family/cartridge;
- laminate/coating status;
- final consumer packaging/physical marking method.

Owner explicitly chose to **skip this for now and continue**. Do not repeatedly ask for these facts in the next chat unless the owner says they are now available.

This does **not** mean the GPSR gate is closed. Before commercial release it still needs to be resumed so material-supported use/safety wording and physical traceability marking can be finalized.

Do not invent warnings or material claims.

### Blocker E — commercial rights / IP owner gate — OPEN

Before commercial launch, the owner must confirm the required commercial rights/permissions for the designs, portraits, names, trademarks and other protected material offered for sale.

Repository tests cannot prove this gate.

**This is the clearest next website checkpoint because the remaining tracked-source cleanup is complete and Blocker D part 2B is intentionally deferred.**

### Production authorization — NOT GIVEN

Do not deploy Netlify Production yet.

Do not activate PayPal Live, Production email sending, V3 Profile 1, Production migrations, live invoices or real Production payment/email proof from this website track.

---

## 5. Exact next step for the next website chat

There is currently **no further independently identified storefront source-cleanup task** after PR #194.

The next website chat should therefore begin with:

> **Blocker E owner/IP launch-gate review.** Establish a simple, auditable rights-status overview for the commercial catalogue/design sources and obtain only the owner confirmations needed to distinguish original/owned work, licensed/permission-based work and any item whose commercial rights still need verification. Do not pretend repository code proves rights, and do not alter product designs merely to close a documentation gate.

After Blocker E is clarified, reassess the release gates:

1. Blocker C remains external legal/owner gating for the unchanged Dutch 100%-upfront PayPal model.
2. Blocker D part 2B remains deferred until the real production/material/packaging facts exist.
3. Production remains prohibited until the required gates are resolved and the owner explicitly approves the exact Netlify Production cutover.

Do **not** invent another technical cleanup simply to keep coding when the remaining blocker is an owner/legal/product decision.

---

## 6. Production-only checks — later, not now

Only after the required launch gates are resolved and the owner explicitly authorizes Netlify Production:

- verify `legendmural.com` DNS/TLS and apex/www redirects;
- verify live canonical/Open Graph metadata, sitemap and robots;
- smoke-test homepage, shop, collections, representative product pages and legal routes;
- verify mobile navigation/cart/30-45 cm variants/LEGEND10/shipping/free-shipping behavior live;
- test the contact form against the actual Production environment;
- only execute real PayPal/order/invoice/email proof under the separately authorized shared V3 release plan.

See `docs/FINAL_PRE_RELEASE_CHECKLIST_20260904.md` for the full live-only checklist.

---

## 7. Mandatory workstream boundary

The website chat must not modify V3-reserved files/responsibilities without explicit coordination, including:

```text
server/invoices/**
server/notifications/**
server/adapters/neon-order-notification-store.mjs
server/adapters/neon-paid-order-finalizer.mjs
server/netlify/paid-order-notification-runtime.mjs
server/api/capture-paypal-order.mjs
server/payments/paypal-webhook-reconciliation.mjs
```

Also reserved to V3: invoice/order numbering, immutable invoice snapshots, V3 migrations, PDF/email delivery, claim-token/lease/artifact logic, Profile-0/Profile-1 routing and retry/reconciliation semantics.

Read `docs/PARALLEL_WORKSTREAM_COORDINATION.md` before changing the repository.

---

## 8. Required reporting after every website step

Always report:

- exact files changed;
- whether V3-protected files remained untouched;
- branch + PR;
- starting `main` SHA;
- whether `main` changed during work;
- tests/CI;
- updated readiness;
- exact next website step.

Never commit or request secrets.