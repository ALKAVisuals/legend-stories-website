# LegendMural current production status — release + paid-order email handoff

**Updated:** 27 August 2026  
**Repository:** `ALKAVisuals/legend-stories-website`  
**Production host:** Netlify  
**Public origin:** `https://legendmural.com`

> **START HERE FOR THE NEXT CHAT.** This document supersedes `docs/CURRENT_PRODUCTION_STATUS_20260826.md` for current operational state. Older handoffs remain historical context only. If an older document, screenshot, branch or chat conflicts with this file plus current `main`, prefer current `main` and this handoff.

This file deliberately contains no passwords, API keys, full database connection strings or customer payloads.

---

## 1. Current source-of-truth snapshot

### GitHub

Latest runtime-code-changing baseline:

`663e4ebbe71bea8cd4097a452ab9f489daba34cb`

This is the merge commit for PR #145 — **Wire paid-order notifications into PayPal runtime**.

PR #145 is merged. It wires paid-order notification reconciliation into both authoritative PayPal completion paths while keeping email failures non-fatal to payment truth.

Post-merge GitHub Actions on exact `663e4ebb...` include successful runs for this runtime baseline. Documentation-only merges after this baseline may move `main` without changing runtime code, so always fresh-check the exact current `main` SHA before repository or release decisions. Production is still intentionally not assumed to equal current `main`.

### Open PR that must not be confused with the release

PR #144 — **Harden WebKit checkout cart seeding** — is still open.

- Branch: `test/webkit-cart-seeding-hardening-20260826`
- Head: `b8fef4a3ea991674ebf814cefcccde872d51a965`
- Scope: test harness only (`tests/browser/mobile-checkout-webkit.mjs`)
- No runtime website, payment, Netlify, Neon or Production behavior change
- Do **not** automatically merge it as part of the paid-order email/release track.

### Production deployment state

Do **not** assume Netlify Production is serving `663e4ebb...` yet.

The last positively supportable Production runtime from earlier investigation remains:

`c1345f22489bf9f8259c55e6432ef4c247c0153`

The exact currently published Netlify runtime still needs a fresh read-only confirmation before any release decision.

No deliberate Netlify Production deploy was performed while configuring the email/DNS settings described below.

---

## 2. Mandatory working method

Work **one meaningful step at a time**.

After every step report:

1. what was checked/changed;
2. the result;
3. what was deliberately not changed;
4. how it was verified;
5. the next **single** step.

Before every repository mutation:

1. fully read the latest current-production handoff;
2. fresh-check the exact current `main` SHA;
3. use a feature/documentation branch, never direct `main`;
4. merge only after adequate green evidence and explicit approval.

Do not publish Netlify Production merely because repository work is complete.

---

## 3. Non-negotiable payment/security boundaries

- Neon is authoritative order truth.
- PayPal is payment proof.
- Frontend may only show `paid` after server-authoritative confirmation.
- Email delivery failure must never change a correctly persisted paid order into failed/pending.
- Never expose or request `PAYPAL_CLIENT_SECRET`.
- Never expose or request full Neon credentials/connection strings.
- Never expose or request `RESEND_API_KEY`.
- Never log full customer payloads.
- Do not globally disable secret scanning.
- GitHub Pages cannot validate PayPal, Neon, Netlify Functions, webhook delivery or Resend.
- Preview/test environments must not accidentally gain Live payment/email credentials.

LegendMural is not fully selling-ready until one controlled PayPal Live transaction proves the entire chain end-to-end.

---

## 4. Checkout/mobile state that must be preserved

### Historical Production symptom

On 25 August 2026 mobile Safari showed:

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

The old unexpected Production product-navigation symptom is **not yet proven fixed on the real Production runtime** merely because repository WebKit tests pass.

A fresh/private real iPhone Safari release validation remains a release gate unless the owner explicitly records that it has already been completed successfully for the release candidate.

---

## 5. Paid-order email architecture — repository state

### Durable notification store

PR #140 merged as:

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

### Guarded Resend layer

PR #141 merged as:

`370c873c3fec88abea6b0fd1ec4d2983e1491ea0`

Important behavior:

- `ORDER_EMAILS_ENABLED` kill-switch;
- only `paid` + `live` orders can email;
- merchant/customer deliveries are independent;
- DB claim protects against duplicate delivery;
- Resend idempotency key adds provider-level duplicate protection;
- HTML/customer data is escaped;
- item `unitPrice` / `lineTotal` are treated as EURO amounts;
- authoritative order totals are treated as CENTS;
- email rejection is notification failure, not payment failure.

### Runtime integration

PR #145 merged as:

`663e4ebbe71bea8cd4097a452ab9f489daba34cb`

Implemented:

- shared `server/netlify/paid-order-notification-runtime.mjs`;
- capture path attempts notification only after authoritative paid persistence;
- already-paid capture can reconcile missing/failed notification without recapture;
- webhook path attempts notification after authoritative reconciliation;
- both paths may attempt the same notification safely because DB/provider idempotency owns duplicate prevention;
- notification runtime/factory/provider failure stays non-fatal to payment truth and webhook acknowledgement;
- safe logging only, no full customer payloads.

Therefore, the old 26-August handoff statements saying runtime integration is not built are obsolete.

---

## 6. Neon Production — notification migrations complete

Production target used for the notification schema:

- Neon project: `Legendmural`
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
- owner is `legendmural_migrator`;
- delivery index exists;
- constraints exist;
- runtime role has SELECT / INSERT / UPDATE;
- runtime role does not have DELETE;
- notification table was empty immediately after migration.

The temporary migration-test branch was deleted after validation.

Do not recreate or re-run these migrations blindly.

Separate known issue, deliberately deferred: `legendmural_netlify` has broader `neon_superuser` membership from earlier setup. Do not mix that least-privilege cleanup into the current email launch unless separately authorized.

---

## 7. Mailbox + DNS state

### DNS authority

Netlify DNS is authoritative for `legendmural.com`.

Nameservers previously confirmed:

- `dns1.p01.nsone.net`
- `dns2.p01.nsone.net`
- `dns3.p01.nsone.net`
- `dns4.p01.nsone.net`

GoDaddy/Microsoft 365 hosts the `info@legendmural.com` mailbox but does not own active DNS.

### Microsoft 365 / mailbox DNS

Microsoft 365 mailbox records were added in Netlify DNS, including the root mailbox routing/config records required by GoDaddy.

GoDaddy later displayed:

**“Je e-mail is klaar voor gebruik.”**

This confirms GoDaddy/Microsoft 365 accepted the DNS setup for the mailbox configuration.

The owner also stated that the mailbox test step had already been performed. Do not restart mailbox/DNS setup from scratch unless a new delivery problem is observed.

### Resend DNS

Existing Resend/Amazon SES DNS is on the dedicated mail subdomain and must remain separate from the Microsoft 365 root mailbox records.

Resend domain currently shown in the Resend account:

`mail.legendmural.com` — **Verified**

Do not delete or replace the existing Resend DKIM/SPF/MX subdomain records when working on Microsoft 365 root mail records.

---

## 8. Resend account state

A Resend account exists and is managed using the ALKA Visuals account/login. LegendMural does **not** require a second separate Resend account merely because its sending domain is different.

The verified sending domain inside that account is:

`mail.legendmural.com`

Earlier `Hello World` Resend tests were visible in the account and showed `Opened` to the ALKA Visuals mailbox.

No new paid subscription or separate LegendMural Resend account is required by the current architecture.

---

## 9. Netlify Production email environment configuration — completed and intentionally OFF

These values were manually reviewed/configured in Netlify. Secret values are intentionally not recorded here.

### `RESEND_API_KEY`

- exists;
- marked secret;
- value present in **Production only**;
- Deploy Previews: empty;
- Branch deploys: empty;
- Preview Server & Agent Runners: empty;
- Local development (Netlify CLI): empty;
- scopes shown: Builds, Functions, Runtime.

### `RESEND_FROM`

Known intended Production value was deliberately overwritten with:

`LegendMural <orders@mail.legendmural.com>`

Reason: `mail.legendmural.com` is the verified Resend sending domain.

Deployment exposure:

- Production only;
- preview/branch/local contexts empty;
- scopes shown: Builds, Functions, Runtime.

### `RESEND_REPLY_TO`

Production value was deliberately overwritten and visually verified as exactly:

`info@legendmural.com`

No display-name wrapper or extra text.

Deployment exposure:

- Production only;
- preview/branch/local contexts empty;
- scopes shown: Builds, Functions, Runtime.

### `ORDER_NOTIFICATION_TO`

Visually verified as exactly:

`info@legendmural.com`

It currently has the same value across all Netlify deploy contexts. This is not itself a secret. It does not enable mail because the kill-switch and Resend credential exposure remain restrictive.

### `ORDER_EMAILS_ENABLED`

Now configured as **different value per deploy context** with every context explicitly set to:

`false`

Confirmed contexts:

- Production: `false`
- Deploy Previews: `false`
- Branch deploys: `false`
- Preview Server & Agent Runners: `false`
- Local development (Netlify CLI): `false`

This is intentional. Later activation must change **Production only** to `true` at the approved controlled test point.

### Current email activation truth

**Paid-order email delivery is intentionally disabled everywhere right now.**

Do not set `ORDER_EMAILS_ENABLED=true` during ordinary configuration/review work.

No deliberate Netlify Production deploy was performed during these environment-variable edits.

---

## 10. What is now complete vs still unproven

### Complete

- notification DB/store repository work;
- merchant/customer email templates;
- Resend notifier;
- paid/live guards;
- DB + Resend idempotency protections;
- capture + webhook runtime integration on `main`;
- Production Neon migrations 009/010;
- Microsoft 365/GoDaddy mailbox DNS setup accepted;
- Resend sending domain `mail.legendmural.com` Verified;
- Netlify Resend/merchant recipient environment configuration reviewed;
- kill-switch split by deploy context and explicitly `false` everywhere.

### Still not proven

- exact currently deployed Netlify Production commit/runtime;
- current `main` released to Netlify Production;
- original mobile Safari Production symptom absent on the actual release candidate;
- Production paid-order email delivery with `ORDER_EMAILS_ENABLED=true`;
- one real merchant paid-order email from the new runtime;
- one real customer confirmation from the new runtime;
- duplicate prevention under actual capture + webhook timing;
- one complete controlled PayPal Live order from checkout through funds + Neon + order-status + both emails.

---

## 11. Required final controlled Live-order proof

For exactly one controlled real PayPal Live order, eventually verify:

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
12. capture + webhook do not create duplicate merchant/customer mail.

Only after this may the paid-order path be considered proven end-to-end.

---

## 12. Release sequence from this point

### Step E1 — next single step: read-only release readiness check

Do **not** deploy yet.

Fresh-check:

- exact current `main` SHA;
- current main CI/workflow status;
- exact currently deployed Netlify Production runtime if it can be proven safely;
- release delta/scope between Production and `main`;
- whether the real-device iPhone Safari release gate has been completed for the intended release candidate;
- that PR #144 is not accidentally bundled/merged as unrelated scope.

Return a release recommendation only. No repository mutation, Netlify deploy, Resend activation or PayPal transaction during this step.

### Step E2 — real-device/release approval if still needed

If the iPhone Safari gate is still outstanding, validate the intended release candidate before Production publication:

- Street + Number remains stable while typing;
- no `VALIDATING ADDRESS...` dependency;
- no unexpected sticker-page navigation;
- checkout reaches the expected payment handoff behavior.

### Step F — one controlled Netlify Production release

Only after explicit approval, publish the exact approved repository version.

Do not spend multiple deploy/update points on intermediate experiments.

Perform safe Production smoke checks before the real payment.

### Step G — controlled email activation + one PayPal Live order

At the approved point:

- change **Production only** `ORDER_EMAILS_ENABLED` from `false` to `true`;
- ensure the activation is applied to the intended Production runtime;
- perform exactly one controlled PayPal Live order;
- verify the full checklist in section 11.

Do not enable previews/branches/local contexts.

---

## 13. Work deliberately deferred

Do not mix these into the current paid-order email/release track without explicit authorization:

- About Us narrative redesign;
- social-link work;
- broader contact-form Production validation;
- withdrawal end-to-end validation;
- Neon least-privilege cleanup for the broad `legendmural_netlify` membership;
- LegendMural Dashboard work in `ALKAVisuals/legendmural-dashboard`.

The dashboard repository is a separate project. Do not switch to it because old dashboard screenshots/chat history are present.

---

## 14. Immediate instruction for a new chat

1. Read this file completely.
2. Confirm the user is working on the **public LegendMural webshop**, not the dashboard.
3. Fresh-check current `main` before any claim about repository state.
4. Do **only Step E1: read-only release readiness check**.
5. Do not recreate DNS/mailbox/Resend setup.
6. Do not re-run Neon migrations 009/010.
7. Do not set `ORDER_EMAILS_ENABLED=true`.
8. Do not deploy Netlify Production.
9. Do not run a PayPal Live transaction yet.
10. After Step E1, report the next single action and stop.
