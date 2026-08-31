# LegendMural current production status — Phase F release handoff

**Updated:** 31 August 2026  
**Repository:** `ALKAVisuals/legend-stories-website`  
**Production host:** Netlify  
**Temporary release-candidate preview:** `https://alkavisuals.github.io/legend-stories-website/`

> **START HERE FOR THE NEXT CHAT.** This file is the current operational handoff for the public LegendMural webshop release. Older handoffs are historical context only. Always fresh-check `main` before any repository mutation or Production action.

This handoff contains no passwords, API keys, full database connection strings or customer payloads.

---

## 1. Scope and working method

This track concerns only the public LegendMural webshop in:

`ALKAVisuals/legend-stories-website`

Do not switch to the separate dashboard repository or V3 implementation work unless the owner explicitly changes topic.

Working rules:

1. work one meaningful step at a time;
2. fresh-check exact `main` before repository mutations;
3. use a branch, never direct `main`;
4. inspect CI before merge;
5. do not bundle unrelated branches/PRs;
6. do not change Netlify Production, PayPal Live, Neon production state or email activation outside the explicitly approved release step.

---

## 2. Current release baseline

The last fresh-checked `main` immediately before this documentation update was:

`d02d7101bb9b4d51f3d4e25b28d2e7f162d180be`

Commit:

`Merge pull request #156 from ALKAVisuals/docs/predeploy-handoff-20260831`

The storefront/runtime release code in that commit is unchanged from the approved release-code baseline:

`c5d6dc0b5a597a8dba5f20120196e67ca389517f`

Changes after `c5d6dc0...` up to `d02d710...` are documentation-only. Therefore the current storefront runtime candidate remains the already-reviewed release code.

Because this file itself is being updated through a documentation PR, do not assume the SHA above remains the latest `main` after merge. Fresh-check `main` again immediately before the Netlify Production build and record that exact SHA as the deploy target.

---

## 3. Pre-release website work — complete

Completed and accepted before the Netlify cutover:

- mobile-navigation build fix;
- real iPhone Safari hamburger confirmation;
- current GitHub Pages release-candidate refresh;
- About page redesign;
- confirmed paid-order success experience;
- server-authoritative paid UI/cart policy reverified;
- About source smoke test;
- paid-order source/runtime smoke test;
- post-fix automated iPhone/WebKit checkout regression;
- relevant release CI green;
- final repository/pre-deploy blocker audit completed.

The real iPhone Safari checkout/address issue remains considered resolved. Do not repeat the same investigation unless new regression evidence appears.

Payment truth remains server-authoritative. A browser URL or local state must never manufacture `paid`.

---

## 4. Current Netlify build/runtime contract

Current `netlify.toml` uses:

- build command: `npm run build && node scripts/generate-commerce-runtime-config.mjs`;
- publish directory: `dist`;
- functions directory: `netlify/functions`.

Current public API routes include:

- `/api/paypal/checkout`;
- `/api/paypal/capture`;
- `/api/paypal/webhook`;
- `/api/order-status`.

Canonical public origin is intended to be:

`https://legendmural.com`

PayPal Live remains guarded by `PAYPAL_ALLOW_LIVE=true`; without that explicit flag, the live PayPal API origin is rejected by the runtime.

---

## 5. Netlify Production environment review — complete by owner confirmation

On 31 August 2026, the Netlify Environment Variables list was reviewed from owner-provided screenshots.

The expected variable names were present, including:

- `CHECKOUT_ALLOWED_ORIGINS`;
- `CHECKOUT_CANCEL_URL`;
- `CHECKOUT_SUCCESS_URL`;
- `NEON_DATABASE_URL`;
- `ORDER_EMAILS_ENABLED`;
- `ORDER_NOTIFICATION_TO`;
- `PAYPAL_ALLOW_LIVE`;
- `PAYPAL_API_BASE`;
- `PAYPAL_CLIENT_ID`;
- `PAYPAL_CLIENT_SECRET`;
- `PAYPAL_WEBHOOK_ID`;
- `RESEND_API_KEY`;
- `RESEND_FROM`;
- `RESEND_REPLY_TO`.

The visible scopes were reviewed where shown. The owner then explicitly confirmed that the actual configured values are correct and requested no further value-by-value inspection.

Therefore:

- treat the Production environment configuration as owner-confirmed for this release;
- do not ask the owner to expose secret values;
- do not reopen this check without new failure evidence.

`LEGENDMURAL_CHECKOUT_PAUSED` is optional in the current code; absence means checkout is not paused.

---

## 6. Phase F decision — approved to proceed

The owner has explicitly approved proceeding to the Netlify Production update after completion of the pre-release checks.

Important current state:

- automatic Netlify updates had been disabled by the owner;
- therefore Netlify cannot show/build the newest `main` until deployment is re-enabled or a new deploy is triggered;
- no successful new Production deploy has yet been confirmed in this handoff;
- do not claim the current release is live until the Production deploy and smoke test are verified.

Before the cutover, capture or note the currently live Netlify Production deploy as the rollback reference if practical.

---

## 7. Exact next step — Netlify Production cutover

Proceed one step at a time:

1. fresh-check current `main` again;
2. record the exact SHA that will be deployed;
3. re-enable/trigger one Netlify Production build from `main`;
4. wait for the Production deploy to succeed;
5. verify the deployed build corresponds to the expected release SHA/content;
6. perform safe Production smoke tests without making a real payment first.

Initial Production smoke tests should cover at least:

- homepage and navigation;
- About page;
- shop/product/cart flow;
- checkout page rendering and address input;
- success/cancel routes;
- Netlify Functions availability;
- same-origin API routing/CORS behavior;
- Neon-backed order-status/runtime connectivity where safely testable without a real payment.

If the Production deploy fails or the live site regresses, stop and use the previous Production deploy as the rollback point. Do not proceed to PayPal Live.

---

## 8. Phase G — only after Production smoke approval

After the Production runtime itself is approved:

1. enable the required Production-only email/live-payment settings at the controlled proof point;
2. perform exactly one controlled PayPal Live order;
3. verify PayPal capture + webhook;
4. verify Neon order `paid`;
5. verify `/api/order-status` returns authoritative `paid`;
6. verify exactly one merchant email;
7. verify exactly one customer email;
8. verify no duplicate delivery under capture + webhook timing;
9. verify order/customer/product/shipping/total information;
10. verify funds in the PayPal business account.

Only then is the complete paid-order path proven end-to-end.

---

## 9. Critical commerce invariants

Preserve all of these:

- Neon is authoritative order truth;
- PayPal is payment proof;
- capture and webhook may both attempt processing safely;
- duplicate/retry handling must remain idempotent;
- notification/email failure must never regress a persisted paid order;
- no browser state may manufacture `paid`;
- do not expose secrets or customer payloads.

---

## 10. Branch/PR hygiene as of 31 August 2026

A fresh branch listing showed 21 branches. Most are historical feature, test, preview, audit or documentation branches left behind after earlier work. Their existence does **not** mean 21 active website versions are being developed.

Current open PRs found during this check:

- PR #153 — V3 Gate 2 foundation; separate V3 work, do not bundle into this website release;
- PR #144 — test-only WebKit cart-seeding hardening; do not auto-merge;
- PR #139 — historical paid-order notification-state PR, superseded by later work for this release;
- PR #119 — historical checkout-address-validation PR, superseded by later work for this release.

Special branches to preserve unless separately reviewed:

- `main` — canonical source branch;
- `gh-pages` — temporary static release-candidate preview;
- V3 branches — outside this release scope;
- any branch attached to an open PR — do not delete automatically.

Branch cleanup is a separate maintenance task and is not required for the Netlify cutover.

---

## 11. Immediate instructions for the next chat

1. Read this file first.
2. Confirm scope remains the public webshop repository.
3. Fresh-check current `main`.
4. Do not mix dashboard or V3 implementation work into this release.
5. Treat the pre-release website audit as complete unless new evidence appears.
6. Treat Netlify Production environment values as owner-confirmed; do not request secrets again.
7. The owner has approved proceeding to the Netlify Production update.
8. The next operational task is the controlled Netlify cutover and Production smoke test.
9. Do not run PayPal Live or the final email proof before the Production smoke test passes.
10. Record the final deployed SHA and Production result back into this handoff after the cutover is actually verified.
