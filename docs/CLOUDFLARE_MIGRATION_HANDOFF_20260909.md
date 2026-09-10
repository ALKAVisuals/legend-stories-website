# LegendMural Cloudflare migration — current handoff

**Last updated:** 2026-09-10  
**Repository:** `ALKAVisuals/legend-stories-website`  
**Migration scope:** Netlify -> Cloudflare for the public LegendMural storefront only  
**Current `main`:** `555df319ed155f02f1ccf8d53861051c7d175f64`

> This is the canonical continuation document for the active Cloudflare migration. A new chat working on this migration must read this file before reconstructing progress from older chat history.

## Non-negotiable scope boundaries

- `legendmural.com` Production is still on Netlify until an explicit final cutover is approved.
- Technisch Bouwadvies stays on Netlify and must not be changed by this migration.
- `ALKAVisuals/legendmural-dashboard` stays hosted through ChatGPT Sites; only migration-required integration points may be touched.
- Neon remains the database unless a separately approved migration says otherwise.
- PayPal, Resend, Neon and Cloudflare secret values must never be committed or pasted into repository documentation.
- No PayPal Live activation, DNS cutover, Production Cloudflare cutover, Netlify Production change or Production-data mutation without explicit owner approval for that exact step.

## Current checkpoint

The duplicate PayPal webhook least-privilege defect is fixed and merged. The separate Cloudflare Static Assets `.html` redirect mismatch is also fixed and merged. A manual Cloudflare preview deploy/proof from the resulting `main` completed fully green on 2026-09-10.

The next migration proof is therefore the real PayPal **Sandbox duplicate webhook resend** against the existing Cloudflare preview Worker. No Production work is authorized.

### Merged fixes

#### PR #218 — Neon runtime privilege proof parameter typing

- Fixed the real-Neon privilege proof harness error `42P18: could not determine data type of parameter $2`.
- The manual `Neon order-store integration` workflow passed after the fix.
- Merged to `main` before PR #217.

#### PR #217 — PayPal duplicate webhook least-privilege path

- Removed the unnecessary `FOR SHARE` clause from the duplicate-event read in `server/adapters/neon-paypal-webhook-store.mjs`.
- Preserved the append-only runtime privilege model for `legend_commerce.paypal_webhook_events`: `SELECT` + `INSERT`, no broad `UPDATE` grant.
- Strengthened the duplicate webhook unit regression so the duplicate read must remain a plain `SELECT` and the order version remains `1`.
- Re-ran the real `Neon order-store integration` workflow on the PayPal-fix branch after #218 was merged.
- The real least-privilege proof passed, including processing the same synthetic webhook event twice without a second order mutation.
- PR #217 was merged to `main` as commit `c912e012e14a9337a37464f3556977b882b806db`.

#### PR #219 — preserve explicit `.html` URLs on Cloudflare

- Root cause of the preview proof failure was Cloudflare Workers Static Assets HTML canonicalization.
- `assets.html_handling` is now explicitly set to `"none"` in `wrangler.jsonc`.
- `tests/cloudflare-config.test.mjs` now protects that routing contract.
- PR #219 was merged to `main` as commit `555df319ed155f02f1ccf8d53861051c7d175f64`.

## Cloudflare preview deployment status

### GitHub CI credentials

The repository has the required GitHub Actions repository secrets configured for the preview deploy workflow:

- `CLOUDFLARE_ACCOUNT_ID`
- `CLOUDFLARE_API_TOKEN`

Only the secret names are documented here. Secret values remain outside the repository.

### Successful preview proof after PR #219

`Cloudflare preview account proof` run **#7** was manually dispatched on `main` after PR #219 merged.

**GitHub Actions run ID:** `34455304483`  
**Head SHA:** `555df319ed155f02f1ccf8d53861051c7d175f64`  
**Result:** `success`  
**Preview Worker:** `legendmural-cloudflare-preview`  
**Workers.dev origin:** `https://legendmural-cloudflare-preview.lively-bonus-08da.workers.dev`  
**Cloudflare Worker version ID:** `4659ba4a-00de-4465-9535-b2f9b1bcc5f0`

The run used:

- `confirm_phrase = PREVIEW_ONLY`;
- preview R2 provisioning disabled;
- preview Worker deployment enabled.

The remote proof passed all required B1 checks:

- `/shop.html` -> HTTP `200` with HTML;
- unknown `/api/*` -> HTTP `404` / `API_ROUTE_NOT_FOUND`;
- checkout remains paused -> HTTP `503` / `CHECKOUT_PAUSED`;
- dashboard invoice API remains disabled -> HTTP `503` / `DASHBOARD_INVOICE_API_DISABLED`.

This proves that the earlier `307` redirect mismatch is resolved in the deployed preview. Production DNS, the Production Cloudflare environment, Production R2 and Netlify Production were not touched.

## PayPal Sandbox history still relevant

A PayPal Sandbox webhook is configured for the Cloudflare preview endpoint:

`https://legendmural-cloudflare-preview.lively-bonus-08da.workers.dev/api/paypal/webhook`

Earlier validation found and resolved a mismatched Cloudflare `PAYPAL_WEBHOOK_ID`. After correcting that Cloudflare runtime secret, PayPal could reach the preview Worker and a delivery returned HTTP `200`.

A later resend of the already-seen `PAYMENT.CAPTURE.COMPLETED` event exposed the duplicate-event least-privilege defect fixed by PR #217.

**Canonical duplicate-resend event ID:** `WH-6RC26966LE938421A-4TS169605E543550Y`

PayPal resend/redelivery itself is valid and must be supported idempotently. Do not recreate the PayPal app or webhook merely because historical failed delivery rows remain visible.

## Exact next steps

1. Merge the docs-only handoff update that records Cloudflare preview run #7, after normal CI and explicit owner approval.
2. In **PayPal Sandbox only**, locate event `WH-6RC26966LE938421A-4TS169605E543550Y` and resend it once to the existing Cloudflare preview webhook endpoint.
3. Required duplicate-webhook proof:
   - PayPal delivery receives HTTP `200`;
   - no `PAYPAL_WEBHOOK_STORE_UNAVAILABLE` / `NeonPayPalWebhookStoreError` occurs;
   - no duplicate webhook ledger row is created;
   - the existing order remains `paid`;
   - no second order mutation/version increment occurs.
4. Capture the PayPal delivery result and, where needed, Cloudflare/Neon evidence for the same event so the proof is end-to-end rather than inferred from CI alone.
5. Update this handoff with the actual duplicate-resend result before starting the next migration action.
6. Then prepare one fresh PayPal Sandbox checkout to prove the first-delivery path still works. Because the current preview proof intentionally shows `CHECKOUT_PAUSED`, follow the approved B2 preview-runtime plan before enabling any checkout-related preview flag; do not enable PayPal Live or Production runtime settings.
7. After the fresh Sandbox checkout proof, update this handoff again and continue the remaining Cloudflare preview validation before any Production cutover discussion.

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
