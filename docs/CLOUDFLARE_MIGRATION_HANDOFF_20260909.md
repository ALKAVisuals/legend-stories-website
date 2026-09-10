# LegendMural Cloudflare migration — current handoff

**Last updated:** 2026-09-10  
**Repository:** `ALKAVisuals/legend-stories-website`  
**Migration scope:** Netlify -> Cloudflare for the public LegendMural storefront only  
**Current `main`:** `34aad55768e00ff0e557c4a4b274041a2dbffa51`

> This is the canonical continuation document for the active Cloudflare migration. A new chat working on this migration must read this file before reconstructing progress from older chat history.

## Non-negotiable scope boundaries

- `legendmural.com` Production is still on Netlify until an explicit final cutover is approved.
- Technisch Bouwadvies stays on Netlify and must not be changed by this migration.
- `ALKAVisuals/legendmural-dashboard` stays hosted through ChatGPT Sites; only migration-required integration points may be touched.
- Neon remains the database unless a separately approved migration says otherwise.
- PayPal, Resend, Neon and Cloudflare secret values must never be committed or pasted into repository documentation.
- No PayPal Live activation, DNS cutover, Production Cloudflare cutover, Netlify Production change or Production-data mutation without explicit owner approval for that exact step.

## Current checkpoint

The Cloudflare preview runtime is healthy and the PayPal Sandbox duplicate-webhook proof has now passed end-to-end.

The duplicate PayPal webhook least-privilege defect was fixed in PR #217. Cloudflare explicit `.html` handling was fixed in PR #219. The bare-root `/` 404 was fixed in PR #222 by mapping only `/` internally to `/index.html` while preserving explicit `.html` behavior and fail-closed `/api/*` routing.

PR #221 recorded the manual disconnection of Cloudflare's separate direct Git/Workers Builds integration so the controlled deployment route remains GitHub Actions `Cloudflare preview account proof` with explicit `PREVIEW_ONLY` confirmation.

PR #222 was merged to `main` as `e2618084687b35377359e1809127e11b82875884`. A fresh manual Cloudflare preview deploy/proof from that exact runtime commit completed fully green as workflow run #10. The deployed Worker serves both `/` and `/shop.html` with HTTP `200`, while the unknown API, paused checkout and disabled dashboard API fail-closed checks still pass.

PR #223 recorded run #10 in this handoff and merged to `main` as `34aad55768e00ff0e557c4a4b274041a2dbffa51`.

On 2026-09-10 the canonical existing PayPal Sandbox event `WH-6RC26966LE938421A-4TS169605E543550Y` (`PAYMENT.CAPTURE.COMPLETED`) was resent exactly once to the Cloudflare preview webhook. Before the resend, the obsolete Netlify deploy-preview webhook subscription was removed from the `LegendMural Sandbox` PayPal app, leaving only the Cloudflare preview webhook active. The new Cloudflare delivery was shown by PayPal as `DELIVERED` on 10 Sep 2026 at 12:01:40. A read-only Neon check on the isolated preview branch `cloudflare-preview-b2-20260908` confirmed the existing order remained `paid`, its `version` remained `1`, and the webhook ledger still contained exactly one row for the canonical event. The resend therefore produced no duplicate ledger row and no second order mutation.

The next migration proof is now one **fresh PayPal Sandbox checkout** against the Cloudflare preview to prove the first-delivery path still works. Checkout is intentionally paused at the current preview runtime and must only be unpaused according to the approved B2 preview-only decision map. No Production work is authorized.

## Merged fixes and recorded checkpoints

### PR #218 — Neon runtime privilege proof parameter typing

- Fixed the real-Neon privilege proof harness error `42P18: could not determine data type of parameter $2`.
- The manual `Neon order-store integration` workflow passed after the fix.
- Merged before PR #217.

### PR #217 — PayPal duplicate webhook least-privilege path

- Removed the unnecessary `FOR SHARE` clause from the duplicate-event read in `server/adapters/neon-paypal-webhook-store.mjs`.
- Preserved the append-only runtime privilege model for `legend_commerce.paypal_webhook_events`: `SELECT` + `INSERT`, no broad `UPDATE` grant.
- Strengthened the duplicate webhook unit regression so the duplicate read remains a plain `SELECT` and the order version remains `1`.
- The real least-privilege integration proof passed, including processing the same synthetic webhook event twice without a second order mutation.
- Merged as `c912e012e14a9337a37464f3556977b882b806db`.

### PR #219 — preserve explicit `.html` URLs on Cloudflare

- Root cause of the earlier preview proof failure was Cloudflare Workers Static Assets HTML canonicalization.
- `assets.html_handling` is explicitly set to `"none"` in `wrangler.jsonc`.
- `tests/cloudflare-config.test.mjs` protects that routing contract.
- Merged as `555df319ed155f02f1ccf8d53861051c7d175f64`.

### PR #220 — record successful preview proof

- Recorded Cloudflare preview account proof run #7.
- Merged as `27ff99789d873dd440ce13e511b37a247f5e8720`.

### PR #221 — record Cloudflare Builds disconnect

- Recorded that Cloudflare's separate direct Git/Workers Builds integration failed during initialization because its selected build token had been deleted or rolled.
- Recorded that the direct Git integration was manually disconnected to avoid a duplicate deployment route.
- The controlled GitHub Actions preview deployment route remained canonical.
- Merged as `92eb5b3c2460adc653f79f8279add2df516ded5d`.

### PR #222 — fix Cloudflare bare-root route

- Fixed the workers.dev bare-root `/` 404 without reverting `assets.html_handling = "none"`.
- Only `/` is mapped internally to `/index.html` before Static Assets fetch.
- Explicit routes such as `/shop.html` remain unchanged and `/api/*` routing remains fail-closed.
- Added unit coverage and extended the real preview smoke proof so both `/` and `/shop.html` must return HTTP `200`.
- Merged as `e2618084687b35377359e1809127e11b82875884`.

### PR #223 — record Cloudflare preview run #10

- Recorded the successful manual preview deployment/proof after PR #222.
- Merged as `34aad55768e00ff0e557c4a4b274041a2dbffa51`.

## Cloudflare preview deployment status

### GitHub CI credentials

The repository has the required GitHub Actions repository secrets configured for the preview deploy workflow:

- `CLOUDFLARE_ACCOUNT_ID`
- `CLOUDFLARE_API_TOKEN`

Only the secret names are documented here. Secret values remain outside the repository.

### Latest successful preview proof after PR #222

`Cloudflare preview account proof` run **#10** was manually dispatched on `main` after PR #222 merged.

**GitHub Actions run ID:** `34461889551`  
**Head SHA:** `e2618084687b35377359e1809127e11b82875884`  
**Result:** `success`  
**Preview Worker:** `legendmural-cloudflare-preview`  
**Workers.dev origin:** `https://legendmural-cloudflare-preview.lively-bonus-08da.workers.dev`  
**Cloudflare Worker version ID:** `411070c2-5250-480c-85df-2c22e6260d3b`

The run used:

- `confirm_phrase = PREVIEW_ONLY`;
- preview R2 provisioning disabled;
- preview Worker deployment enabled.

The build completed successfully and validated `128` HTML pages and `301` output files. The remote smoke proof passed:

- `/` -> HTTP `200` with the LegendMural homepage HTML;
- `/shop.html` -> HTTP `200` with shop HTML;
- unknown `/api/*` -> HTTP `404` / `API_ROUTE_NOT_FOUND`;
- checkout remains paused -> HTTP `503` / `CHECKOUT_PAUSED`;
- dashboard invoice API remains disabled -> HTTP `503` / `DASHBOARD_INVOICE_API_DISABLED`.

The deployed preview bindings remained fail-closed: `LEGENDMURAL_DEPLOY_CONTEXT="preview"`, `LEGENDMURAL_CHECKOUT_PAUSED="true"`, `PAYPAL_ALLOW_LIVE="false"`, `ORDER_EMAILS_ENABLED="false"`, and all V3 activation flags remained `false`.

Preview R2 provisioning was skipped. Production DNS/custom domains, the Production Cloudflare environment, Production R2, Netlify Production, PayPal Live and Resend Production were not touched.

### Direct Cloudflare Workers Builds integration disconnected

The separate Cloudflare direct Git/Workers Builds integration is disconnected. No replacement build token was created. The canonical preview deployment route is the repository's manually dispatched GitHub Actions workflow `Cloudflare preview account proof` with exact `PREVIEW_ONLY` confirmation.

## PayPal Sandbox duplicate-webhook proof — PASSED 2026-09-10

### Canonical event

**Event ID:** `WH-6RC26966LE938421A-4TS169605E543550Y`  
**Event type:** `PAYMENT.CAPTURE.COMPLETED`  
**PayPal order ID:** `8U692661E3486793D`  
**PayPal capture ID:** `69815081UN702743U`  
**Order reference:** `540ba15d7c0d12e2ef3bc644d917670fd331345b5485caaf8d933771a56b5806`  
**Amount:** `45.45 EUR`

### PayPal Sandbox subscription cleanup before resend

The `LegendMural Sandbox` app still had two webhook subscriptions:

1. obsolete Netlify deploy-preview endpoint `deploy-preview-85--legendmural.netlify.app/api/paypal/webhook`;
2. current Cloudflare preview endpoint `legendmural-cloudflare-preview.lively-bonus-08da.workers.dev/api/paypal/webhook`.

The obsolete Netlify deploy-preview subscription was deleted before the proof. Only the Cloudflare preview webhook remained active for the relevant events. This was Sandbox-only cleanup; no PayPal Live configuration was changed.

Historical PayPal event status can still show older failed/pending delivery history from the removed Netlify listener. That history must not be confused with the current Cloudflare transmission result.

### Real duplicate resend result

The canonical event was resent exactly once on 2026-09-10. PayPal showed the new attempt for webhook ID `48A370959R6889849` as:

- **Date/time:** 10 Sep 2026 12:01:40;
- **Result:** `DELIVERED`;
- **Target:** current Cloudflare preview webhook.

The Cloudflare webhook had already demonstrated HTTP `200` behavior for this event path, and the successful delivery plus stable Neon state confirm that no `PAYPAL_WEBHOOK_STORE_UNAVAILABLE` / `NeonPayPalWebhookStoreError` escaped the handler during this resend.

### Read-only Neon proof after resend

Neon project: `Legendmural`  
Isolated preview branch: `cloudflare-preview-b2-20260908`

A read-only query after the real resend confirmed:

- order `540ba15d7c0d12e2ef3bc644d917670fd331345b5485caaf8d933771a56b5806` remains `paid`;
- `payment_provider = paypal`;
- `payment_session_id = 8U692661E3486793D`;
- order `version = 1`;
- webhook-event count for `WH-6RC26966LE938421A-4TS169605E543550Y` = `1`;
- `PAYMENT.CAPTURE.COMPLETED` ledger count for that PayPal order/event identity = `1`.

Therefore the real duplicate resend was idempotent end-to-end: no duplicate webhook ledger row and no second order mutation/version increment occurred.

The default Neon branch `production` was also checked read-only first and did not contain this Sandbox order. This is consistent with the preview/Sandbox proof using the isolated preview branch rather than Production data.

## Exact next steps

1. Read `docs/CLOUDFLARE_B2_CHECKOUT_DECISION_MAP_20260908.md` and fresh-check the current preview runtime/env state before changing any preview flag.
2. Prepare one **fresh PayPal Sandbox checkout** against the Cloudflare preview to prove the first-delivery path still works.
3. Because `LEGENDMURAL_CHECKOUT_PAUSED="true"` is intentionally active now, unpause checkout only through the approved B2 preview-only plan and only with explicit approval for that preview change.
4. Keep `PAYPAL_ALLOW_LIVE="false"`, `ORDER_EMAILS_ENABLED="false"`, all V3 activation flags false, and all Production settings untouched.
5. For the fresh checkout proof, capture the browser checkout result, PayPal Sandbox capture/webhook delivery, Cloudflare response, and Neon order/webhook state so the proof is end-to-end.
6. Re-pause the preview checkout after the proof if the B2 plan requires it, then update this handoff again before starting the next migration action.
7. Only after the remaining Cloudflare preview validation is complete may a Production cutover discussion begin; no Production cutover is currently authorized.

## What must not be changed during these next steps

- no `legendmural.com` DNS changes;
- no Netlify Production changes;
- no PayPal Live changes;
- no Resend Production activation;
- no Technisch Bouwadvies changes;
- no dashboard redesign or dashboard hosting changes;
- no Neon replacement/migration;
- no broad database privilege expansion;
- no unrelated storefront/UI work;
- no Production Cloudflare deployment.

## Recommended startup order for the next migration chat

1. Read `docs/READ_ME_FIRST.md`.
2. Read this file: `docs/CLOUDFLARE_MIGRATION_HANDOFF_20260909.md`.
3. Read `docs/CLOUDFLARE_B2_CHECKOUT_DECISION_MAP_20260908.md`.
4. Read `docs/CLOUDFLARE_ENVIRONMENT_AND_SECRET_MAP.md`.
5. Read `docs/CLOUDFLARE_CUTOVER_AND_ROLLBACK_CHECKLIST.md`.
6. Fresh-check current `main` and any open migration PR.
7. Execute only the exact next applicable step from this handoff.

## Continuation rule

GitHub is the source of truth. Do not infer the current Cloudflare migration state from old screenshots or chat summaries when this file and newer repository state are available. If newer `main` changes contradict this handoff, the newer repository state wins and this document must be updated again before the chat ends.
