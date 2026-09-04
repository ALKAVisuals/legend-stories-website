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

This Blocker-D documentation step starts from fresh storefront `main`:

`e11abd5bcacc923fdaa085facd01a3f347bc490f`

Branch:

`docs/blocker-d-gpsr-audit-plan-20260904`

Canonical owner payment decision remains unchanged:

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
- PR #186 — removed the split-payment direction and made 100% upfront PayPal-only canonical;
- PR #187 — recorded the targeted Dutch legal verification and parked Blocker C as an unresolved launch gate.

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
| GPSR / product-safety presentation | **50%** | Read-only audit + centralized plan complete; material confirmation and implementation remain |
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

The Privacy audit and public wording implementation are complete. Ordinary contact/support retention is **12 months after the request is resolved**. Functional browser storage and relevant providers are documented. Final launch review still applies.

---

## 5. Remaining public website launch blockers

### Blocker C — checkout/payment-law presentation — LEGAL VERIFICATION COMPLETE, OWNER/LEGAL GATE OPEN

The current LegendMural checkout remains full-payment-only:

1. LegendMural shows totals and **`Continue to payment`**;
2. customer is redirected to hosted PayPal;
3. PayPal order uses `intent: CAPTURE` and `user_action: PAY_NOW`;
4. customer approves full payment;
5. server-side capture/status verification is required before the order becomes paid.

Canonical owner payment model remains fixed:

- PayPal only;
- 100% paid when the order is placed;
- production/processing only after verified full payment;
- delivery later;
- no split payments, deposit, later balance or additional provider.

Targeted Dutch legal verification on 4 September 2026 found that current authoritative ACM/ConsuWijzer guidance and Article 7:26 BW do not provide a basis for closing the Dutch consumer launch gate while 100% advance payment is mandatory and no after-delivery route exists. Made-after-order production and the personalised-goods withdrawal exception do not establish an advance-payment exception for the standard catalogue.

Blocker C is therefore **parked but not closed**. Do not change payment/V3 code or revive 50/50/provider alternatives from this website track. If the owner intends to launch the unchanged 100%-only model to Dutch consumers, obtain a specific Dutch consumer-law opinion before Production.

### Blocker D — GPSR / product-safety presentation — AUDIT + CENTRAL PLAN COMPLETE

The read-only audit is complete. Detailed plan: [`GPSR_PRODUCT_SAFETY_PLAN.md`](GPSR_PRODUCT_SAFETY_PLAN.md).

#### Already established

- Owner confirms LegendMural controls its own production in the Netherlands and sells the products under the LegendMural brand.
- Working manufacturer identity: **Alka Group, trading through LegendMural**.
- Public Company Information already contains legal business name, Dutch postal address, email and phone.
- Full catalogue contains **111** physical wall-sticker products.
- Every product has a unique `LM-2026-xxxxx` product ID, a catalogue batch and predefined Compact/Statement variants.
- Product pages already show product image/name, size, `Matte vinyl`, `Removable` and `Made in Netherlands`.
- Product pages are centrally generated from `templates/product-page.html`; do not edit 111 product pages manually.

#### Central implementation direction

The public online-offer implementation should be template-driven and ultimately expose:

- authoritative product ID;
- manufacturer identity;
- manufacturer postal/electronic contact;
- applicable intended-use information;
- only warnings/safety information supported by the actual material/product risk assessment.

The relevant technical surface is expected to be limited to the existing product catalogue/template/generator and focused tests. This belongs to the public website track and must not touch V3.

#### Four production facts still required before final safety wording

1. exact self-adhesive vinyl/media — brand + product name/code, ideally datasheet or supplier page;
2. exact ink family/cartridge used with the Roland VersaSTUDIO BN-20A;
3. laminate/coating — confirm none, or exact brand/type;
4. final consumer packaging — how the sticker is packed and where a small manufacturer/product-ID label or insert can be placed.

Do not invent warnings while these facts are unknown.

Existing claims that specifically need material-document verification include **`residue-free`** and broad **`for every room`** wording.

#### Physical traceability

Before commercial release, also define a lightweight physical marking or included-document approach carrying the manufacturer identity/contact and a product or batch reference. Preferred implementation can be a standardized backing-sheet label, packaging label or included card; exact format depends on the owner-confirmed packaging method.

### Blocker E — commercial rights/IP owner gate

Before commercial launch, the owner must separately confirm required commercial rights/permissions for designs, portraits, names, trademarks and other protected material. This cannot be proven from repository code.

### Blocker F — final-domain metadata / SEO

Replace remaining preview/GitHub Pages canonical/Open Graph references with correct `https://legendmural.com` handling and verify generated/public metadata.

---

## 6. Exact website release order from here

1. **Blocker C remains an explicit launch gate:** unchanged 100% upfront PayPal-only model requires external Dutch legal confirmation before Dutch consumer Production launch.
2. **Blocker D:** complete the minimal GPSR implementation. Manufacturer/product identity can be implemented centrally without changing V3; final warnings/use claims wait for real material facts.
3. **Blocker F:** `legendmural.com` canonical/Open Graph/SEO cleanup.
4. **Final website audit:** confirm legal/content/UI gates, owner IP gate and relevant CI; Blocker C must still be resolved before Dutch consumer Production launch.
5. **Production only after explicit approval:** controlled Netlify Production cutover and later live proof at the correct shared release gate.

---

## 7. Exact next step

**Do not deploy Netlify Production. Do not change PayPal/V3 behavior. Do not invent material warnings.**

Blocker D part 1 is complete: audit and centralized implementation plan are documented.

The next website step has two parts in order:

> **Blocker D part 2A:** implement only the already-established GPSR online-offer identity fields centrally: visible `LM-2026-xxxxx` product ID plus Alka Group / LegendMural manufacturer postal/electronic contact on managed product pages, with generated-page contract coverage. This does not depend on unverified material claims and must not touch V3.

Then:

> **Blocker D part 2B:** once the owner provides the exact vinyl, ink, laminate/coating and packaging facts, validate the real supplier documentation and finalize intended-use wording, any genuinely required warnings, and the physical label/insert specification.

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