# LegendMural Cloudflare migration — current handoff

**Last updated:** 2026-09-10  
**Repository:** `ALKAVisuals/legend-stories-website`  
**Migration scope:** Netlify -> Cloudflare for the public LegendMural storefront only  
**Base `main` verified for this handoff update:** `34d8b8f9a6169424daf59dd009b2353bfa0b5a56`

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

The checked-in preview defaults remain fail-closed. `PAYPAL_ALLOW_LIVE=false`, `ORDER_EMAILS_ENABLED=false`, and all V3 activation flags remain `false`.

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

### PR #225 — record fresh PayPal Sandbox checkout proof

- Recorded the successful fresh Sandbox paid-order proof, capture/webhook delivery, isolated-Neon finalization and preview re-pause.
- Recorded honestly that multiple fresh Sandbox create-order attempts occurred during buyer-login testing, while only the successful order is used as the final proof anchor.
- Merged as `0df0966661bbe1164a4ca886120e400c29ed9fca`.

### PR #226 — add isolated Cloudflare preview PDF/R2 account proof

- Added a manually dispatched `Cloudflare preview PDF R2 account proof` workflow.
- Added a temporary isolated workers.dev proof Worker with only the existing preview R2 binding.
- Added deterministic Node-vs-Worker PDF comparison and create-only/read-back integrity verification.
- No Neon, PayPal, Resend or dashboard runtime secrets are consumed by this proof.
- Merged as `7dac56453ed00fa466dc21ad44063aa949dc3aa4`.

### PR #227 — normalize Cloudflare proof account ID

- Manual PDF/R2 run #1 stopped before deployment because the stored GitHub `CLOUDFLARE_ACCOUNT_ID` contained surrounding whitespace/newline characters.
- No temporary proof Worker was deployed and no R2 object was written in failed run #1.
- PR #227 trims only surrounding whitespace, validates the normalized account ID and masks it before export without printing the value.
- Added regression coverage for this secret-handling boundary.
- Merged as `34d8b8f9a6169424daf59dd009b2353bfa0b5a56`.

## Cloudflare preview deployment status

### Canonical deployment route

Cloudflare's separate direct Git/Workers Builds integration is disconnected. The canonical storefront preview deployment route is the repository's manually dispatched GitHub Actions workflow `Cloudflare preview account proof` with exact `PREVIEW_ONLY` confirmation.

### Latest full storefront preview proof

`Cloudflare preview account proof` run **#10** was manually dispatched after PR #222.

```text
GitHub Actions run ID: 34461889551
Head SHA: e2618084687b35377359e1809127e11b82875884
Result: success
Preview Worker: legendmural-cloudflare-preview
Workers.dev origin: https://legendmural-cloudflare-preview.lively-bonus-08da.workers.dev
Cloudflare Worker version ID: 411070c2-5250-480c-85df-2c22e6260d3b
```

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

### Successful paid order

During buyer-login/testing, multiple fresh Sandbox create-order attempts were produced. The observed new Sandbox orders included:

```text
0Y197120K6491325H -> payment_pending, test, version 0
34611370XC151454V -> payment_pending, test, version 0
8YF93007BW575474P -> paid, test, version 1
```

No further checkout retries were performed after identifying the successful paid order. The successful end-to-end proof is anchored only to `8YF93007BW575474P`.

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

```text
Capture ID: 1KF63004E9093115U
Capture status: COMPLETED
Amount: 49.95 EUR

Event ID: WH-7BV26182T4398862C-2AX615180S755454D
Event type: PAYMENT.CAPTURE.COMPLETED
Webhook ID: 48A370959R6889849
PayPal result: SUCCESS / DELIVERED
Cloudflare response: HTTP 200 OK
```

PayPal showed the attempt on 10 Sep 2026 at 12:29:41 as `DELIVERED` to exactly:

```text
https://legendmural-cloudflare-preview.lively-bonus-08da.workers.dev/api/paypal/webhook
```

Neon contains the corresponding first-delivery ledger rows for `CHECKOUT.ORDER.APPROVED` and `PAYMENT.CAPTURE.COMPLETED`. This proves the fresh first-delivery path works end-to-end through Cloudflare preview -> PayPal Sandbox -> webhook -> isolated Neon paid-state finalization.

### Preview re-pause after proof

Immediately after the successful proof, the owner restored only:

```text
LEGENDMURAL_CHECKOUT_PAUSED=true
```

and redeployed the Cloudflare preview Worker.

A direct safe request to `/api/paypal/checkout` then returned the expected fail-closed response:

```text
HTTP 503
error.code: CHECKOUT_PAUSED
```

The preview is therefore confirmed re-paused after the Sandbox test.

## Cloudflare preview PDFKit + R2 account proof — PASSED 2026-09-10

This proof was deliberately separated from the storefront Worker and from all commerce/email/dashboard runtime secrets.

### Failed run #1 — diagnosed without side effects

`Cloudflare preview PDF R2 account proof` run **#1** reached Cloudflare authentication but stopped at the R2 bucket-info step because `CLOUDFLARE_ACCOUNT_ID` contained surrounding whitespace/newline characters.

```text
Run ID: 34469027528
Head SHA: 7dac56453ed00fa466dc21ad44063aa949dc3aa4
Result: failure before proof deployment
```

The failure happened before the temporary Worker deployment and before any R2 test object was written. PR #227 fixed only the account-ID normalization boundary.

### Successful run #2

`Cloudflare preview PDF R2 account proof` run **#2** was manually dispatched from `main` using exact confirmation `PREVIEW_PDF_R2_ONLY`.

```text
Run ID: 34469940961
Run attempt: 1
Head SHA: 34d8b8f9a6169424daf59dd009b2353bfa0b5a56
Result: success
Temporary Worker: legendmural-cloudflare-preview-pdf-r2-proof
Temporary Worker version ID: ed2d799c-a696-4089-b64a-0ce5be871fe4
Preview R2 bucket: legendmural-v3-invoice-pdfs-preview
Proof run ID: 34469940961-1
```

The temporary Worker had only:

- the existing preview R2 binding `V3_INVOICE_PDFS` -> `legendmural-v3-invoice-pdfs-preview`;
- the non-secret proof run identifier.

No Production Worker/env, Production R2 bucket, custom domain/DNS, Neon, PayPal, Resend or dashboard runtime secrets were used.

### Actual Worker PDFKit proof

The real Cloudflare Worker rendered the canonical deterministic invoice fixture successfully:

```text
rendererVersion: 2
filename: invoice-LM-INV-2027-000001.pdf
pdfHeader: %PDF-1.4
pdfSha256: 8fddafde6eba252eaa257fc85aa357a69043b7651eea829f355770b967718c1f
pdfByteLength: 24256
deterministic: true
```

The Worker output matched the canonical Node comparison proof for both SHA-256 and byte length. This closes the checklist requirement that PDFKit produce the expected invoice fixture under an actual Cloudflare Worker runtime.

### Actual preview R2 create-only/read-back proof

The Worker wrote the deterministic PDF to the private preview R2 bucket under:

```text
proofs/cloudflare-preview-pdf-r2/34469940961-1/8fddafde6eba252eaa257fc85aa357a69043b7651eea829f355770b967718c1f.pdf
```

Observed proof result:

```text
firstDuplicate: false
secondDuplicate: true
readSha256: 8fddafde6eba252eaa257fc85aa357a69043b7651eea829f355770b967718c1f
readByteLength: 24256
bytesEqual: true
```

Therefore the actual preview R2 binding proved:

- first create-only write succeeds as a new object;
- a second identical create-only write is recognized as the duplicate/idempotent case;
- read-after-write succeeds;
- SHA-256 matches the generated artifact;
- byte length matches exactly;
- read-back bytes are identical.

This closes the Section B preview R2 create-only/read/hash/length proof requirement.

### Temporary Worker cleanup

After the verifier passed, Wrangler successfully deleted:

```text
legendmural-cloudflare-preview-pdf-r2-proof
```

The proof Worker therefore does not remain deployed after the test. The preview R2 proof object is non-production test evidence under the dedicated `proofs/cloudflare-preview-pdf-r2/` prefix.

## Section B reconciliation after PDF/R2 proof

The two previously unproven runtime/storage items are now proven:

- PDFKit under actual Cloudflare Worker runtime -> **PROVEN**;
- preview R2 create-only + read-after-write + hash/length verification -> **PROVEN**.

Already-proven items remain proven for the account/project, preview static serving, unknown API fail-closed behavior, PayPal Sandbox webhook verification, isolated-Neon persistence, Resend non-live state, reconciliation OFF and dashboard invoice API OFF.

Do not infer remaining Section B account/Production items complete merely because this non-production proof passed. In particular, Production Worker/bucket/secrets gates still require their own evidence and explicit authorization where an account-side Production mutation would be involved.

## Exact next step

Do **not** begin a Production cutover yet.

The next action is a **read-only remote API-route matrix against the existing Cloudflare preview Worker** to close the remaining Section B routing evidence gap. Verify all six intended public API routes reach the Worker routing layer and return the expected safe/fail-closed response for the current preview flags, without creating another PayPal order, mutating Neon, enabling V3, sending email or changing Cloudflare account configuration.

Before executing requests, inspect the current Worker route/method guards and choose non-mutating request forms for each route. Record exact path, method, HTTP status and expected error/response code. Do not retry a route with a mutating method merely to force a different response.

After that route matrix is proven and recorded, reconcile the remaining account-side Section B items again. Any step that would configure or mutate a Production Worker, Production R2 bucket, Production secret, DNS, PayPal Live, Resend Production, Netlify Production or Production data still requires separate explicit owner approval.

## What must not be changed during the next step

- no `legendmural.com` DNS changes;
- no Netlify Production changes;
- no PayPal Live changes;
- no new PayPal Sandbox order unless separately approved;
- no Resend Production activation;
- no Production Cloudflare deployment;
- no Production R2 writes;
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
7. Execute only the exact next non-production/read-only proof recorded above.

## Continuation rule

GitHub is the source of truth. Do not infer the current Cloudflare migration state from old screenshots or chat summaries when this file and newer repository state are available. If newer `main` changes contradict this handoff, newer repository state wins and this document must be updated again before the chat ends.
