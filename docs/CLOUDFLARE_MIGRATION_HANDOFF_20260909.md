# LegendMural Cloudflare migration — current handoff

**Last updated:** 2026-09-10  
**Repository:** `ALKAVisuals/legend-stories-website`  
**Migration scope:** Netlify -> Cloudflare for the public LegendMural storefront only  
**Base `main` verified for this handoff update:** `e2d3acc3e729647ab40e5154350237ce5b995531`

> This is the canonical continuation document for the active Cloudflare migration. A new chat working on this migration must read this file before reconstructing progress from older chat history. Always fresh-check current `main` before taking an action.

## Non-negotiable scope boundaries

- `legendmural.com` Production is still on Netlify until an explicit final cutover is approved.
- Technisch Bouwadvies stays on Netlify and must not be changed by this migration.
- `ALKAVisuals/legendmural-dashboard` stays hosted through ChatGPT Sites; only migration-required integration points may be touched.
- Neon remains the database unless a separately approved migration says otherwise.
- PayPal, Resend, Neon and Cloudflare secret values must never be committed or pasted into repository documentation.
- No PayPal Live activation, DNS cutover, Production Cloudflare cutover, Netlify Production change or Production-data mutation without explicit owner approval for that exact step.

## Current checkpoint

The Cloudflare preview runtime is healthy. The PayPal Sandbox duplicate-webhook proof and a fresh end-to-end Sandbox checkout proof have both passed.

Checkout was temporarily unpaused only at the existing Cloudflare preview runtime for the approved B2 Sandbox proof. The repository-safe default in `wrangler.jsonc` was not changed. `PAYPAL_ALLOW_LIVE=false`, `ORDER_EMAILS_ENABLED=false`, and all V3 activation flags remained `false` throughout. After the proof, the preview checkout was manually restored to `LEGENDMURAL_CHECKOUT_PAUSED=true` and redeployed. A direct request to `/api/paypal/checkout` then returned `503 CHECKOUT_PAUSED`, confirming the preview is fail-closed again.

No Production work is authorized.

## Merged fixes and recorded checkpoints

### PR #217 — PayPal duplicate webhook least-privilege path

- Removed the unnecessary `FOR SHARE` clause from the duplicate-event read in `server/adapters/neon-paypal-webhook-store.mjs`.
- Preserved the append-only runtime privilege model for `legend_commerce.paypal_webhook_events`: `SELECT` + `INSERT`, no broad `UPDATE` grant.
- Strengthened duplicate webhook regression coverage.
- Real least-privilege integration proof passed.
- Merged as `c912e012e14a9337a37464f3556977b882b806db`.

### PR #218 — Neon runtime privilege proof parameter typing

- Fixed the real-Neon privilege proof harness error `42P18: could not determine data type of parameter $2`.
- The manual `Neon order-store integration` workflow passed after the fix.

### PR #219 — preserve explicit `.html` URLs on Cloudflare

- Set `assets.html_handling = "none"` in `wrangler.jsonc`.
- Added config regression coverage.
- Merged as `555df319ed155f02f1ccf8d53861051c7d175f64`.

### PR #220 — record successful preview proof

- Recorded Cloudflare preview account proof run #7.
- Merged as `27ff99789d873dd440ce13e511b37a247f5e8720`.

### PR #221 — record Cloudflare Builds disconnect

- Recorded that Cloudflare's separate direct Git/Workers Builds integration was manually disconnected after its build token became invalid.
- The controlled GitHub Actions preview deployment route remained canonical.
- Merged as `92eb5b3c2460adc653f79f8279add2df516ded5d`.

### PR #222 — fix Cloudflare bare-root route

- Fixed the workers.dev bare-root `/` 404 without reverting explicit `.html` handling.
- Only `/` maps internally to `/index.html`.
- Added unit and remote smoke coverage.
- Merged as `e2618084687b35377359e1809127e11b82875884`.

### PR #223 — record Cloudflare preview run #10

- Recorded the successful manual preview deployment/proof after PR #222.
- Merged as `34aad55768e00ff0e557c4a4b274041a2dbffa51`.

### PR #224 — record PayPal Sandbox duplicate webhook proof

- Recorded the successful one-time duplicate resend of canonical Sandbox event `WH-6RC26966LE938421A-4TS169605E543550Y`.
- Recorded removal of the obsolete Netlify deploy-preview Sandbox webhook subscription before the proof.
- Recorded stable isolated-Neon state: paid order stayed version `1`, with exactly one ledger row for the canonical event.
- Merged as `e2d3acc3e729647ab40e5154350237ce5b995531`.

## Cloudflare preview deployment status

### Canonical deployment route

Cloudflare's separate direct Git/Workers Builds integration is disconnected. The canonical preview deployment route is the repository's manually dispatched GitHub Actions workflow `Cloudflare preview account proof` with exact `PREVIEW_ONLY` confirmation.

### Latest full repository-driven preview proof

`Cloudflare preview account proof` run **#10** was manually dispatched after PR #222.

**GitHub Actions run ID:** `34461889551`  
**Head SHA:** `e2618084687b35377359e1809127e11b82875884`  
**Result:** `success`  
**Preview Worker:** `legendmural-cloudflare-preview`  
**Workers.dev origin:** `https://legendmural-cloudflare-preview.lively-bonus-08da.workers.dev`  
**Cloudflare Worker version ID:** `411070c2-5250-480c-85df-2c22e6260d3b`

Remote smoke proof passed:

- `/` -> HTTP `200`;
- `/shop.html` -> HTTP `200`;
- unknown `/api/*` -> HTTP `404` / `API_ROUTE_NOT_FOUND`;
- checkout paused -> HTTP `503` / `CHECKOUT_PAUSED`;
- dashboard invoice API disabled -> HTTP `503` / `DASHBOARD_INVOICE_API_DISABLED`.

The repository-safe preview defaults remain:

```text
LEGENDMURAL_DEPLOY_CONTEXT=preview
LEGENDMURAL_CHECKOUT_PAUSED=true
PAYPAL_ALLOW_LIVE=false
ORDER_EMAILS_ENABLED=false
V3_PROFILE1_ORDER_CREATION_ENABLED=false
V3_INVOICE_RECONCILIATION_ENABLED=false
V3_INVOICE_STORAGE_ENABLED=false
V3_DASHBOARD_INVOICE_API_ENABLED=false
```

## PayPal Sandbox duplicate-webhook proof — PASSED 2026-09-10

Canonical event:

```text
Event ID: WH-6RC26966LE938421A-4TS169605E543550Y
Event type: PAYMENT.CAPTURE.COMPLETED
PayPal order ID: 8U692661E3486793D
PayPal capture ID: 69815081UN702743U
Order reference: 540ba15d7c0d12e2ef3bc644d917670fd331345b5485caaf8d933771a56b5806
Amount: 45.45 EUR
```

Before the resend, the obsolete Netlify deploy-preview Sandbox webhook subscription was removed from the `LegendMural Sandbox` app, leaving only the Cloudflare preview webhook active for the relevant events.

The event was resent exactly once. PayPal showed the new Cloudflare attempt on 10 Sep 2026 at 12:01:40 as `DELIVERED`. A read-only Neon check on isolated branch `cloudflare-preview-b2-20260908` confirmed the order remained `paid`, version remained `1`, and the webhook ledger still contained exactly one row for the event. Therefore the duplicate resend was idempotent end-to-end.

## Fresh PayPal Sandbox checkout proof — PASSED 2026-09-10

### Preview-only temporary unpause

The owner approved and manually changed only the existing Cloudflare preview runtime variable:

```text
LEGENDMURAL_CHECKOUT_PAUSED=false
```

The preview Worker was redeployed from Cloudflare after that runtime-variable change. The checked-in repository-safe default remained `true`; no repository runtime flag was changed for this proof.

All safety locks observed before the unpause remained unchanged:

```text
LEGENDMURAL_DEPLOY_CONTEXT=preview
PAYPAL_ALLOW_LIVE=false
ORDER_EMAILS_ENABLED=false
V3_PROFILE1_ORDER_CREATION_ENABLED=false
V3_INVOICE_RECONCILIATION_ENABLED=false
V3_INVOICE_STORAGE_ENABLED=false
V3_DASHBOARD_INVOICE_API_ENABLED=false
```

Preview secrets remained encrypted Cloudflare Secrets for the isolated Neon branch and PayPal Sandbox app. No secret values were copied into GitHub or chat.

### Create-order / browser approval result

The browser checkout successfully progressed beyond the `CHECKOUT_PAUSED` guard and redirected to PayPal Sandbox buyer approval, proving the Cloudflare create-order path was active.

During the buyer-login/testing interaction, multiple fresh Sandbox create-order attempts were produced. This means the session was not a strict one-create-order proof. The observed new Sandbox orders included:

```text
0Y197120K6491325H -> payment_pending, test, version 0
34611370XC151454V -> payment_pending, test, version 0
8YF93007BW575474P -> paid, test, version 1
```

No further retries were performed after identifying the successful paid order. The successful end-to-end proof is anchored only to `8YF93007BW575474P`. The two pending Sandbox attempts are retained as test evidence and are not Production data.

### Successful paid order

Successful PayPal Sandbox order:

```text
PayPal order ID: 8YF93007BW575474P
Order reference: 0ad7f8fe76083344c1f3fc19c90623e6c6b0b655e1b3f697fc0537041b276e8d
Amount: 49.95 EUR
Mode: test
Neon status: paid
Neon version: 1
```

Read-only Neon verification on isolated branch `cloudflare-preview-b2-20260908` confirmed the order is `paid`, `payment_provider=paypal`, `payment_session_id=8YF93007BW575474P`, `mode=test`, and `version=1`.

### Capture + webhook result

PayPal capture:

```text
Capture ID: 1KF63004E9093115U
Status: COMPLETED
Amount: 49.95 EUR
```

Successful payment webhook:

```text
Event ID: WH-7BV26182T4398862C-2AX615180S755454D
Event type: PAYMENT.CAPTURE.COMPLETED
PayPal order ID: 8YF93007BW575474P
Capture ID: 1KF63004E9093115U
Webhook ID: 48A370959R6889849
PayPal result: SUCCESS / DELIVERED
Cloudflare response: HTTP 200 OK
```

PayPal showed the attempt on 10 Sep 2026 at 12:29:41 as `DELIVERED`. The transmission target was exactly:

```text
https://legendmural-cloudflare-preview.lively-bonus-08da.workers.dev/api/paypal/webhook
```

Neon also contains the corresponding first-delivery ledger rows for the successful order:

```text
CHECKOUT.ORDER.APPROVED
  event: WH-98440121N7275992F-2DF601654L686514F
  PayPal order: 8YF93007BW575474P

PAYMENT.CAPTURE.COMPLETED
  event: WH-7BV26182T4398862C-2AX615180S755454D
  PayPal order: 8YF93007BW575474P
  capture: 1KF63004E9093115U
```

This proves the fresh first-delivery path works end-to-end through Cloudflare preview -> PayPal Sandbox -> webhook -> isolated Neon paid-state finalization.

### Preview re-pause after proof

Immediately after the successful proof, the owner restored only:

```text
LEGENDMURAL_CHECKOUT_PAUSED=true
```

and redeployed the Cloudflare preview Worker.

A direct safe request to:

```text
https://legendmural-cloudflare-preview.lively-bonus-08da.workers.dev/api/paypal/checkout
```

then returned the expected fail-closed response:

```text
HTTP 503
error.code: CHECKOUT_PAUSED
```

The preview is therefore confirmed re-paused after the Sandbox test.

## Exact next step

Do **not** begin a Production cutover yet.

The next migration action is a **read-only reconciliation of the Cloudflare cutover checklist, especially Section B (account/pre-production setup gate), against the evidence already recorded in GitHub**. The purpose is to mark only what is genuinely proven, identify every still-unproven preview requirement, and select the first remaining non-production proof. No Cloudflare Production, DNS, PayPal Live, Netlify Production, Resend Production, dashboard publication, or Production-data action is authorized by this step.

At minimum, the reconciliation must verify evidence for the remaining Section B items rather than assume them complete, including actual Worker-runtime PDFKit behavior and the preview R2 create-only/read/hash/length proof where applicable.

Only after all required preview/pre-production gates are proven and recorded may a separate Production cutover discussion begin, and that discussion still requires explicit owner approval before any Production action.

## What must not be changed during the next step

- no `legendmural.com` DNS changes;
- no Netlify Production changes;
- no PayPal Live changes;
- no Resend Production activation;
- no Production Cloudflare deployment;
- no Production Neon credential or data changes;
- no V3 activation flags;
- no dashboard redesign/publication;
- no Technisch Bouwadvies changes;
- no unrelated storefront/UI work.

## Recommended startup order for the next migration chat

1. Read `docs/READ_ME_FIRST.md`.
2. Read this file: `docs/CLOUDFLARE_MIGRATION_HANDOFF_20260909.md`.
3. Read `docs/CLOUDFLARE_B2_CHECKOUT_DECISION_MAP_20260908.md`.
4. Read `docs/CLOUDFLARE_ENVIRONMENT_AND_SECRET_MAP.md`.
5. Read `docs/CLOUDFLARE_CUTOVER_AND_ROLLBACK_CHECKLIST.md`.
6. Fresh-check current `main` and open migration PRs.
7. Reconcile the pre-production checklist read-only before choosing any next mutation.

## Continuation rule

GitHub is the source of truth. Do not infer the current Cloudflare migration state from old screenshots or chat summaries when this file and newer repository state are available. If newer `main` changes contradict this handoff, newer repository state wins and this document must be updated again before the chat ends.
