# LegendMural Cloudflare migration — current handoff

**Last updated:** 2026-09-10  
**Repository:** `ALKAVisuals/legend-stories-website`  
**Migration scope:** Netlify -> Cloudflare for the public LegendMural storefront only  
**Base `main` verified for this handoff update:** `30f5dba3ad2a8ad7b7966b5903dd0dc4d4d8e28f`

> This is the canonical continuation document for the active Cloudflare migration. Always fresh-check current `main` before taking an action. GitHub is the source of truth.

## Non-negotiable scope boundaries

- `legendmural.com` Production remains on Netlify until an explicit final cutover is approved.
- Technisch Bouwadvies stays on Netlify and must not be changed by this migration.
- `ALKAVisuals/legendmural-dashboard` stays hosted through ChatGPT Sites; only migration-required integration points may be touched.
- Neon remains the database unless a separately approved migration says otherwise.
- PayPal, Resend, Neon and Cloudflare secret values must never be committed, printed or pasted into repository documentation.
- No PayPal Live activation, DNS cutover, Production Cloudflare cutover, Netlify Production change or Production-data mutation without explicit owner approval for that exact step.
- Repository changes must go through a task branch and PR; never write directly to `main`.

## Current checkpoint

The Cloudflare **preview** side is now substantially proven and remains fail-closed. Real non-production evidence covers:

- repository-driven Cloudflare preview deployment and static routing;
- hardened unknown-API handling;
- all six intended public API routes through the existing preview Worker;
- PayPal Sandbox create/capture/webhook -> isolated Neon `paid` finalization;
- duplicate-webhook idempotency;
- preview checkout restored to paused after the Sandbox proof;
- actual Cloudflare Worker PDFKit rendering;
- actual preview R2 create-only write, duplicate handling, read-back, SHA-256/byte-length and byte equality;
- cleanup of the temporary PDF/R2 proof Worker.

The preview defaults remain:

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

No Production cutover or live feature activation is authorized.

## Important merged checkpoints

| PR | Purpose | Merge/main checkpoint |
|---|---|---|
| #217 | PayPal duplicate webhook least-privilege path | `c912e012e14a9337a37464f3556977b882b806db` |
| #218 | Neon runtime privilege proof parameter typing | merged earlier |
| #219 | Preserve explicit `.html` URLs on Cloudflare | `555df319ed155f02f1ccf8d53861051c7d175f64` |
| #220 | Record successful preview proof | `27ff99789d873dd440ce13e511b37a247f5e8720` |
| #221 | Record direct Cloudflare Builds disconnect | `92eb5b3c2460adc653f79f8279add2df516ded5d` |
| #222 | Fix Cloudflare bare-root route | `e2618084687b35377359e1809127e11b82875884` |
| #223 | Record Cloudflare preview run #10 | `34aad55768e00ff0e557c4a4b274041a2dbffa51` |
| #224 | Record PayPal Sandbox duplicate-webhook proof | `e2d3acc3e729647ab40e5154350237ce5b995531` |
| #225 | Record fresh PayPal Sandbox checkout proof | `0df0966661bbe1164a4ca886120e400c29ed9fca` |
| #226 | Add isolated Cloudflare preview PDF/R2 account proof | `7dac56453ed00fa466dc21ad44063aa949dc3aa4` |
| #227 | Normalize Cloudflare proof account ID | `34d8b8f9a6169424daf59dd009b2353bfa0b5a56` |
| #228 | Record actual Worker PDFKit + preview R2 proof | `2d44dd103bea6e136c697e57740d5f9aed27a0b9` |
| #229 | Add read-only six-route preview API matrix | `573db2a7ddd2d972a5dcbd2efbd1f39e40dea216` |
| #230 | Record successful preview API route proof | `36820e6c64f5d4f88e03e1de0e37758708fb805b` |
| #231 | Add Cloudflare Production read-only inventory | `30f5dba3ad2a8ad7b7966b5903dd0dc4d4d8e28f` |

## Cloudflare preview deployment proof

Canonical preview Worker:

```text
Worker: legendmural-cloudflare-preview
Origin: https://legendmural-cloudflare-preview.lively-bonus-08da.workers.dev
Latest full storefront preview proof run: #10
Run ID: 34461889551
Worker version ID: 411070c2-5250-480c-85df-2c22e6260d3b
Result: success
```

Cloudflare's separate direct Git/Workers Builds integration is disconnected. The canonical preview deployment route is the manually dispatched GitHub Actions workflow `Cloudflare preview account proof` with exact `PREVIEW_ONLY` confirmation.

## PayPal Sandbox proof anchors

Duplicate-webhook anchor:

```text
Event ID: WH-6RC26966LE938421A-4TS169605E543550Y
PayPal order ID: 8U692661E3486793D
Capture ID: 69815081UN702743U
Amount: 45.45 EUR
Result: duplicate resend delivered; isolated Neon stayed paid/version 1 with one canonical ledger row
```

Fresh paid checkout anchor:

```text
PayPal order ID: 8YF93007BW575474P
Amount: 49.95 EUR
Mode: test
Neon status: paid
Neon version: 1
Capture ID: 1KF63004E9093115U
Webhook event: WH-7BV26182T4398862C-2AX615180S755454D
Webhook result: SUCCESS / DELIVERED / HTTP 200 OK
```

Two earlier Sandbox create-order attempts remained `payment_pending` and are not success anchors:

```text
0Y197120K6491325H
34611370XC151454V
```

After the successful proof, preview checkout was restored to `LEGENDMURAL_CHECKOUT_PAUSED=true` and a direct request returned `503 CHECKOUT_PAUSED`.

## Actual Worker PDFKit + preview R2 proof

Successful proof run:

```text
Workflow: Cloudflare preview PDF R2 account proof
Run ID: 34469940961
Result: success
Temporary Worker: legendmural-cloudflare-preview-pdf-r2-proof
Temporary Worker version ID: ed2d799c-a696-4089-b64a-0ce5be871fe4
Preview R2 bucket: legendmural-v3-invoice-pdfs-preview
```

Deterministic PDF proof:

```text
rendererVersion: 2
filename: invoice-LM-INV-2027-000001.pdf
pdfSha256: 8fddafde6eba252eaa257fc85aa357a69043b7651eea829f355770b967718c1f
pdfByteLength: 24256
deterministic: true
```

R2 proof:

```text
firstDuplicate: false
secondDuplicate: true
readSha256: 8fddafde6eba252eaa257fc85aa357a69043b7651eea829f355770b967718c1f
readByteLength: 24256
bytesEqual: true
```

The temporary proof Worker was successfully deleted afterward.

## Preview API route matrix — PASSED

Dedicated evidence: `docs/CLOUDFLARE_PREVIEW_API_ROUTE_MATRIX_PROOF_20260910.md`.

```text
Workflow: Cloudflare preview API route matrix
Run: #1
Run ID: 34471706281
Head SHA: 573db2a7ddd2d972a5dcbd2efbd1f39e40dea216
Result: success
```

Exact GET-only remote results:

```text
GET /api/paypal/checkout                -> 503 CHECKOUT_PAUSED
GET /api/paypal/capture                 -> 405 METHOD_NOT_ALLOWED
GET /api/paypal/webhook                 -> 405 METHOD_NOT_ALLOWED
GET /api/order-status                   -> 405 METHOD_NOT_ALLOWED
GET /api/invoice-download               -> 405 METHOD_NOT_ALLOWED
GET /api/internal/dashboard-invoice     -> 405 METHOD_NOT_ALLOWED
```

The verifier also required JSON and `no-store`. No provider secrets, deploy, DNS, order creation, capture, webhook processing or invoice write occurred.

## Production account read-only inventory — PASSED 2026-09-10

Dedicated evidence: `docs/CLOUDFLARE_PRODUCTION_READONLY_INVENTORY_PROOF_20260910.md`.

```text
Workflow: Cloudflare Production read-only inventory
Run number: 2
Run ID: 34473528687
Head SHA: 30f5dba3ad2a8ad7b7966b5903dd0dc4d4d8e28f
Branch: main
Result: success
Mode: Cloudflare API GET requests only
```

Observed account state:

```text
Production Worker: legendmural-cloudflare-production
exists: false

Production R2 bucket: legendmural-v3-invoice-pdfs-prod
exists: false
```

Consequences:

- no remote Production Worker flags exist to verify yet;
- no Production Worker R2 bindings exist yet;
- no Production Worker secret-name presence exists to inspect yet;
- Production R2 `r2.dev`, custom-domain and public-exposure checks are not applicable until the bucket exists;
- no secret values were exposed;
- no Production resource was created or mutated.

This closes the inventory question: the expected Production Worker and Production R2 bucket are **not configured yet**.

## Section B status after Production inventory

### Proven / closed

- Cloudflare account access for controlled GitHub Actions proofs;
- separate functioning preview Worker;
- private preview R2 bucket and real R2 runtime behavior;
- preview static serving and hardened API routing;
- all six intended API routes;
- PayPal Sandbox create/capture/webhook path;
- isolated Neon persistence and duplicate idempotency;
- actual Worker PDFKit runtime;
- preview checkout restored fail-closed;
- current preview email/reconciliation/dashboard-invoice activation OFF.

### Still open on Production side

- create the private Production R2 bucket `legendmural-v3-invoice-pdfs-prod`;
- prove that bucket has no public `r2.dev` or custom-domain exposure;
- create/deploy a distinct `legendmural-cloudflare-production` Worker in a fail-closed state;
- verify its Production bindings and all non-secret safety flags;
- configure only the Production secrets actually required, via Cloudflare secret storage and without exposing values;
- re-run read-only account verification after setup;
- complete DNS inventory before any cutover;
- obtain separate explicit owner approval before the actual Production runtime/domain cutover.

## Exact next step

Do **not** cut over `legendmural.com` yet.

The safest next setup step is **Production R2 provisioning only**, and it requires explicit owner approval because it creates a Production account resource.

If approved, create exactly one private bucket:

```text
legendmural-v3-invoice-pdfs-prod
```

That provisioning step must:

- create no Worker;
- deploy no Worker code;
- configure no secrets;
- write no R2 object;
- enable no `r2.dev` public access;
- attach no R2 custom domain;
- change no DNS;
- touch no Netlify Production setting;
- activate no PayPal Live or Resend Production feature;
- change no Neon Production data/credential;
- keep all V3 activation flags OFF.

Immediately afterward, run a **read-only verification** that the bucket exists and has no public exposure. Only after that proof is recorded should the separate fail-closed Production Worker provisioning step be considered.

## What must not be changed without a new exact approval

- `legendmural.com` DNS;
- Netlify Production;
- PayPal Live;
- Resend Production activation;
- Production Worker deployment;
- Production secrets;
- Production R2 writes;
- Production Neon credentials/data;
- V3 activation flags;
- dashboard hosting/design;
- Technisch Bouwadvies;
- unrelated storefront/UI code.

## Recommended startup order for the next migration chat

1. Read `docs/READ_ME_FIRST.md`.
2. Read this file.
3. Read `docs/CLOUDFLARE_PRODUCTION_READONLY_INVENTORY_PROOF_20260910.md`.
4. Read `docs/CLOUDFLARE_PREVIEW_API_ROUTE_MATRIX_PROOF_20260910.md`.
5. Read `docs/CLOUDFLARE_ENVIRONMENT_AND_SECRET_MAP.md`.
6. Read `docs/CLOUDFLARE_CUTOVER_AND_ROLLBACK_CHECKLIST.md`.
7. Fresh-check current `main` and open migration PRs.
8. Execute only the exact next step recorded above after the required owner approval.

## Continuation rule

GitHub is the source of truth. If newer `main` changes contradict this handoff, newer repository state wins and this document must be updated again before the chat ends.
