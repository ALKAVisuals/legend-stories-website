# LegendMural — exact next-chat start state

Updated: 26 August 2026

This document exists to prevent the next chat from confusing **GitHub Pages preview behavior**, **repository test behavior** and **real Netlify Production payment behavior**.

It is a companion to:

1. `docs/CURRENT_PRODUCTION_STATUS_20260826.md`
2. `docs/LAUNCH_READINESS_PROGRESS_20260826.md`

The next chat must read all available current handoff material before repository mutation.

---

## 1. Current authoritative repository state

Repository:

`ALKAVisuals/legend-stories-website`

Current `main`:

`b0911828f29e4d2e77259f250553706052931f9b`

This is PR #142, a documentation-only merge.

Latest runtime-code-changing baseline on `main`:

`370c873c3fec88abea6b0fd1ec4d2983e1491ea0`

This is PR #141, the guarded paid-order email delivery layer.

Do **not** assume current `main` is the exact code currently served by Netlify Production. Production release scope still requires deliberate confirmation.

---

## 2. Critical environment distinction — GitHub Pages cannot perform the real payment flow

GitHub Pages is a **static/visual preview only**.

It does not provide the real Netlify Functions / Production backend path needed for:

- PayPal Live order creation/capture;
- Neon Production persistence;
- PayPal webhook reconciliation;
- Resend paid-order delivery.

Therefore this Pages message is **expected and correct**:

`Order ready. Secure online payment is not enabled on this deployment yet.`

Do **not** classify that message as a PayPal defect.

On GitHub Pages the useful checkout proof is limited to frontend/static behavior such as:

- cart and checkout UI open correctly;
- address fields are stable;
- local required-field/address checks work;
- checkout does not re-enter the removed `VALIDATING ADDRESS...` Google Places wait state;
- the interaction does not unexpectedly navigate to a sticker product page;
- the static no-payment fallback appears.

Real payment truth can only be established later through the approved Netlify Production runtime and one controlled PayPal Live order.

---

## 3. What the controlled Production payment must eventually prove

After the approved release is live on Netlify Production, exactly one controlled PayPal Live transaction must prove:

1. checkout creates the real PayPal Live order;
2. payment completes at PayPal;
3. return to LegendMural succeeds;
4. server capture succeeds;
5. PayPal completed-capture webhook is received and acknowledged;
6. Neon authoritative order becomes `paid`;
7. `/api/order-status` reports `paid`;
8. funds are visible in the PayPal business account;
9. exactly one merchant paid-order email is delivered;
10. exactly one customer paid-order confirmation is delivered.

A Pages fallback or a PayPal page merely opening is not sufficient proof.

---

## 4. Current paid-order email status

Already merged to `main`:

- PR #140 — durable Neon order-notification store + migrations 009/010;
- PR #141 — guarded merchant/customer Resend notification layer.

Already implemented in repository code:

- merchant paid-order template;
- customer paid-order template;
- `paid + live` guards;
- `ORDER_EMAILS_ENABLED` kill switch;
- durable per-order/per-notification claim state;
- provider idempotency;
- correct item-euro vs order-cent formatting;
- HTML escaping;
- email provider failure isolated from payment truth.

Still **not** implemented/activated in Production:

- capture path -> paid-order notification reconciliation;
- webhook path -> same reconciliation;
- duplicate capture+webhook integration proof;
- Production execution of Neon migrations 009/010;
- Production `ORDER_NOTIFICATION_TO` setup;
- paid-order Resend Production readiness proof;
- `ORDER_EMAILS_ENABLED=true` activation;
- real merchant/customer delivery proof.

---

## 5. Original launch-readiness work is still active

Paid-order email was inserted as an intermediate priority; it did not replace the earlier launch list.

Still open after the email integration work:

- fresh/private real iPhone Safari checkout validation;
- keep the earlier unexpected/random product-page navigation symptom open until Production evidence is sufficient;
- freshly reconfirm exact Netlify Production runtime;
- determine deliberate release scope instead of blindly publishing all of `main`;
- obtain owner visual/release approval;
- publish only the approved version;
- run Production checkout + Netlify Forms smoke tests;
- perform the single controlled PayPal Live order and all payment/database/email truth checks;
- later validate withdrawal using a real paid order;
- close the formal go/no-go checklist only with runtime evidence.

Deferred but not cancelled:

- About Us premium rebuild;
- official YouTube/Facebook links;
- broader mailbox/contact validation.

---

## 6. Current documentation PR #143

PR #143 — `Document detailed launch-readiness progress` — is open and documentation-only.

It contains:

- `docs/LAUNCH_READINESS_PROGRESS_20260826.md`;
- `docs/NEXT_CHAT_START_20260826.md`.

The PR itself does not change checkout/runtime code.

On the previously verified head `8c5045ce1ccdc96732337c17a84f483e97a632fd`, all three GitHub Actions checks were green:

- `Quality gate` — success;
- `Static accessibility inventory` — success;
- `iPhone WebKit checkout regression` — success.

Earlier WebKit runs on the same documentation PR had failed while waiting for the seeded cart counter to become `1`, before the actual checkout/payment-fallback assertions were reached. That remains useful evidence of intermittent harness instability, but the later green run removed the original CI blocker for PR #143.

Because this handoff itself is being updated, verify the **fresh current PR #143 head** and its new CI result before merging. Do not merge until that new exact head is green.

The green WebKit result on PR #143 is repository regression evidence only; it does not prove that the original Production random-navigation symptom is solved.

---

## 7. Separate WebKit test-harness experiment branch / PR #144

A separate non-authoritative experiment branch exists:

`test/webkit-cart-seeding-hardening-20260826`

Observed head before this documentation refresh:

`b8fef4a3ea991674ebf814cefcccde872d51a965`

Compared with `main`, its net change is limited to:

`tests/browser/mobile-checkout-webkit.mjs`

The experiment replaces the older `addInitScript` cart seed with Playwright `storageState`, validates the seeded localStorage explicitly and captures browser/page/request diagnostics.

Important:

- it is **not merged**;
- it is **not Production code**;
- it must not be described as a checkout fix;
- it exists only to make the WebKit test harness more deterministic/diagnostic;
- its current Quality and Accessibility checks are green;
- its current iPhone WebKit checkout regression check is red;
- therefore PR #144 is currently `unstable` and must not be merged as a prerequisite for PR #143.

Because PR #143 has already produced a later green WebKit result without PR #144, the hardening branch is not required to unblock the documentation handoff. Its own failure should be understood separately before any future merge decision.

---

## 8. Exact recommended next action

First finish the GitHub handoff cleanly:

1. verify the fresh current PR #143 head after these documentation-only updates;
2. require green Quality, Accessibility and iPhone WebKit checks on that exact head;
3. if those checks are green, PR #143 can be merged as documentation-only work;
4. keep PR #144 separate and unmerged while its WebKit check remains red.

After PR #143 is safely finalized, the next **technical** action is a read-only analysis of the paid-order runtime integration.

Inspect at minimum:

- `netlify/functions/capture-paypal-order.mjs`;
- `server/api/capture-paypal-order.mjs`;
- capture persistence/read-back;
- `netlify/functions/paypal-webhook.mjs`;
- webhook reconciliation/store;
- Neon order read-back;
- Neon order-notification store;
- `server/notifications/paid-order-notifications.mjs`;
- `server/notifications/resend-paid-order-notifier.mjs`;
- commerce/runtime dependency composition.

Goal:

find the smallest safe shared boundary after authoritative `paid` persistence where both capture and webhook can reconcile merchant/customer notifications without duplicates.

Explicitly analyse the already-paid/early-return path: a duplicate capture request must not permanently skip a previously failed notification.

During that technical analysis:

- do not modify code;
- do not execute Neon migrations;
- do not change Netlify environment variables;
- do not enable Resend paid-order delivery;
- do not deploy Production;
- do not run a real PayPal Live transaction.

After the read-only analysis, report exact files/functions, risks, tests and only the next single implementation step, then wait for owner approval.

---

## 9. Required working style for the next chat

Work strictly one step at a time.

After every step state:

1. what was checked/changed;
2. result;
3. what was deliberately not changed;
4. how it was verified;
5. the next single step.

Before each repository mutation, re-read the current production handoff.

Never request or expose PayPal, Neon or Resend secrets.

Never deploy a newer runtime to Netlify Production without explicit owner approval of the exact release scope.
