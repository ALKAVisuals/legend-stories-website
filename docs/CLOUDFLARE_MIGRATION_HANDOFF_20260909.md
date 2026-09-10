# LegendMural Cloudflare migration — current handoff

**Last updated:** 2026-09-10  
**Repository:** `ALKAVisuals/legend-stories-website`  
**Migration scope:** Netlify -> Cloudflare for the public LegendMural storefront only  
**Current `main` before PR #219:** `c912e012e14a9337a37464f3556977b882b806db`

> This is the canonical continuation document for the active Cloudflare migration. A new chat working on this migration must read this file before reconstructing progress from older chat history.

## Non-negotiable scope boundaries

- `legendmural.com` Production is still on Netlify until an explicit final cutover is approved.
- Technisch Bouwadvies stays on Netlify and must not be changed by this migration.
- `ALKAVisuals/legendmural-dashboard` stays hosted through ChatGPT Sites; only migration-required integration points may be touched.
- Neon remains the database unless a separately approved migration says otherwise.
- PayPal, Resend, Neon and Cloudflare secret values must never be committed or pasted into repository documentation.
- No PayPal Live activation, DNS cutover, Production Cloudflare cutover, Netlify Production change or Production-data mutation without explicit owner approval for that exact step.

## Current checkpoint

The duplicate PayPal webhook least-privilege defect has been fixed, proved with the real Neon integration harness and merged to `main`. A subsequent Cloudflare preview deployment succeeded, but its remote static-asset proof exposed a separate Cloudflare HTML-routing mismatch. PR #219 contains the minimal fix for that routing issue and is awaiting explicit merge approval after CI.

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

## Cloudflare preview deployment status

### GitHub CI credentials

The repository now has the required GitHub Actions repository secrets configured for the preview deploy workflow:

- `CLOUDFLARE_ACCOUNT_ID`
- `CLOUDFLARE_API_TOKEN`

Only the secret names are documented here. Secret values remain outside the repository.

### Preview deploy after PR #217

`Cloudflare preview account proof` was manually run on `main` with:

- confirmation: `PREVIEW_ONLY`;
- preview R2 provisioning disabled;
- preview Worker deployment enabled.

The workflow authenticated successfully and the existing `legendmural-cloudflare-preview` Worker deployment step succeeded. Production DNS, the Production Cloudflare environment and Netlify Production were not touched.

The workflow then failed only in the remote verification step:

```text
[remote-preview] static-shop: status=307
AssertionError: 307 !== 200
```

The deployed preview therefore contained the merged PayPal duplicate-webhook fix, but the account-proof workflow did not finish green because `/shop.html` redirected instead of returning the required HTTP `200`.

## Current open PR #219 — preserve explicit `.html` URLs

**PR:** #219 — `Fix Cloudflare preview HTML URL handling`  
**Branch:** `fix/cloudflare-preserve-html-urls`

Root cause: Cloudflare Workers Static Assets applies HTML canonicalization when `assets.html_handling` is not explicitly set. That causes an explicit request such as `/shop.html` to redirect with HTTP `307` to an extensionless path. The existing LegendMural B1 contract explicitly requires `/shop.html` to return HTML with HTTP `200`.

PR #219 therefore makes only the required routing/config change plus its regression protection:

1. `wrangler.jsonc`
   - set `assets.html_handling` to `"none"`;
2. `tests/cloudflare-config.test.mjs`
   - assert that `value.assets.html_handling === 'none'`;
3. this handoff document
   - record the current source-of-truth migration state before merge.

Before this documentation update, all five PR checks were green and the PR was mergeable. Adding this handoff update intentionally causes CI to run again. Do not merge until the refreshed checks are green and the owner explicitly approves the merge.

## PayPal Sandbox history still relevant

A PayPal Sandbox webhook is configured for the Cloudflare preview endpoint `/api/paypal/webhook`.

Earlier validation found and resolved a mismatched Cloudflare `PAYPAL_WEBHOOK_ID`. After correcting that Cloudflare runtime secret, PayPal could reach the preview Worker and a delivery returned HTTP `200`.

A later resend of an already-seen `PAYMENT.CAPTURE.COMPLETED` event exposed the duplicate-event least-privilege defect fixed by PR #217. PayPal resend/redelivery itself is valid and must be supported idempotently; do not recreate the PayPal app or webhook merely because historical failed delivery rows remain visible.

## Exact next steps

After the refreshed CI for PR #219 is fully green:

1. Stop and obtain explicit owner approval to merge PR #219.
2. Merge PR #219 to `main` using the repository's normal merge method.
3. Fresh-check the resulting `main` SHA.
4. Manually run `Cloudflare preview account proof` on the new `main` with:
   - `confirm_phrase = PREVIEW_ONLY`;
   - `provision_preview_r2 = false`;
   - `deploy_preview_worker = true`.
5. Require the remote proof to pass, including:
   - `/shop.html` -> HTTP `200` with HTML;
   - unknown `/api/*` -> HTTP `404` / `API_ROUTE_NOT_FOUND`;
   - checkout remains paused -> HTTP `503` / `CHECKOUT_PAUSED`;
   - dashboard invoice API remains disabled -> HTTP `503` / `DASHBOARD_INVOICE_API_DISABLED`.
6. Only after that preview proof is green, resend the same already-stored PayPal Sandbox capture webhook once.
7. Required duplicate-webhook proof:
   - Cloudflare returns HTTP `200`;
   - PayPal records successful delivery;
   - no duplicate webhook ledger row is created;
   - the order remains `paid`;
   - no second order mutation/version increment occurs.
8. Then perform one fresh PayPal Sandbox checkout to prove the first-delivery path still works.
9. Update this handoff again with the actual proof results before moving to the next migration phase.
10. Continue remaining Cloudflare preview validation before any Production cutover discussion.

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
6. Fresh-check current `main` and the status of PR #219.
7. Execute only the exact next applicable step from this handoff.

## Continuation rule

GitHub is the source of truth. Do not infer the current Cloudflare migration state from old screenshots or chat summaries when this file and newer repository state are available. If newer `main` changes contradict this handoff, the newer repository state wins and this document must be updated again before the chat ends.
