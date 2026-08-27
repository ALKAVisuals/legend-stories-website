# LegendMural current production status — pre-deploy release handoff

**Updated:** 27 August 2026, after real-device checkout validation and mobile-navigation investigation  
**Repository:** `ALKAVisuals/legend-stories-website`  
**Production host:** Netlify  
**Public origin:** `https://legendmural.com`

> **START HERE FOR THE NEXT CHAT.** This document supersedes `docs/CURRENT_PRODUCTION_STATUS_20260826.md` for current operational state. Older handoffs remain historical context only. If an older document, screenshot, branch or chat conflicts with this file plus current GitHub state, prefer a fresh GitHub read plus this handoff.

This file deliberately contains no passwords, API keys, full database connection strings or customer payloads.

---

## 1. Immediate source-of-truth snapshot

### Public webshop only

This track concerns the **public LegendMural webshop** in:

`ALKAVisuals/legend-stories-website`

Do not switch to the separate dashboard repository `ALKAVisuals/legendmural-dashboard` unless the owner explicitly changes topic.

### GitHub `main`

`main` immediately before this handoff-update branch was created:

`c9d8e6bc34f253f15bb5fd5a410ddf583de354d9`

That commit is documentation-only PR #147 — **Clarify runtime baseline in current Production handoff**.

Always fresh-check the exact current `main` SHA before repository or release decisions because documentation-only merges can move `main` without changing runtime code.

### Latest merged runtime-code-changing baseline

`663e4ebbe71bea8cd4097a452ab9f489daba34cb`

This is PR #145 — **Wire paid-order notifications into PayPal runtime**.

PR #145 is merged and contains the completed PayPal capture/webhook paid-order notification integration.

### Separate open PR #144 — do not bundle automatically

PR #144 — **Harden WebKit checkout cart seeding** — remains separate from this release track.

- Branch: `test/webkit-cart-seeding-hardening-20260826`
- Head: `b8fef4a3ea991674ebf814cefcccde872d51a965`
- Scope: test harness only (`tests/browser/mobile-checkout-webkit.mjs`)
- No intended runtime website/payment/Netlify/Neon behavior change
- It exists because the iPhone WebKit CI job has shown a recurring early cart-initialization flake
- Do not merge it automatically merely because the release work continues

---

## 2. Mandatory working method

Work **one meaningful step at a time**.

After every completed step report:

1. what was checked or changed;
2. the result;
3. what was deliberately not changed;
4. how the result was verified;
5. the next **single** step.

Before every repository mutation:

1. fully read this current-production handoff;
2. also fully read `docs/CURRENT_PRODUCTION_STATUS_20260826.md` while the project rule still requires it;
3. fresh-check exact current `main`;
4. use a feature/documentation branch, never direct `main`;
5. merge only after adequate green evidence and explicit approval.

### Owner release preference

The owner explicitly wants to **finish all feasible pre-deploy points first and then update Netlify Production once**, rather than spending multiple Netlify deploy/update points on intermediate experiments.

Therefore:

- do not deploy Netlify merely because one fix becomes ready;
- finish the mobile-navigation blocker and other pre-deploy checks first;
- keep Production intentionally behind until the final approved release candidate is ready.

---

## 3. Non-negotiable payment and security boundaries

- Neon is authoritative order truth.
- PayPal is payment proof.
- Frontend may show `paid` only after server-authoritative confirmation.
- Email delivery failure must never change a correctly persisted paid order into failed/pending.
- Never expose or request `PAYPAL_CLIENT_SECRET`.
- Never expose or request full Neon credentials/connection strings.
- Never expose or request `RESEND_API_KEY`.
- Never log full customer payloads.
- Do not globally disable secret scanning.
- GitHub Pages is static/visual only and cannot validate PayPal, Neon, Netlify Functions, webhooks or Resend.
- Preview/test environments must not accidentally gain Live payment/email credentials.

LegendMural is not fully selling-ready until one controlled PayPal Live transaction proves the entire chain end-to-end.

---

## 4. Exact Netlify Production state — now confirmed

Step E1 read-only release readiness is **complete**.

The owner opened Netlify Deploys and the currently **Published / Production** deploy was shown as:

`main@95a57e8`

GitHub resolved that short SHA to:

`95a57e8f05a0af547efa0dfc4d044b8a96de7fe3`

Commit message:

**Log safe PayPal checkout bootstrap error code**

At the time of E1, current `main` was 121 commits ahead of that Production commit. The exact numerical gap may change after later documentation/fix commits, so do not reuse 121 as a future authoritative count without rechecking.

Important:

- Netlify Production has **not** been deliberately updated during the current release work.
- Netlify showed **Builds are stopped**.
- A separate failed deploy row showed **Exposed secrets detected**; that failed row is not the Published Production runtime.
- Do not press **Activate builds** or publish anything until the final pre-deploy release candidate is approved.

---

## 5. Checkout/mobile history and real-device proof

### Historical Production symptom — 25 August

On mobile Safari the old Production runtime showed:

- unstable Street input;
- long `VALIDATING ADDRESS...` behavior;
- later unexpected sticker-product navigation;
- no completed expected checkout result.

### Repository fixes already merged

PR #135 — mobile checkout stabilization:

`034a5f6fff61764edadde6ef55423428bda240ea`

PR #137 — remove Google Places from the critical checkout path:

`388981ca20518615ee743e003455edb664b5f7a1`

Current intended checkout behavior:

- manual shipping address is authoritative;
- no Google Places latency in the critical payment path;
- required/email/country checks remain;
- lightweight Street + Number digit sanity check remains;
- no strict global postcode regex;
- iOS checkout inputs remain at least 16px;
- checkout proceeds to order processing after local validation.

### GitHub Pages release-candidate refresh

Because Netlify Production must not be spent on intermediate validation, GitHub Pages was refreshed from current `main` through PR #148 with base `gh-pages` and head `main`.

PR #148 merged into `gh-pages` as:

`8b4a7e6ead3ad9dfd29266d11bde845ef94dc03f`

The existing Pages-specific workflow remained present and the **Temporary GitHub Pages preview** workflow completed successfully for exact `8b4a7e6e...`.

Preview URL:

`https://alkavisuals.github.io/legend-stories-website/`

### Real iPhone Safari checkout test — passed for checkout behavior

The owner tested the refreshed Pages release candidate in a private real iPhone Safari session.

Verified in that real-device run:

- `Street + Number` remained stable while typing;
- no jumping;
- no focus loss;
- no `VALIDATING ADDRESS...` dependency appeared;
- no unexpected sticker/product navigation occurred in the tested checkout flow;
- discount/shipping/total rendered correctly in the observed checkout;
- checkout reached the expected static Pages fallback:
  `Order ready. Secure online payment is not enabled on this deployment yet.`

That is strong real-device evidence that the original address-entry/checkout symptom is resolved in the release candidate.

### Important qualification

The **checkout-specific** iPhone release gate passed, but the **overall mobile release gate is not yet complete**, because a separate hamburger/mobile-navigation problem was discovered immediately afterward.

---

## 6. Current release blocker — hamburger/mobile menu

### Observed problem

On the refreshed real iPhone Safari Pages preview, tapping the hamburger/mobile-menu button appeared to do nothing.

This is now a release blocker. Do not deploy the current release candidate to Netlify until it is fixed and revalidated.

### Read-only root-cause investigation

Current source code does contain a real mobile-navigation controller:

- `js/mobile-navigation.mjs`
- `js/app.js` loads it and binds it to `#mobile-menu-btn` + `#mobile-menu`

The controller moves the menu to `<body>` and dynamically requests:

`css/premium-navigation.css`

The actual successful GitHub Pages build artifact was inspected. It contained:

- `js/mobile-navigation.mjs` — present
- `js/app.js` — present
- `css/premium-navigation.css` — **missing**

The missing CSS is required for the portalled menu to become a full-screen mobile overlay. Without it, the JavaScript may toggle state while the menu remains effectively invisible/off-layout.

### Why this also matters for Netlify

This is not considered Pages-only.

Netlify uses the repository build command and publishes `dist`, while the missing stylesheet was a Vite build-output problem. Therefore the same release candidate could ship a broken hamburger to Netlify Production if deployed without the fix.

### Fix branch already created — NO PR YET

Branch:

`fix/mobile-navigation-build-css-20260827`

The branch was created from exact `main`:

`c9d8e6bc34f253f15bb5fd5a410ddf583de354d9`

Current branch head:

`286c8fff20f2cc9b538bee91633558e02703bca1`

The branch is two commits ahead of that `main` baseline and changes only:

1. `vite.config.mjs`
   - explicitly emits `css/premium-navigation.css` into `dist/css/`;
2. `scripts/validate-build.mjs`
   - adds a build regression guard so the build fails if the mobile-navigation runtime/CSS contract is missing.

At the time of this handoff update, a fresh GitHub search confirmed:

**There is NO pull request yet for `fix/mobile-navigation-build-css-20260827`.**

Do not recreate the branch or reimplement the fix from scratch.

### Immediate next repository action

Open exactly one PR:

`fix/mobile-navigation-build-css-20260827` -> `main`

Then stop and inspect CI before merge.

Do not merge the fix in the same first action of a new chat.

---

## 7. Paid-order email architecture — repository complete

### Durable notification store — PR #140

Merged as:

`30c60566801680ad21160d8c96a84ed98ba1f2c1`

Notification types:

- `merchant_paid_order`
- `customer_paid_order`

Durable uniqueness:

`(order_reference, notification_type)`

Lifecycle:

`pending -> sending -> sent`

or:

`sending -> failed -> retry/claim later`

### Guarded Resend layer — PR #141

Merged as:

`370c873c3fec88abea6b0fd1ec4d2983e1491ea0`

Important behavior:

- `ORDER_EMAILS_ENABLED` kill-switch;
- only `paid` + `live` orders can email;
- merchant/customer deliveries are independent;
- database claim prevents duplicate processing;
- Resend idempotency adds provider-level duplicate protection;
- HTML/customer data is escaped;
- item `unitPrice` / `lineTotal` are EURO amounts;
- authoritative order totals are CENTS;
- email rejection is notification failure, not payment failure.

### Runtime PayPal integration — PR #145

Merged as:

`663e4ebbe71bea8cd4097a452ab9f489daba34cb`

Implemented:

- shared `server/netlify/paid-order-notification-runtime.mjs`;
- fresh capture attempts notification only after authoritative paid persistence;
- already-paid capture can reconcile notification without recapture;
- webhook attempts notification after authoritative reconciliation;
- capture + webhook may both attempt safely because DB/provider idempotency owns duplicate prevention;
- notification/provider failure remains non-fatal to payment truth and webhook acknowledgement;
- safe logging only.

The old 26-August handoff statements saying runtime integration is not built are obsolete.

---

## 8. Neon Production — notification migrations complete

Production target:

- Project: `Legendmural`
- Project ID: `super-shape-69972279`
- Branch: `production`
- Branch ID: `br-misty-cloud-as0rofc8`
- Database: `neondb`
- Schema: `legend_commerce`

Completed on Production:

- `009_create_order_notifications.sql`
- `010_grant_order_notifications_runtime.sql`

Verified after migration:

- `legend_commerce.order_notifications` exists;
- owner `legendmural_migrator`;
- delivery index and constraints exist;
- runtime role has SELECT / INSERT / UPDATE;
- runtime role does not have DELETE;
- table was empty immediately after migration.

The temporary migration-test branch was deleted.

Do not recreate/re-run these migrations blindly.

Separate deliberately deferred issue: `legendmural_netlify` has broader `neon_superuser` membership from earlier setup. Do not mix that least-privilege cleanup into this release unless explicitly authorized.

---

## 9. Mailbox, DNS and Resend — setup complete

### DNS authority

Netlify DNS is authoritative for `legendmural.com`.

Nameservers:

- `dns1.p01.nsone.net`
- `dns2.p01.nsone.net`
- `dns3.p01.nsone.net`
- `dns4.p01.nsone.net`

Microsoft 365/GoDaddy hosts `info@legendmural.com` but does not own active DNS.

### Mailbox

Microsoft 365 mailbox DNS was added in Netlify DNS. GoDaddy subsequently showed:

**“Je e-mail is klaar voor gebruik.”**

The owner has already stated the mailbox test was performed. Do not restart mailbox/DNS setup from scratch unless a new delivery problem appears.

### Resend domain

Verified sending domain:

`mail.legendmural.com` — **Verified**

Keep the existing Resend/Amazon SES DKIM/SPF/MX subdomain records separate from Microsoft 365 root mailbox records.

No separate LegendMural Resend account is required.

---

## 10. Netlify email environment — configured and safely OFF

Secret values are intentionally omitted from this handoff.

### `RESEND_API_KEY`

- exists;
- secret;
- Production only;
- preview/branch/local contexts empty.

### `RESEND_FROM`

Production intended value:

`LegendMural <orders@mail.legendmural.com>`

Production only.

### `RESEND_REPLY_TO`

Production value:

`info@legendmural.com`

Production only.

### `ORDER_NOTIFICATION_TO`

Configured as:

`info@legendmural.com`

It may be visible across deploy contexts; it does not itself enable mail.

### `ORDER_EMAILS_ENABLED`

Every reviewed deploy context is explicitly:

`false`

Confirmed:

- Production: `false`
- Deploy Previews: `false`
- Branch deploys: `false`
- Preview Server & Agent Runners: `false`
- Local development / Netlify CLI: `false`

The Netlify UI may describe this as the same value in all contexts because all values are identical. Functionally the required safety state is achieved: **email delivery is disabled everywhere**.

Do not set Production to `true` until the controlled final Live-order test point.

---

## 11. Completed vs remaining proof

### Completed

- paid-order notification DB/store repository work;
- merchant/customer email templates;
- Resend notifier;
- paid/live guards and idempotency protections;
- PayPal capture + webhook notification runtime integration on merged code;
- Production Neon migrations 009/010;
- Microsoft 365/GoDaddy mailbox DNS accepted;
- Resend sending domain verified;
- Netlify email configuration reviewed;
- email kill-switch confirmed `false` everywhere;
- exact currently Published Netlify Production commit established;
- E1 read-only release readiness completed;
- GitHub Pages refreshed for release-candidate validation;
- real iPhone Safari checkout/address behavior successfully validated.

### Current blocker before overall mobile approval

- hamburger/mobile navigation does not work visibly in the release-candidate Pages build;
- root cause identified as missing `css/premium-navigation.css` in build output;
- fix exists on `fix/mobile-navigation-build-css-20260827` but is not yet PR-reviewed/CI-validated/merged/retested.

### Still unproven until final Production release/test

- final release candidate with hamburger fix on `main`;
- hamburger works on real iPhone Safari after fix;
- final Production runtime after the one planned Netlify release;
- Production payment flow on the final runtime;
- Production paid-order email delivery with `ORDER_EMAILS_ENABLED=true`;
- one real merchant paid-order email;
- one real customer confirmation;
- duplicate prevention under actual capture + webhook timing;
- complete PayPal Live -> Neon paid -> order-status paid -> both emails chain.

---

## 12. Release plan from this exact point

Do **not** jump to Netlify yet.

### Phase P1 — finish hamburger fix

1. Open PR from `fix/mobile-navigation-build-css-20260827` to `main`.
2. Inspect CI.
3. Merge only after adequate green evidence and approval.
4. Refresh GitHub Pages from the new approved `main` while preserving the Pages workflow.
5. Re-test hamburger on real iPhone Safari.
6. Perform a quick checkout smoke test to ensure the earlier successful address/checkout behavior still holds.

### Phase P2 — finish any other pre-deploy release checks

Before Netlify, review whether any other release blockers remain. Do not invent a deploy merely to discover avoidable frontend issues.

### Phase F — one controlled Netlify Production release

Only after all feasible pre-deploy blockers are closed, publish the exact approved repository version **once**.

Then perform safe Production smoke checks before a real payment.

### Phase G — controlled email activation + one PayPal Live order

At the approved final test point:

- change **Production only** `ORDER_EMAILS_ENABLED` from `false` to `true`;
- ensure activation is applied to the intended Production runtime;
- perform exactly one controlled PayPal Live order;
- verify the full checklist below.

Do not enable previews/branches/local contexts.

---

## 13. Final controlled PayPal Live proof

For exactly one controlled real Live order verify:

1. checkout reaches PayPal Live;
2. payment completes;
3. return to LegendMural succeeds;
4. capture endpoint succeeds;
5. PayPal completed-capture webhook returns HTTP 200;
6. Neon order is `paid`;
7. `/api/order-status` returns `paid`;
8. PayPal business account shows the funds;
9. exactly one merchant email arrives at `info@legendmural.com`;
10. exactly one customer email arrives at the test customer address;
11. email order/customer/product/shipping/total data is correct;
12. capture + webhook do not create duplicate merchant/customer email.

Only after this may the paid-order path be considered proven end-to-end.

---

## 14. Work deliberately deferred

Do not mix these into the current pre-deploy/payment-email track unless explicitly authorized:

- About Us narrative redesign;
- social-link work;
- broader contact-form Production validation;
- withdrawal end-to-end validation;
- Neon least-privilege cleanup for broad `legendmural_netlify` membership;
- LegendMural Dashboard work in `ALKAVisuals/legendmural-dashboard`.

---

## 15. Immediate instructions for the next chat

1. Read this entire file first.
2. Also read `docs/CURRENT_PRODUCTION_STATUS_20260826.md` if the repository-mutation rule still requires it.
3. Confirm this is the **public LegendMural webshop**, not the dashboard.
4. Fresh-check exact current `main`.
5. Fresh-check branch `fix/mobile-navigation-build-css-20260827`; expected handoff head is `286c8fff20f2cc9b538bee91633558e02703bca1` unless newer legitimate work exists.
6. Confirm whether a PR now exists for that branch.
7. If no PR exists, the next single action is to open the PR to `main` and then stop.
8. Do not recreate the hamburger fix from scratch.
9. Do not merge PR #144 automatically.
10. Do not activate Netlify builds or deploy Production.
11. Do not set `ORDER_EMAILS_ENABLED=true`.
12. Do not run a PayPal Live transaction yet.
13. Preserve the owner’s strategy: finish all feasible pre-deploy points first, then make one controlled Netlify Production update.
