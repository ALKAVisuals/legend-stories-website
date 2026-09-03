# LegendMural current production status — public website launch-readiness

**Updated:** 3 September 2026  
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

The latest website-owned merge before this handoff refresh is:

`40177ad6925c7e767a86fd10e8a622c521a2a1e7`

Commit:

`Merge PR #169: stabilize mobile WebKit regression`

PR #169 changed only `tests/browser/mobile-checkout-webkit.mjs`. It made the iPhone/WebKit regression deterministic without changing storefront runtime or any V3/backend code. The final PR head passed Quality checks, Accessibility/purchase-flow audit and Mobile checkout WebKit regression.

This documentation branch was created directly from that `main` SHA:

`docs/privacy-audit-handoff-20260903-v2`

This SHA is a checkpoint only. Before every new website branch and immediately before every merge, fresh-check `main` because the V3 workstream may merge in parallel.

No Netlify Production deployment, PayPal Live activation, Production email activation, V3 Profile 1 activation or Production migration is authorized by this handoff.

---

## 3. Current public website readiness

These percentages are internal project-tracking estimates, not legal certification.

| Area | Readiness | Current assessment |
|---|---:|---|
| Storefront UI/content core | **96%** | Main shopping experience built and broadly tested |
| Company/legal information pages | **90%** | Strong baseline; final compliance consistency remains |
| Privacy / AVG | **80%** | Audit complete; public wording implementation still required |
| Cookies / tracking | **90%** | No advertising pixels/behavioural analytics found in tracked storefront baseline |
| Returns / statutory withdrawal | **95%** | 14-day right, model form and online withdrawal function exist |
| Checkout / payment-law presentation | **55%** | Consumer-facing payment-obligation/advance-payment review remains |
| Pricing / shipping / commercial-claim consistency | **95%** | Blocker A closed via PR #159 |
| GPSR / product-safety presentation | **40%** | Manufacturer/contact/identification/safety presentation incomplete |
| Final-domain metadata / SEO | **50%** | Old preview/GitHub Pages metadata still needs cleanup |
| Netlify Production cutover | **0%** | Not authorized yet |
| Controlled Live proof | **0%** | Only after all launch gates and explicit owner approval |

**Overall public website launch-readiness estimate: ~80%.**

The unresolved launch gates matter more than the average percentage.

---

## 4. Completed public website work — do not reopen without regression evidence

### Storefront / mobile / content

- 111-product catalogue and generated product-page architecture;
- central public product/variant presentation;
- mobile navigation fix;
- real iPhone Safari hamburger confirmation;
- mobile checkout/WebKit regression coverage;
- WebKit regression test stabilized through PR #169 while keeping native touchscreen interaction and leaving storefront runtime unchanged;
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

Authoritative public launch rules remain:

- Compact: **€35 incl. VAT**;
- Statement: **€45 incl. VAT**;
- `LEGEND10`: 10% discount;
- Netherlands shipping: **€4.95**;
- EU shipping: **€9.95**;
- United States: **€9.95 tracked**;
- free shipping from **€69 after discount**;
- no fixed marketing promise such as `2–4 days`;
- no conflicting `30-day return` marketing promise.

Owner policy: do **not** publish a concrete expected delivery time in general storefront marketing copy. The Shipping page may state the legal fallback that, unless otherwise agreed, consumer goods are delivered without undue delay and no later than 30 days. This is not an expected delivery estimate.

### Blocker B, part 1 — Privacy/AVG read-only audit — COMPLETE

The current Privacy page and relevant public storefront/browser runtime were audited without changing V3/backend code.

Confirmed findings:

1. **Google Places/address wording is stale.** The current checkout uses manual editable address fields and local validation through `js/checkout-address-entry.mjs`; no active Google Places integration was found in the checkout path.
2. **Functional browser storage is used.** The storefront uses `localStorage` for cart/version, shipping country and discount-code state. Temporary checkout/order verification data is stored in `sessionStorage` and cleared in the verified-paid flow where appropriate.
3. **A retention policy already exists in the repository.** `docs/DATA_RETENTION_POLICY.md` defines a 7-year statutory commerce baseline, a conditional 10-year class where an applicable OSS/IOSS regime requires it, and a 5-year target class for non-fiscal contractual/consumer-right evidence, subject to legal/tax/dispute holds. Destructive enforcement is not yet enabled.
4. **The homepage contact form processes personal data.** It collects name, email, subject and free-text message through the public contact flow. The Privacy notice must cover this processing and its retention rule.
5. **Google Fonts is loaded externally** from Google domains. This is separate from the stale Google Places reference and remains part of the privacy/provider assessment.
6. **Swiper is loaded from jsDelivr** on the homepage, creating an external browser request that remains part of the provider/privacy assessment.
7. **Resend wording should be public-facing rather than implementation-facing.** The Privacy page may accurately disclose transactional email processing where relevant, but should not expose internal activation/API-key/test-gate details. V3 invoice/email delivery decisions remain owned by the V3 track.
8. No advertising pixels or behavioural analytics trackers were found in the audited storefront baseline.

No V3-reserved code was modified during this audit.

---

## 5. Remaining public website launch blockers

### Blocker B — Privacy / AVG finalization — CURRENT

The audit is complete. The remaining work is implementation of the smallest accurate public Privacy changes.

Required public changes:

- remove the stale Google Places/address-assistance statement;
- replace the placeholder future-retention paragraph with the actual retention periods/criteria that apply;
- explain functional `localStorage` / temporary `sessionStorage` use in plain language;
- cover the homepage contact form and its retention rule;
- keep provider disclosure aligned with actual public runtime, including relevant hosting/payment/email/external-resource providers;
- simplify implementation-specific Resend wording so the public notice explains processing rather than internal launch configuration;
- update the Privacy page last-updated date;
- add/adjust validation so stale Privacy placeholder/provider claims do not silently return.

### One owner policy decision still required

Before the final Privacy wording can be frozen, define the retention period for **ordinary contact/support messages that are not part of an order, active complaint, legal claim or other statutory record**.

Recommended website policy: **12 months after the ordinary contact/support request is resolved**, unless the correspondence becomes part of an order, complaint, dispute, legal claim or statutory administration record. In that case the applicable longer category controls.

This is deliberately separate from the 7/10-year statutory commerce retention and the 5-year consumer-right/claim-evidence class.

Once this period is accepted or changed by the owner, Blocker B can be implemented without touching V3-owned backend code.

### Blocker C — checkout/payment-law presentation

After Privacy is complete:

- map the consumer-facing point at which the customer becomes legally bound to pay in the hosted PayPal journey;
- verify legally sufficient payment-obligation wording where required;
- review the Dutch advance-payment/payment-method issue;
- implement only public checkout presentation changes proven necessary.

If the necessary solution would modify protected PayPal reconciliation, paid-order finalization, Profile routing or other V3-owned backend behavior, stop and coordinate first.

### Blocker D — GPSR / product-safety presentation

Add/confirm centralized public manufacturer/trader identity, postal/electronic contact, sufficient product identification and applicable use/safety information. Implement centrally/template-driven rather than manually editing 111 pages.

### Blocker E — commercial rights/IP owner gate

Before commercial launch, the owner must separately confirm required commercial rights/permissions for designs, portraits, names, trademarks and other protected material. This cannot be proven from repository code.

### Blocker F — final-domain metadata / SEO

Replace remaining preview/GitHub Pages canonical/Open Graph references with correct `https://legendmural.com` handling and verify generated/public metadata.

---

## 6. Exact website release order from here

1. **Blocker B implementation:** confirm the ordinary contact/support retention policy, then finalize and test `privacy.html`.
2. **Blocker C:** checkout/payment-law presentation review and any website-only corrections.
3. **Blocker D:** centralized GPSR/product-safety presentation.
4. **Blocker F:** `legendmural.com` canonical/Open Graph/SEO cleanup.
5. **Final website audit:** confirm legal/content/UI gates, owner IP gate and relevant CI; coordinate with V3 track and freeze an exact release SHA.
6. **Production only after explicit approval:** controlled Netlify Production cutover and later live proof at the correct shared release gate.

---

## 7. Exact next step

**Do not deploy Netlify Production yet.**

The next public-website step is exactly:

> **Confirm the 12-month-after-resolution retention policy for ordinary contact/support messages (or replace it with another owner-approved period), then create a website-only branch that updates `privacy.html` and targeted validation to implement the completed Privacy/AVG audit findings.**

Expected implementation scope is public website/privacy content and targeted validation only. Do not modify checkout payment internals, invoice code, V3 notification/delivery code or Production settings.

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
