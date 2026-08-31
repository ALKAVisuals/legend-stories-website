# LegendMural current production status — pre-deploy release handoff

**Updated:** 31 August 2026  
**Repository:** `ALKAVisuals/legend-stories-website`  
**Production host:** Netlify, deliberately not used yet for the final release  
**Temporary release-candidate preview:** `https://alkavisuals.github.io/legend-stories-website/`

> **START HERE FOR THE NEXT CHAT.** This document supersedes `docs/CURRENT_PRODUCTION_STATUS_20260827.md` for the current public-webshop release state. Older handoffs remain historical context only. If an older document conflicts with this handoff plus a fresh GitHub read, prefer the fresh GitHub state and this file.

This handoff contains no passwords, API keys, full database connection strings or customer payloads.

---

## 1. Scope and working method

This track concerns only the public LegendMural webshop in:

`ALKAVisuals/legend-stories-website`

Do not switch to the separate dashboard repository unless the owner explicitly changes topic.

Work one meaningful step at a time. Before every repository mutation:

1. read this handoff;
2. fresh-check exact `main`;
3. use a branch, never direct `main`;
4. inspect CI before merge;
5. merge only after explicit owner approval.

Do not publish or activate Netlify Production without explicit permission.

The owner’s release strategy is unchanged: finish all feasible pre-deploy work first, then perform one controlled Netlify Production release at the end.

---

## 2. Current GitHub baseline

Current `main`:

`c5d6dc0b5a597a8dba5f20120196e67ca389517f`

Commit:

`feat: improve confirmed order return experience (#154)`

Important merged release work after the 27-August handoff:

- PR #150 — mobile-navigation build CSS fix;
- PR #151 — refresh GitHub Pages preview after mobile-navigation fix;
- PR #152 — About page redesign around the LegendMural brand story;
- PR #154 — improve confirmed paid-order return experience;
- PR #155 — refresh GitHub Pages preview from the current approved `main`.

PR #155 merged to `gh-pages` as:

`c25f6a50092e8e9a4b8aaa2090ca2d59bc2390ad`

The `Temporary GitHub Pages preview` workflow for that exact commit completed successfully.

A compare of `main...gh-pages` on 31 August showed:

- `gh-pages` is behind `main` by **0**;
- `gh-pages` contains the full current `main`;
- the only file-level branch difference is the Pages-specific preview workflow.

Therefore the temporary Pages site is the current static release candidate.

---

## 3. Mobile-navigation blocker — resolved

The 27-August handoff described a release blocker where the mobile hamburger could appear non-functional because `css/premium-navigation.css` was missing from the Vite build output.

That blocker is no longer current.

Resolved through PR #150:

- `vite.config.mjs` now emits `css/premium-navigation.css` into the build output;
- `scripts/validate-build.mjs` guards the mobile-navigation runtime/CSS build contract.

PR #151 then refreshed the temporary GitHub Pages candidate after the fix.

The owner explicitly confirmed that the hamburger worked on the real iPhone Safari test. Do not ask for the same hamburger test again unless a new regression appears.

---

## 4. About page — release work complete

PR #152 redesigned the About page around the actual LegendMural brand story.

Current published preview includes:

- LegendMural positioning and collection story;
- Music, Sport, Combat and Wisdom framing;
- installation-guide CTA;
- official YouTube/install playlist;
- official social-channel links already present in the approved page;
- normal storefront navigation and cart runtime.

A source-level smoke test of the exact published `gh-pages/about.html` found no release blocker and no dead `href="#"` links.

No further About redesign is required for this release unless the owner requests content changes.

---

## 5. Paid-order return experience — release work complete

PR #154 added the confirmed-order continuation experience.

Files include:

- `order-success.html`;
- `js/order-return.js`;
- `css/order-paid-experience.css`;
- paid-order contract/build validation.

Verified paid state displays, among other copy:

- `Order confirmed`;
- `Your legend is officially yours.`;
- Payment → Production → Shipping journey;
- `Get ready for your wall`;
- official installation-guide CTA;
- `Explore more legends` secondary CTA.

Payment truth remains server-authoritative.

The browser does **not** get to mark an order paid from the URL or local state. The shared return policy computes:

`verifiedPaid = statusResponse?.status === 'paid' && statusResponse?.paid === true`

Only that state may clear verified checkout/cart storage.

The paid-only UI is also CSS-gated behind:

`[data-order-status='paid']`

Thus the premium paid-order content remains hidden until the verified server response reports the order as paid.

Do not weaken this rule.

---

## 6. Checkout/mobile validation state

The real iPhone Safari checkout/address problem from 25 August remains considered resolved.

Previously verified on real iPhone Safari:

- Street + Number remained stable while typing;
- no focus loss/jumping;
- no `VALIDATING ADDRESS...` Google dependency;
- no unexpected product-page navigation in the tested flow;
- discount/shipping/total rendered correctly;
- checkout reached the expected static Pages fallback:
  `Order ready. Secure online payment is not enabled on this deployment yet.`

After the hamburger fix, the final repository candidate also passed the automated:

`Mobile checkout WebKit regression`

on the current PR #154 head.

That regression uses an iPhone 13 WebKit profile and asserts:

- 16px mobile checkout font size;
- Street input does not shift while typing;
- the following postcode field does not shift;
- Street focus is preserved;
- local checkout does not wait on Google Places;
- no unexpected product-page navigation;
- the safe no-payment fallback is reached.

This is strong technical evidence that the current release candidate preserves the earlier successful mobile checkout behavior.

A new real-device checkout rerun is not a code blocker at this point. It may still be performed as an optional final owner confidence check before Production.

---

## 7. CI/release-candidate status

For the PR #154 release head, all relevant checks were green:

- Accessibility and purchase-flow audit — success;
- Post-checkout build readiness — success;
- Netlify preview compatibility — success;
- Mobile checkout WebKit regression — success;
- Quality checks — success.

After PR #155, the `Temporary GitHub Pages preview` workflow also completed successfully.

No current GitHub Issue is open for a website release blocker.

Open PRs that must **not** be bundled automatically:

- PR #144 — test-only WebKit cart-seeding hardening;
- PR #153 — separate V3 draft foundation work, outside this release track.

Historical open PRs such as #119/#139 are superseded by later merged work and are not release blockers.

---

## 8. Paid-order email / payment backend state

The backend architecture from the previous handoff remains intentionally unchanged by the recent frontend work.

Completed repository/runtime foundation includes:

- durable paid-order notification state;
- merchant/customer email templates;
- guarded Resend notifier;
- `paid` + `live` email guards;
- database/provider idempotency;
- PayPal capture + webhook notification integration after authoritative paid persistence;
- Production notification migrations 009/010 already completed according to the 27-August handoff.

Critical invariants:

- Neon is authoritative order truth;
- PayPal is payment proof;
- capture and webhook may both attempt notification safely;
- notification/email failure must never regress a persisted paid order;
- no browser state may manufacture `paid`;
- do not expose secrets or customer payloads.

`ORDER_EMAILS_ENABLED` must remain **false** until the controlled final Production/PayPal Live proof point.

---

## 9. Netlify status and release boundary

Do **not** infer from older handoff text that the current release candidate is already live on Netlify.

The owner explicitly clarified on 31 August that the website has **not yet been uploaded/released to Netlify as the final current site** and that this should happen only after all work is finished.

Therefore current work uses GitHub Pages only as a static release-candidate preview.

Do not:

- activate Netlify builds;
- publish the current `main` to Production;
- change Production environment values;
- enable paid-order email delivery;
- run a PayPal Live payment;
- claim the current `main` is already the live Production site.

The final Netlify step remains intentionally deferred until explicit owner approval.

---

## 10. Current pre-deploy conclusion

As of 31 August 2026, the current website release candidate has no known pre-deploy technical blocker in the reviewed scope.

Completed before Netlify:

- mobile navigation build fix;
- real-device hamburger confirmation;
- current GitHub Pages release-candidate refresh;
- About redesign;
- confirmed paid-order success experience;
- server-authoritative paid UI/cart policy reverified;
- About source smoke test;
- paid-order source/runtime smoke test;
- final pre-deploy blocker audit;
- post-fix automated iPhone/WebKit checkout regression;
- full relevant CI green.

The temporary preview is current with `main`.

This does **not** mean the complete commerce system is selling-ready. Final Production backend/payment/email proof still requires Netlify and one controlled PayPal Live order later.

---

## 11. Next release phases

### Phase F — controlled Netlify Production release

Only after explicit owner approval:

1. identify the exact approved `main` SHA;
2. upload/publish that exact approved release to Netlify once;
3. verify the final Production build/runtime corresponds to that SHA;
4. perform safe Production smoke checks without making a real payment yet.

### Phase G — controlled email activation + one PayPal Live order

Only after the Production runtime is approved:

1. enable `ORDER_EMAILS_ENABLED=true` for Production only;
2. perform exactly one controlled PayPal Live order;
3. verify PayPal capture + webhook;
4. verify Neon order `paid`;
5. verify `/api/order-status` returns `paid`;
6. verify exactly one merchant email;
7. verify exactly one customer email;
8. verify no duplicate delivery under capture + webhook timing;
9. verify order/customer/product/shipping/total information;
10. verify funds in the PayPal business account.

Only then is the complete paid-order path proven end-to-end.

---

## 12. Immediate instructions for the next chat

1. Read this entire file first.
2. Confirm the scope is the public webshop repository.
3. Fresh-check current `main` before any mutation.
4. Treat `c5d6dc0b5a597a8dba5f20120196e67ca389517f` only as the handoff baseline; do not assume it is still current later.
5. Preserve the owner strategy: one final Netlify release only after all pre-deploy work is finished.
6. Do not re-open the resolved hamburger investigation without new evidence.
7. Do not weaken server-authoritative paid-order verification.
8. Do not auto-merge PR #144.
9. Do not mix PR #153/V3 work into this website release track.
10. Do not activate Netlify, paid-order email delivery or PayPal Live without explicit approval.
11. If the documentation-update PR is not yet merged, finish that documentation step first.
12. After the handoff is merged, the next release decision is whether the owner is ready to begin the controlled Netlify Production phase; do not start it automatically.
