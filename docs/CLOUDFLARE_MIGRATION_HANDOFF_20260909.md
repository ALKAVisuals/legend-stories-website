# LegendMural Cloudflare migration — current handoff

**Date:** 2026-09-09  
**Repository:** `ALKAVisuals/legend-stories-website`  
**Migration scope:** Netlify -> Cloudflare for the public LegendMural storefront only  
**Starting `main` SHA for this handoff:** `ec777925b34b65a91877e5f831f880ec666edb0b`

> This is the canonical continuation document for the active Cloudflare migration. A new chat working on this migration must read this file before reconstructing progress from older chat history.

## Non-negotiable scope boundaries

- `legendmural.com` production is still on Netlify until an explicit final cutover is approved.
- Technisch Bouwadvies stays on Netlify and must not be changed by this migration.
- `ALKAVisuals/legendmural-dashboard` stays hosted through ChatGPT Sites; only migration-required integration points may be touched.
- Neon remains the database unless a separately approved migration says otherwise.
- Existing PayPal, Resend and Neon secrets must never be copied into GitHub documentation or source.
- No PayPal Live activation, DNS cutover, production Cloudflare cutover or production data mutation without explicit owner approval for that exact step.

## What is already done

### Migration foundation

The repository already contains the Cloudflare migration notice, target architecture/migration plan, environment/secret map, preview-account proof, B2 checkout decision map and cutover/rollback checklist. These documents remain supporting evidence; this handoff records the newest continuation state.

### Cloudflare preview runtime

- A Cloudflare preview Worker exists for LegendMural.
- Static assets are bound to the Worker.
- The preview runtime has an R2 binding for V3 invoice PDFs.
- The preview PayPal webhook endpoint is the Worker route `/api/paypal/webhook`.

### PayPal sandbox configuration and webhook verification

A PayPal Sandbox webhook is configured for the Cloudflare preview endpoint with the required checkout/payment events.

During validation, the first Cloudflare webhook attempts returned HTTP `401`. Investigation showed that the Cloudflare `PAYPAL_WEBHOOK_ID` runtime secret did not match the PayPal webhook configured for the Cloudflare preview endpoint.

The owner corrected `PAYPAL_WEBHOOK_ID` in Cloudflare and deployed that secret change. After that correction, a PayPal Sandbox resend reached the Cloudflare Worker and returned HTTP `200`.

This proves that:

- PayPal can reach the Cloudflare preview Worker;
- the endpoint URL is correct;
- the webhook signature-verification path can succeed with the corrected webhook ID;
- the previous `401` blocker is resolved.

Do not recreate the PayPal app or webhook merely because older failed delivery rows remain visible in PayPal.

## Current blocker discovered on 2026-09-09

A later resend of an already-seen `PAYMENT.CAPTURE.COMPLETED` event exposed a second issue in the duplicate-webhook path.

Cloudflare logged:

- `Verified PayPal webhook processing failed.`
- error name: `NeonPayPalWebhookStoreError`
- error code: `PAYPAL_WEBHOOK_STORE_UNAVAILABLE`

The resend itself is not the root cause. It is useful because it exercised the idempotent duplicate-delivery path that PayPal can legitimately use in production.

## Root-cause evidence in current `main`

`server/adapters/neon-paypal-webhook-store.mjs` currently performs the following duplicate-event flow inside a serializable transaction:

1. lock/read the matching order;
2. `INSERT` the PayPal webhook event with `ON CONFLICT (event_id) DO NOTHING`;
3. when the insert returns no row, read the already-stored webhook event;
4. that duplicate read currently ends with `FOR SHARE`;
5. compare the stored event identity and acknowledge the duplicate.

The canonical runtime privilege contract intentionally gives `legend_commerce.paypal_webhook_events` only:

- `SELECT`
- `INSERT`

It intentionally does **not** grant table-level `UPDATE` to that webhook-event ledger.

The real least-privilege runtime therefore conflicts with the duplicate read's `FOR SHARE` locking clause. This is the leading root cause for the observed `PAYPAL_WEBHOOK_STORE_UNAVAILABLE` on duplicate/resend processing.

### Important security decision

Do **not** fix this by broadly granting `UPDATE` on `paypal_webhook_events`.

The webhook-event table is designed as an append-only/idempotency ledger. The preferred minimal fix is to remove the unnecessary row-locking clause from the duplicate read while preserving the current `INSERT ... ON CONFLICT DO NOTHING` idempotency model.

## Existing test coverage and the gap

`tests/neon-paypal-webhook-store.test.mjs` already contains a unit test named approximately `duplicate event is acknowledged without a second order mutation`. It proves the intended application behavior with a mocked database client.

That test does not execute the query against a real least-privilege Neon role, so it did not catch the privilege conflict caused by `FOR SHARE`.

`tests/neon-runtime-privilege-contract.test.mjs` separately protects the least-privilege contract and confirms that `paypal_webhook_events` is expected to have `SELECT` + `INSERT`, not broad `UPDATE`.

The missing protection is a regression proof that the duplicate PayPal webhook path actually works under the real least-privilege runtime contract.

## Exact next step

The next technical action is a minimal code/test PR. Do not make unrelated changes.

1. Fresh-check the current `main` SHA.
2. Create a dedicated branch from that fresh `main`.
3. In `server/adapters/neon-paypal-webhook-store.mjs`, remove `FOR SHARE` from the duplicate-event read only.
4. Keep the existing append-only privilege model; do not add `UPDATE` to `paypal_webhook_events`.
5. Add regression coverage for duplicate delivery under the least-privilege contract. Prefer a real Neon integration proof if the existing CI harness can exercise the runtime proof role; retain/update the unit test as needed.
6. Run the targeted PayPal/Neon tests and the full relevant CI suite.
7. Open a PR and inspect the diff/CI.
8. Stop before merge and ask the owner for merge approval.
9. After an approved merge, deploy only the Cloudflare **preview** Worker change. Do not cut over production.
10. Resend the same PayPal Sandbox capture webhook once.
11. Required proof after that resend:
    - Cloudflare returns HTTP `200`;
    - PayPal eventually records successful delivery;
    - the already-stored webhook event is not duplicated;
    - the order remains `paid`;
    - no second order mutation/version increment is caused by the duplicate event.
12. Then perform one fresh Sandbox checkout to prove the first-delivery path still works.
13. Continue the remaining Cloudflare preview validation before any production cutover discussion.

## What must not be changed in the next step

- no `legendmural.com` DNS changes;
- no Netlify Production changes;
- no PayPal Live changes;
- no Resend Production activation;
- no Technisch Bouwadvies changes;
- no dashboard redesign or dashboard hosting changes;
- no Neon replacement/migration;
- no broad database privilege expansion;
- no unrelated storefront/UI work.

## Recommended startup order for the next migration chat

1. Read `docs/READ_ME_FIRST.md`.
2. Read this file: `docs/CLOUDFLARE_MIGRATION_HANDOFF_20260909.md`.
3. Read `docs/CLOUDFLARE_B2_CHECKOUT_DECISION_MAP_20260908.md`.
4. Read `docs/CLOUDFLARE_ENVIRONMENT_AND_SECRET_MAP.md`.
5. Read `docs/CLOUDFLARE_CUTOVER_AND_ROLLBACK_CHECKLIST.md`.
6. Fresh-check current `main`.
7. Inspect:
   - `server/adapters/neon-paypal-webhook-store.mjs`
   - `tests/neon-paypal-webhook-store.test.mjs`
   - `tests/neon-runtime-privilege-contract.test.mjs`
   - the real Neon integration workflow/harness relevant to the runtime proof role.
8. Execute only the exact next step described above.

## Continuation rule

GitHub is the source of truth. Do not infer the current Cloudflare migration state from old screenshots or chat summaries when this file and newer repository state are available. If newer `main` changes contradict this handoff, the newer repository state wins and this document should be updated again before the chat ends.
