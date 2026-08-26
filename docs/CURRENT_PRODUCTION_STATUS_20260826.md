# LegendMural current production status — checkout + paid-order email handoff

Updated: 26 August 2026, evening

This is the current operational handoff for the LegendMural production track. It supersedes `docs/CURRENT_PRODUCTION_STATUS_20260825.md` as the preferred starting point for the next chat, while the older document remains useful historical context.

This document records **verified project state, architectural decisions, release constraints and next actions**. It deliberately does not contain secrets and it does not expose private reasoning. The rationale sections explain the engineering decisions that must be preserved.

---

## 1. Project and release boundaries

- Repository: `ALKAVisuals/legend-stories-website`
- Production host: Netlify
- Public origin: `https://legendmural.com`
- Database: Neon Postgres
- Launch payment provider: PayPal Live
- Transactional email provider: Resend
- Official LegendMural contact identity: `info@legendmural.com`
- GitHub Pages preview: `https://alkavisuals.github.io/legend-stories-website/`

### Current repository runtime baseline

The latest runtime-code-changing `main` commit before this documentation-only handoff is:

`370c873c3fec88abea6b0fd1ec4d2983e1491ea0`

This is the merge commit for PR #141 — **Add guarded paid-order email delivery layer**.

Post-merge GitHub Actions on exact `370c873c...` are now confirmed green:

- Accessibility and purchase-flow audit — success
- Quality checks / Quality gate — success

The earlier temporary observation that post-merge checks had not appeared was caused by delayed GitHub Actions registration, not by a code failure.

### Production is intentionally behind `main`

Do **not** assume that current `main` is already served by Netlify Production.

The last positively supportable Production runtime from the checkout investigation was `c1345f22489bf9f8259c55e6432ef4c247c0153` (PR #123 era). The exact currently published Netlify runtime has not been freshly re-proven in this handoff step.

Do not blindly publish all of `main` as a small email fix. The production-to-main gap contains multiple frontend, checkout, post-checkout, contact-form and backend changes. Release scope must remain deliberate.

---

## 2. Mandatory working method

Work strictly one step at a time.

After every completed step report:

1. what was changed or checked;
2. the result;
3. what was deliberately not changed;
4. how the result was verified;
5. the next **single** step.

Before any repository mutation, fully read this handoff document. Also consult the older `docs/CURRENT_PRODUCTION_STATUS_20260825.md` when historical production context is needed.

Do not publish a newer frontend/runtime bundle to Netlify Production until the owner has approved the relevant safe preview/release scope.

---

## 3. Security and payment truth boundaries

These rules are non-negotiable:

- Never commit, print or request `PAYPAL_CLIENT_SECRET`.
- Never commit, print or request a full Neon connection string/password.
- Never commit, print or request `RESEND_API_KEY`.
- Do not dump full environment objects or customer payloads into logs.
- Do not globally disable secret scanning.
- GitHub Pages is static/visual only. Never use it to validate PayPal Live, Neon or Netlify Functions.
- Preview/test environments must never accidentally use PayPal Live credentials.
- A browser redirect or PayPal page opening is **not** proof of a completed payment.
- The UI may show `paid` only after the server-authoritative order state is verified as paid.
- Email delivery failure must never change a correctly persisted paid order back to failed/pending.

LegendMural is **not fully selling-ready** until one controlled PayPal Live order proves the full chain end-to-end.

---

## 4. Checkout blocker history and current repository solution

### Production problem observed on 25 August 2026

On mobile Safari the owner observed:

- Street input instability after the first characters (for example `sc`);
- the field appeared to jump/lose its stable typing state;
- `Continue to Payment` showed `VALIDATING ADDRESS...` for too long;
- checkout later navigated to an unexpected sticker product page;
- no expected paid confirmation was reached.

The unexpected/random product-page navigation remains an **open runtime symptom**. Do not claim that it is proven fixed merely because Google Places was removed.

### PR #135 — mobile checkout stabilization

Merged as:

`034a5f6fff61764edadde6ef55423428bda240ea`

Key result:

- mobile checkout controls use at least 16px text to avoid iOS Safari focus zoom;
- iPhone/WebKit regression coverage was added;
- test protects against Street/postal layout shift and unexpected product navigation in the harness.

### PR #137 — remove Google Places from the critical checkout path

Merged as:

`388981ca20518615ee743e003455edb664b5f7a1`

Architecture now:

- checkout no longer waits for Google Places validation;
- manual shipping address is authoritative;
- required fields are checked locally;
- email format is checked locally;
- selected shipping country must be enabled;
- Street + Number requires a lightweight digit/house-number sanity check;
- no strict global postal-code regex was introduced;
- after local validation checkout proceeds immediately to `processOrder()`;
- iOS 16px stabilization remains in place;
- Google API usage for unrelated Sticker Fact / Knowledge Graph functionality was deliberately retained.

### Why this design was chosen

Address suggestions are convenience functionality, not payment truth. They should not block a customer from reaching hosted payment. Removing Google Places from the critical checkout path eliminates a slow/failure-prone dependency while preserving basic local input safety.

Do not reintroduce external address-validation latency into the critical payment path without a new explicit architecture decision.

### GitHub Pages validation state

GitHub Pages was safely refreshed after PR #137 to preview commit:

`6b33620a6976227cb08465645737ca820d18abee`

The Pages workflow succeeded for that exact commit.

A Pages checkout screenshot showed the expected static fallback:

`Order ready. Secure online payment is not enabled on this deployment yet.`

That indicates the local checkout path reached order processing without hosted payment, which is expected on Pages.

However, the screenshot also showed legacy helper text (`Address entered manually because suggestions are unavailable.`) that no longer exists in the current repository. The leading explanation is stale browser/CDN cache, but a fresh/private actual iPhone Safari validation is still the safest final visual/device proof.

Do not use Pages to test PayPal, Neon, Resend or Netlify Functions.

---

## 5. Existing order/payment architecture

The intended authoritative flow is:

`checkout -> durable Neon payment_pending order -> PayPal hosted checkout -> verified capture/webhook -> Neon paid`

The order record already contains the data needed for fulfilment and confirmation emails, including customer/address data, items, variants, quantities, discounts, shipping and totals.

Important data-unit detail discovered during email work:

- stored item `unitPrice` / `lineTotal` values are euro amounts;
- authoritative order `totals` / `amountTotal` values are cents.

Email formatting tests explicitly protect against rendering a €45.00 item as €0.45.

### Required eventual Live-payment proof

For one controlled real Live order verify all of the following:

1. checkout reaches PayPal Live;
2. payment completes;
3. return to LegendMural succeeds;
4. `capture-paypal-order` succeeds;
5. PayPal Live webhook receives the completed capture and returns HTTP 200;
6. Neon order becomes `paid`;
7. `/api/order-status` returns `paid`;
8. PayPal business account shows the funds;
9. merchant order email is received exactly once;
10. customer confirmation is received exactly once.

Only then can paid-order processing be considered proven end-to-end.

---

## 6. Paid-order email architecture — repository work completed

The user requested that a successfully paid order produce useful order information for both internal fulfilment and the customer.

Chosen responsibilities:

- **Neon** = authoritative order and notification-delivery state;
- **PayPal** = proof that payment happened;
- **Netlify Functions** = payment/runtime orchestration;
- **Resend** = transactional email delivery;
- **merchant inbox** = operational paid-order notification;
- **customer inbox** = branded order confirmation.

Netlify logs should contain only safe technical events/order references, not full customer addresses or secret-bearing payloads.

### PR #140 — durable notification store

Merged to `main` as:

`30c60566801680ad21160d8c96a84ed98ba1f2c1`

Added:

- `server/db/migrations/009_create_order_notifications.sql`
- `server/db/migrations/010_grant_order_notifications_runtime.sql`
- `server/db/neon-order-notification-store.mjs`
- notification-store regression tests

The store supports two notification types:

- `merchant_paid_order`
- `customer_paid_order`

Delivery lifecycle:

`pending -> sending -> sent`

or after a provider/runtime failure:

`sending -> failed -> retry/claim later`

The combination `order_reference + notification_type` is unique.

### Why the notification store is necessary

PayPal capture and PayPal webhook may both process the same real payment. Email must therefore not be implemented as a naïve `send email after capture` side effect.

The durable notification store provides a database-level claim/idempotency boundary so only one worker should deliver a given order-notification type at a time.

This is in addition to provider-level idempotency at Resend.

### PR #141 — guarded Resend paid-order layer

Merged to `main` as:

`370c873c3fec88abea6b0fd1ec4d2983e1491ea0`

Files added:

- `server/notifications/paid-order-notifications.mjs`
- `server/notifications/resend-paid-order-notifier.mjs`
- `tests/paid-order-notifications.test.mjs`
- `tests/resend-paid-order-notifier.test.mjs`

Implemented and tested:

- `ORDER_EMAILS_ENABLED` kill-switch;
- only `status === paid` orders may enter delivery;
- only `mode === live` orders may enter delivery;
- merchant and customer deliveries are independent;
- a missing merchant recipient does not suppress the customer confirmation;
- database notification claim prevents duplicate processing;
- Resend uses a stable idempotency key per `order + notification type`;
- email delivery rejection is recorded as notification failure, not payment failure;
- HTML customer/order data is escaped;
- item euro amounts and order cent totals render correctly;
- merchant template includes operational order/customer/shipping/product/total details;
- customer template includes a customer-friendly order summary and PayPal Order ID;
- Resend provider response details are not leaked through public error messages.

PR #141 was green before merge, including Quality gate, accessibility audit and iPhone WebKit checkout regression.

Post-merge exact `main` `370c873c...` is also green for Quality checks and Accessibility audit.

### Important: email feature is NOT active in Production yet

Repository support exists, but the delivery layer is intentionally **not wired into the live payment functions yet**.

Still not done:

- PayPal capture function does not yet call the paid-order notification orchestrator;
- PayPal webhook does not yet call the paid-order notification orchestrator;
- Neon migrations 009/010 have not been executed against Production Neon;
- `ORDER_NOTIFICATION_TO` has not been configured for Production;
- `ORDER_EMAILS_ENABLED=true` has not been activated for Production;
- current `RESEND_FROM` / `RESEND_REPLY_TO` / sending-domain readiness for paid-order mail has not been freshly proven;
- no real paid-order Resend email has been sent through this new layer;
- no real merchant/customer email pair has been end-to-end verified.

---

## 7. Intended merchant and customer emails

### Merchant paid-order notification

Purpose: give LegendMural enough information to fulfil a paid order without relying on Netlify logs.

Expected contents:

- PAID status;
- paid timestamp;
- internal LegendMural reference;
- PayPal Order ID;
- customer name and email;
- complete shipping address;
- shipping country/zone;
- product/sticker name;
- SKU;
- variant (Compact / Statement);
- size;
- quantity;
- item price and line total;
- discount code/amount when applicable;
- shipping cost;
- total paid.

Proposed Production recipient is configured through `ORDER_NOTIFICATION_TO`, not hard-coded in GitHub.

### Customer confirmation

Purpose: clearly confirm that a verified paid order has been received.

Expected contents:

- confirmation that payment was received;
- PayPal Order ID;
- LegendMural reference;
- purchased products/variants/quantities;
- subtotal/discount/shipping/total;
- shipping address;
- instruction to reply quickly if address details are wrong.

The merchant and customer emails are deliberately separate templates.

---

## 8. Correct next implementation sequence

The next chat should **not** jump directly to Production or a real PayPal payment.

### Step A — read-only runtime integration analysis

Inspect the current exact `main` implementations of:

- `capture-paypal-order`;
- `paypal-webhook`;
- Neon paid-order persistence/read-back;
- `neon-order-notification-store.mjs`;
- `paid-order-notifications.mjs`;
- `resend-paid-order-notifier.mjs`.

Determine the smallest shared integration point(s) after the order has been authoritatively persisted as `paid`.

Key requirement: both capture and webhook may attempt notification delivery, but database/provider idempotency must guarantee no duplicate merchant/customer mail.

### Step B — wire paid-order notifications on a new branch + tests

Add the runtime integration with the kill-switch defaulting safe/off unless explicitly enabled by environment configuration.

Test at minimum:

- capture path after verified paid persistence;
- webhook path after verified paid persistence;
- same order processed through capture + webhook does not duplicate either mail;
- email failure does not change paid truth or produce a false payment failure;
- disabled switch performs no notification-store/provider work;
- non-live/non-paid orders cannot email;
- logs do not contain full customer payloads or secrets.

Merge only after green CI.

### Step C — Production Neon notification migrations

Only after repository integration is ready, execute migrations:

- `009_create_order_notifications.sql`
- `010_grant_order_notifications_runtime.sql`

Verify schema/grants without exposing connection strings, passwords or customer rows.

### Step D — Production email configuration

Configure/verify, without sharing values in chat:

- `RESEND_API_KEY` exists;
- `RESEND_FROM` uses a verified LegendMural sending identity/domain;
- `RESEND_REPLY_TO` is correct;
- `ORDER_NOTIFICATION_TO` points to the intended merchant operational inbox;
- keep `ORDER_EMAILS_ENABLED` disabled until the approved controlled activation point.

Also separately verify that `info@legendmural.com` can actually receive/reply to mail. Website display identity alone is not mailbox proof.

### Step E — release-scope / device approval before Production

Before publishing current `main` or a release branch:

- confirm the exact approved release scope;
- perform/finalize fresh/private iPhone Safari checkout validation if still outstanding;
- ensure no `VALIDATING ADDRESS...` Google dependency appears;
- ensure Street + Number remains stable while typing;
- ensure no unexpected sticker-page navigation occurs in the tested flow;
- remember that GitHub Pages cannot prove backend email/payment behavior.

### Step F — controlled Netlify Production release

Publish only the explicitly approved repository version.

Do not combine unrelated unapproved changes merely because they are present on `main`.

Perform safe Production smoke checks before a real payment.

### Step G — one controlled PayPal Live order

Enable paid-order emails at the controlled point and verify the entire payment + database + email chain listed in section 5.

Expected email outcome for one paid order:

- exactly one `merchant_paid_order` delivery;
- exactly one `customer_paid_order` delivery;
- no duplicate mail if both capture and webhook process the payment.

---

## 9. Open blockers / unresolved proof

Keep these explicitly open:

1. **Unexpected product navigation:** exact Production trigger from the 25 August mobile failure remains unexplained. Repository WebKit tests are useful but are not proof of the original Production trigger being gone.
2. **Fresh real-device preview proof:** a fresh/private actual iPhone Safari run is still preferable because a prior Pages screenshot showed legacy cached helper text.
3. **Exact Netlify Production runtime:** must be re-confirmed before publishing/validating a new release.
4. **Production notification migrations:** 009/010 not yet executed.
5. **Runtime PayPal -> notification integration:** not yet built.
6. **Resend production readiness for paid-order mail:** not yet end-to-end proven.
7. **Mailbox receiving:** `info@legendmural.com` receiving/forwarding remains unproven.
8. **Controlled real PayPal Live transaction:** still required.
9. **Withdrawal flow:** must later be validated with a real valid order; do not weaken verification to make fake data pass.

---

## 10. Work deliberately deferred from this email track

Do not mix these into the paid-order email implementation unless the owner explicitly changes priorities:

- About Us full narrative redesign;
- adding official YouTube/Facebook links;
- broader contact-form Production validation;
- withdrawal end-to-end validation;
- dashboard work in separate repository `ALKAVisuals/legendmural-dashboard`.

Known official social URLs for later use:

- YouTube: `https://youtube.com/@legendstories_official?si=UhNqTXzb6XWWHFFX`
- Facebook: `https://www.facebook.com/share/197TDKP6RC/?mibextid=wwXIfr`

Do not invent social handles.

---

## 11. Progress snapshot (approximate, not a release gate)

### Paid-order email track

- Durable notification database/store code: 100% repository work
- Merchant/customer templates + Resend notifier: 100% repository work
- Kill-switch / paid+live guards / idempotency tests: 100% repository work
- Runtime capture/webhook integration: 0%
- Production Neon migrations/config: 0%
- Real paid-order email validation: 0%

Overall paid-order email track: approximately **60–65%** complete.

### Overall technical launch readiness

Approximate current technical launch readiness: **~75%**.

This number is only a planning estimate. It does **not** override the launch gates. The remaining work includes high-value Production proof, so LegendMural must still be treated as not fully selling-ready.

---

## 12. Immediate next single step for the next chat

**Read this entire document first. Then perform only Step A: read-only runtime integration analysis for the paid-order email layer.**

Do not mutate code, Neon, Netlify or Resend during that first step.

The goal of Step A is to return a precise integration plan showing:

- exact files/functions to change;
- exact point after authoritative `paid` persistence where notifications should be attempted;
- how both capture and webhook safely share the notification path;
- how errors remain non-fatal to payment truth;
- which tests must be added;
- the next single implementation step.

Only after that analysis is reviewed should repository mutation resume.
