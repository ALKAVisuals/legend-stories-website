# LegendMural Cloudflare migration — current handoff

**Last updated:** 2026-09-10  
**Repository:** `ALKAVisuals/legend-stories-website`  
**Migration scope:** Netlify -> Cloudflare for the public LegendMural storefront only  
**Base `main` verified for this handoff update:** `573db2a7ddd2d972a5dcbd2efbd1f39e40dea216`

> This is the canonical continuation document for the active Cloudflare migration. A new chat working on this migration must read this file before reconstructing progress from older chat history. Always fresh-check current `main` before taking an action.

## Non-negotiable scope boundaries

- `legendmural.com` Production is still on Netlify until an explicit final cutover is approved.
- Technisch Bouwadvies stays on Netlify and must not be changed by this migration.
- `ALKAVisuals/legendmural-dashboard` stays hosted through ChatGPT Sites; only migration-required integration points may be touched.
- Neon remains the database unless a separately approved migration says otherwise.
- PayPal, Resend, Neon and Cloudflare secret values must never be committed or pasted into repository documentation.
- No PayPal Live activation, DNS cutover, Production Cloudflare cutover, Netlify Production change or Production-data mutation without explicit owner approval for that exact step.
- GitHub is the source of truth. Repository changes must go through a task branch and PR; do not write directly to `main`.

## Current checkpoint

The Cloudflare preview runtime is healthy and fail-closed. The following real non-production proofs have passed:

- repository-driven Cloudflare preview deployment and static routing;
- hardened unknown-API handling;
- all six intended public API routes proven remotely through the existing preview Worker using GET-only probes;
- PayPal Sandbox duplicate-webhook idempotency;
- fresh PayPal Sandbox create/capture/webhook -> isolated Neon `paid` finalization;
- preview checkout re-pause after the Sandbox test;
- actual Cloudflare Worker PDFKit rendering;
- actual preview R2 create-only write, read-back, SHA-256/byte-length integrity and duplicate-write semantics;
- cleanup of the temporary isolated PDF/R2 proof Worker.

Checkout remains restored to:

```text
LEGENDMURAL_CHECKOUT_PAUSED=true
```

The checked-in preview defaults remain fail-closed:

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

No Production work is authorized.

## Merged fixes and proof checkpoints

| PR | Purpose | Merge/main checkpoint |
|---|---|---|
| #217 | PayPal duplicate webhook least-privilege path | `c912e012e14a9337a37464f3556977b882b806db` |
| #218 | Neon runtime privilege proof parameter typing | merged before Cloudflare preview account work |
| #219 | Preserve explicit `.html` URLs on Cloudflare | `555df319ed155f02f1ccf8d53861051c7d175f64` |
| #220 | Record successful preview proof | `27ff99789d873dd440ce13e511b37a247f5e8720` |
| #221 | Record direct Cloudflare Builds disconnect | `92eb5b3c2460adc653f79f8279add2df516ded5d` |
| #222 | Fix Cloudflare bare-root route | `e2618084687b35377359e1809127e11b82875884` |
| #223 | Record Cloudflare preview run #10 | `34aad55768e00ff0e557c4a4b274041a2dbffa51` |
| #224 | Record PayPal Sandbox duplicate webhook proof | `e2d3acc3e729647ab40e5154350237ce5b995531` |
| #225 | Record fresh PayPal Sandbox checkout proof | `0df0966661bbe1164a4ca886120e400c29ed9fca` |
| #226 | Add isolated Cloudflare preview PDF/R2 account proof | `7dac56453ed00fa466dc21ad44063aa949dc3aa4` |
| #227 | Normalize Cloudflare proof account ID | `34d8b8f9a6169424daf59dd009b2353bfa0b5a56` |
| #228 | Record successful actual Worker PDFKit + preview R2 proof | `2d44dd103bea6e136c697e57740d5f9aed27a0b9` |
| #229 | Add read-only remote six-route API matrix proof | `573db2a7ddd2d972a5dcbd2efbd1f39e40dea216` |

## Cloudflare preview deployment status

### Canonical deployment route

Cloudflare's separate direct Git/Workers Builds integration is disconnected. The canonical storefront preview deployment route is the repository's manually dispatched GitHub Actions workflow `Cloudflare preview account proof` with exact `PREVIEW_ONLY` confirmation.

### Latest full storefront preview deployment proof

`Cloudflare preview account proof` run **#10**:

```text
GitHub Actions run ID: 34461889551
Head SHA: e2618084687b35377359e1809127e11b82875884
Result: success
Preview Worker: legendmural-cloudflare-preview
Workers.dev origin: https://legendmural-cloudflare-preview.lively-bonus-08da.workers.dev
Cloudflare Worker version ID: 411070c2-5250-480c-85df-2c22e6260d3b
```

Remote smoke proof passed:

```text
/                         -> HTTP 200
/shop.html                -> HTTP 200
unknown /api/*            -> HTTP 404 / API_ROUTE_NOT_FOUND
/api/paypal/checkout      -> HTTP 503 / CHECKOUT_PAUSED
/api/internal/dashboard-invoice -> fail-closed while disabled
```

## PayPal Sandbox proofs — PASSED 2026-09-10

### Duplicate webhook idempotency

Canonical duplicate-resend anchor:

```text
Event ID: WH-6RC26966LE938421A-4TS169605E543550Y
Event type: PAYMENT.CAPTURE.COMPLETED
PayPal order ID: 8U692661E3486793D
Capture ID: 69815081UN702743U
Order reference: 540ba15d7c0d12e2ef3bc644d917670fd331345b5485caaf8d933771a56b5806
Amount: 45.45 EUR
```

Before resend, the obsolete Netlify deploy-preview Sandbox webhook subscription was removed, leaving only the Cloudflare preview Sandbox webhook. The event was resent exactly once. PayPal showed the Cloudflare delivery as `DELIVERED`. Read-only isolated-Neon verification confirmed the paid order stayed version `1` and the webhook ledger still contained exactly one row for the event.

### Fresh paid checkout

The owner temporarily changed only the preview runtime value:

```text
LEGENDMURAL_CHECKOUT_PAUSED=false
```

The checked-in default remained `true`; `PAYPAL_ALLOW_LIVE=false`, email OFF and all V3 activation flags remained OFF.

During buyer-login testing, multiple Sandbox create-order attempts were created. Only the successful paid order is the proof anchor:

```text
PayPal order ID: 8YF93007BW575474P
Order reference: 0ad7f8fe76083344c1f3fc19c90623e6c6b0b655e1b3f697fc0537041b276e8d
Amount: 49.95 EUR
Mode: test
Neon status: paid
Neon version: 1
Capture ID: 1KF63004E9093115U
Webhook event: WH-7BV26182T4398862C-2AX615180S755454D
Webhook result: SUCCESS / DELIVERED / HTTP 200 OK
```

The two earlier fresh attempts remained `payment_pending` and are not used as success proof anchors:

```text
0Y197120K6491325H
34611370XC151454V
```

After the successful proof, the owner restored and deployed:

```text
LEGENDMURAL_CHECKOUT_PAUSED=true
```

A direct safe request then returned `HTTP 503 / CHECKOUT_PAUSED`, proving the preview was re-paused.

## Cloudflare preview PDFKit + R2 account proof — PASSED 2026-09-10

### Failed run #1 — diagnosed without side effects

```text
Workflow: Cloudflare preview PDF R2 account proof
Run ID: 34469027528
Head SHA: 7dac56453ed00fa466dc21ad44063aa949dc3aa4
Result: failure before proof deployment
Cause: surrounding whitespace/newline in CLOUDFLARE_ACCOUNT_ID
```

No temporary proof Worker was deployed and no R2 object was written in failed run #1. PR #227 fixed only normalization/validation of the account ID without logging the value.

### Successful run #2

```text
Run ID: 34469940961
Head SHA: 34d8b8f9a6169424daf59dd009b2353bfa0b5a56
Result: success
Temporary Worker: legendmural-cloudflare-preview-pdf-r2-proof
Temporary Worker version ID: ed2d799c-a696-4089-b64a-0ce5be871fe4
Preview R2 bucket: legendmural-v3-invoice-pdfs-preview
```

The real Cloudflare Worker rendered the deterministic canonical invoice fixture:

```text
rendererVersion: 2
filename: invoice-LM-INV-2027-000001.pdf
pdfHeader: %PDF-1.4
pdfSha256: 8fddafde6eba252eaa257fc85aa357a69043b7651eea829f355770b967718c1f
pdfByteLength: 24256
deterministic: true
```

Actual preview-R2 proof:

```text
firstDuplicate: false
secondDuplicate: true
readSha256: 8fddafde6eba252eaa257fc85aa357a69043b7651eea829f355770b967718c1f
readByteLength: 24256
bytesEqual: true
```

This proves actual Worker PDFKit compatibility plus real preview R2 create-only, duplicate/idempotent handling, read-after-write, hash, byte-length and byte equality. The temporary proof Worker was successfully deleted afterward. No Production Worker/env, Production R2 bucket, DNS, Neon, PayPal, Resend or dashboard runtime secrets were used.

## Cloudflare preview API route matrix — PASSED 2026-09-10

Dedicated evidence: `docs/CLOUDFLARE_PREVIEW_API_ROUTE_MATRIX_PROOF_20260910.md`.

The manually dispatched `Cloudflare preview API route matrix` workflow run **#1** used exact confirmation `PREVIEW_API_MATRIX_ONLY` and only GET requests with no request bodies.

```text
Run ID: 34471706281
Head SHA: 573db2a7ddd2d972a5dcbd2efbd1f39e40dea216
Result: success
Origin: https://legendmural-cloudflare-preview.lively-bonus-08da.workers.dev
```

Exact remote results:

```text
GET /api/paypal/checkout                -> 503 CHECKOUT_PAUSED
GET /api/paypal/capture                 -> 405 METHOD_NOT_ALLOWED
GET /api/paypal/webhook                 -> 405 METHOD_NOT_ALLOWED
GET /api/order-status                   -> 405 METHOD_NOT_ALLOWED
GET /api/invoice-download               -> 405 METHOD_NOT_ALLOWED
GET /api/internal/dashboard-invoice     -> 405 METHOD_NOT_ALLOWED
```

The verifier also required JSON and `no-store` responses. All six intended routes therefore reached the existing canonical preview Worker and returned the expected fail-closed result. No provider secrets, deploy, DNS, Production action, order creation, capture, webhook processing or invoice write occurred.

## Section B reconciliation after route-matrix proof

The previously open runtime/routing proof items are now closed:

- real static serving on preview -> **PROVEN**;
- unknown `/api/*` hardened 404 -> **PROVEN**;
- all six intended public API routes through the Worker -> **PROVEN**;
- PayPal Sandbox create/capture/webhook and isolated-Neon paid persistence -> **PROVEN**;
- PayPal webhook delivery/signature path -> **PROVEN**;
- PDFKit under actual Cloudflare Worker -> **PROVEN**;
- preview R2 create-only/read/hash/length/duplicate semantics -> **PROVEN**;
- checkout re-pause -> **PROVEN**;
- Resend non-live, reconciliation OFF and dashboard invoice API OFF -> **PROVEN for current preview configuration**.

The remaining Section B uncertainty is now mainly **Cloudflare account-side Production inventory/setup**, not preview runtime behavior. Do not infer these Production-side account gates complete from preview evidence:

- whether a separate Production Worker currently exists;
- whether `legendmural-v3-invoice-pdfs-prod` currently exists and remains unused/private;
- whether any Production secrets have been configured, by name/presence only;
- if Production resources do exist, whether their current bindings/flags remain safely OFF without revealing credential values.

These are inventory questions only at the next step. Creating, modifying, deploying, binding or adding a Production resource/secret still requires separate explicit owner approval.

## Exact next step

Do **not** begin a Production cutover and do **not** create missing Production resources yet.

Perform a **read-only Cloudflare account-side Section B inventory**. Use only non-mutating account/API commands and record names/presence/status, never secret values. Determine:

1. whether a distinct Production Worker for LegendMural already exists;
2. whether the expected Production R2 bucket `legendmural-v3-invoice-pdfs-prod` already exists and whether any public exposure is configured;
3. whether Production secret configuration exists by secret **name/presence only**, if a Production Worker exists;
4. whether any existing Production Worker configuration/bindings/feature flags can be inspected read-only and are still fail-closed.

If a required Production resource is absent, record it as **not configured** and stop. Do not create it in the read-only inventory step. After the inventory is recorded, reconcile Section B again and request explicit owner approval for any exact Production setup action that is actually required.

## What must not be changed during the next step

- no `legendmural.com` DNS changes;
- no Netlify Production changes;
- no PayPal Live changes;
- no new PayPal Sandbox order;
- no Resend Production activation;
- no Production Cloudflare deployment;
- no creation or mutation of Production Workers, R2 buckets, bindings or secrets;
- no Production R2 writes;
- no Production Neon credential or data changes;
- no V3 activation flags;
- no dashboard redesign/publication;
- no Technisch Bouwadvies changes;
- no unrelated storefront/UI work.

## Recommended startup order for the next migration chat

1. Read `docs/READ_ME_FIRST.md`.
2. Read this file: `docs/CLOUDFLARE_MIGRATION_HANDOFF_20260909.md`.
3. Read `docs/CLOUDFLARE_PREVIEW_API_ROUTE_MATRIX_PROOF_20260910.md`.
4. Read `docs/CLOUDFLARE_B2_CHECKOUT_DECISION_MAP_20260908.md`.
5. Read `docs/CLOUDFLARE_ENVIRONMENT_AND_SECRET_MAP.md`.
6. Read `docs/CLOUDFLARE_CUTOVER_AND_ROLLBACK_CHECKLIST.md`.
7. Fresh-check current `main` and open migration PRs.
8. Execute only the exact next read-only account inventory recorded above.

## Continuation rule

GitHub is the source of truth. Do not infer the current Cloudflare migration state from old screenshots or chat summaries when this file and newer repository state are available. If newer `main` changes contradict this handoff, newer repository state wins and this document must be updated again before the chat ends.
