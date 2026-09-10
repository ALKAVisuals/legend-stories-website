# LegendMural Cloudflare migration — current handoff

**Last updated:** 2026-09-10  
**Repository:** `ALKAVisuals/legend-stories-website`  
**Migration scope:** Netlify -> Cloudflare for the public LegendMural storefront only  
**Base `main` verified for this handoff update:** `422b98c32e55f2c23e204c607924cc6bd0e90eb8`

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

The Cloudflare preview/runtime side is substantially proven and remains fail-closed. Production account inventory has also been completed, and the first inert Production resource has now been provisioned safely.

Current Production state:

```text
Production Worker: legendmural-cloudflare-production
exists: false

Production R2 bucket: legendmural-v3-invoice-pdfs-prod
exists: true
r2.dev public access: false
enabled custom domains: none
public exposure detected: false
objects written: none
```

No Production Worker, secrets, DNS, PayPal Live, Resend Production or live V3 feature has been activated.

The preview defaults remain fail-closed:

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

## Important merged checkpoints

| PR | Purpose | Merge/main checkpoint |
|---|---|---|
| #217 | PayPal duplicate webhook least-privilege path | `c912e012e14a9337a37464f3556977b882b806db` |
| #219 | Preserve explicit `.html` URLs on Cloudflare | `555df319ed155f02f1ccf8d53861051c7d175f64` |
| #222 | Fix Cloudflare bare-root route | `e2618084687b35377359e1809127e11b82875884` |
| #223 | Record Cloudflare preview run #10 | `34aad55768e00ff0e557c4a4b274041a2dbffa51` |
| #224 | Record PayPal Sandbox duplicate-webhook proof | `e2d3acc3e729647ab40e5154350237ce5b995531` |
| #225 | Record fresh PayPal Sandbox checkout proof | `0df0966661bbe1164a4ca886120e400c29ed9fca` |
| #226 | Add isolated Cloudflare preview PDF/R2 proof workflow | `7dac56453ed00fa466dc21ad44063aa949dc3aa4` |
| #227 | Normalize Cloudflare proof account ID | `34d8b8f9a6169424daf59dd009b2353bfa0b5a56` |
| #228 | Record actual Worker PDFKit + preview R2 proof | `2d44dd103bea6e136c697e57740d5f9aed27a0b9` |
| #229 | Add read-only six-route preview API matrix | `573db2a7ddd2d972a5dcbd2efbd1f39e40dea216` |
| #230 | Record successful preview API route proof | `36820e6c64f5d4f88e03e1de0e37758708fb805b` |
| #231 | Add Cloudflare Production read-only inventory | `30f5dba3ad2a8ad7b7966b5903dd0dc4d4d8e28f` |
| #232 | Record Production inventory proof | `5a9f5bff1206b0b240140e28b85403b37ff75cbb` |
| #233 | Add guarded Production R2 bootstrap | `422b98c32e55f2c23e204c607924cc6bd0e90eb8` |

## Preview proof anchors

Canonical preview Worker:

```text
Worker: legendmural-cloudflare-preview
Origin: https://legendmural-cloudflare-preview.lively-bonus-08da.workers.dev
Full storefront preview proof run: #10
Run ID: 34461889551
Worker version ID: 411070c2-5250-480c-85df-2c22e6260d3b
Result: success
```

The separate Cloudflare direct Git/Workers Builds integration is disconnected. The canonical preview deploy route is the repository's manually dispatched GitHub Actions workflow `Cloudflare preview account proof` with exact `PREVIEW_ONLY` confirmation.

### PayPal Sandbox / isolated Neon

Fresh paid proof anchor:

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

Duplicate-webhook anchor:

```text
Event ID: WH-6RC26966LE938421A-4TS169605E543550Y
PayPal order ID: 8U692661E3486793D
Capture ID: 69815081UN702743U
Amount: 45.45 EUR
Result: duplicate resend delivered; isolated Neon stayed paid/version 1 with one canonical ledger row
```

After the proof, preview checkout was restored to `LEGENDMURAL_CHECKOUT_PAUSED=true` and a direct request returned `503 CHECKOUT_PAUSED`.

### Actual Worker PDFKit + preview R2

```text
Workflow: Cloudflare preview PDF R2 account proof
Successful run ID: 34469940961
Temporary Worker: legendmural-cloudflare-preview-pdf-r2-proof
Temporary Worker version ID: ed2d799c-a696-4089-b64a-0ce5be871fe4
Preview bucket: legendmural-v3-invoice-pdfs-preview
PDF SHA-256: 8fddafde6eba252eaa257fc85aa357a69043b7651eea829f355770b967718c1f
PDF byte length: 24256
firstDuplicate: false
secondDuplicate: true
read-back bytes equal: true
```

The temporary proof Worker was deleted afterward.

### Six-route API matrix

Dedicated evidence: `docs/CLOUDFLARE_PREVIEW_API_ROUTE_MATRIX_PROOF_20260910.md`.

```text
Run ID: 34471706281
GET /api/paypal/checkout                -> 503 CHECKOUT_PAUSED
GET /api/paypal/capture                 -> 405 METHOD_NOT_ALLOWED
GET /api/paypal/webhook                 -> 405 METHOD_NOT_ALLOWED
GET /api/order-status                   -> 405 METHOD_NOT_ALLOWED
GET /api/invoice-download               -> 405 METHOD_NOT_ALLOWED
GET /api/internal/dashboard-invoice     -> 405 METHOD_NOT_ALLOWED
```

All six routes reached the canonical preview Worker through GET-only probes with no provider mutation.

## Production read-only inventory — PASSED

Dedicated evidence: `docs/CLOUDFLARE_PRODUCTION_READONLY_INVENTORY_PROOF_20260910.md`.

```text
Workflow: Cloudflare Production read-only inventory
Run number: 2
Run ID: 34473528687
Head SHA: 30f5dba3ad2a8ad7b7966b5903dd0dc4d4d8e28f
Result: success
```

At that point both the expected Production Worker and Production R2 bucket were absent. The inventory used Cloudflare GET requests only and changed nothing.

## Production R2 provisioning — PASSED 2026-09-10

Dedicated evidence: `docs/CLOUDFLARE_PRODUCTION_R2_PROVISION_PROOF_20260910.md`.

```text
Workflow: Cloudflare Production R2 bootstrap
Run number: 2
Run ID: 34475333977
Head SHA: 422b98c32e55f2c23e204c607924cc6bd0e90eb8
Branch: main
Event: workflow_dispatch
Result: success
Confirmation: CREATE_PRODUCTION_R2_BUCKET_ONLY
```

Exact account result:

```text
Bucket: legendmural-v3-invoice-pdfs-prod
Action: created
Bucket exists: true
r2.dev public access enabled: false
Enabled custom domains: none
Public exposure detected: false
R2 object writes: none
Worker deploy: none
DNS changes: none
Cloudflare secret changes: none
```

This closes the Production R2 existence/private-exposure gate. The bucket is inert: it contains no Production object and no live feature is enabled merely because the bucket exists.

## Section B status now

### Proven / closed

- Cloudflare account access for controlled GitHub Actions proofs;
- separate functioning preview Worker;
- private preview R2 and actual R2 runtime semantics;
- preview static serving and hardened API routing;
- all six intended API routes;
- PayPal Sandbox create/capture/webhook path;
- isolated Neon paid persistence and duplicate idempotency;
- actual Worker PDFKit runtime;
- preview checkout restored fail-closed;
- Production account inventory;
- Production R2 bucket existence;
- Production R2 has no `r2.dev` or custom-domain exposure;
- no Production R2 object has been written.

### Still open on Production side

- prepare and then separately approve creation/deployment of distinct `legendmural-cloudflare-production`;
- ensure the first Production Worker state is fail-closed;
- verify its static assets/API routing in Production Worker context without domain cutover;
- bind `V3_INVOICE_PDFS` to `legendmural-v3-invoice-pdfs-prod` while storage activation remains OFF;
- verify all non-secret safety flags remotely;
- configure only required Production secret names through Cloudflare secret storage under separately approved steps;
- re-run read-only account verification after setup;
- perform DNS inventory immediately before any later cutover;
- obtain separate explicit owner approval for the actual domain/runtime cutover.

## Exact next step

Do **not** deploy a Production Worker yet and do **not** cut over `legendmural.com`.

The next step is repository-only preparation of a tightly guarded **fail-closed Production Worker bootstrap** on a task branch. Inspect the existing Production Wrangler/dry-run configuration and prepare the smallest workflow/config change needed to create/deploy exactly `legendmural-cloudflare-production` with no DNS/custom-domain change and with all live features OFF.

Preparation/CI must prove at minimum that the intended first Production Worker configuration uses:

```text
LEGENDMURAL_DEPLOY_CONTEXT=production
LEGENDMURAL_CHECKOUT_PAUSED=true
PAYPAL_ALLOW_LIVE=false
ORDER_EMAILS_ENABLED=false
V3_PROFILE1_ORDER_CREATION_ENABLED=false
V3_INVOICE_RECONCILIATION_ENABLED=false
V3_INVOICE_STORAGE_ENABLED=false
V3_DASHBOARD_INVOICE_API_ENABLED=false
```

The production R2 binding may target:

```text
binding: V3_INVOICE_PDFS
bucket: legendmural-v3-invoice-pdfs-prod
```

but `V3_INVOICE_STORAGE_ENABLED` must remain `false`.

The PR itself must not deploy or create the Production Worker. After CI and a fresh review, stop and request explicit owner approval before merging. After merge, request a **separate exact owner approval** before manually running any workflow that creates/deploys the Production Worker.

## What must not be changed without a new exact approval

- `legendmural.com` DNS/custom-domain routing;
- Netlify Production;
- PayPal Live;
- Resend Production activation;
- Production Worker creation/deployment;
- Production secrets;
- Production R2 object writes;
- Production Neon credentials/data;
- V3 activation flags;
- dashboard hosting/design;
- Technisch Bouwadvies;
- unrelated storefront/UI code.

## Recommended startup order for the next migration chat

1. Read `docs/READ_ME_FIRST.md`.
2. Read this file.
3. Read `docs/CLOUDFLARE_PRODUCTION_R2_PROVISION_PROOF_20260910.md`.
4. Read `docs/CLOUDFLARE_PRODUCTION_READONLY_INVENTORY_PROOF_20260910.md`.
5. Read `docs/CLOUDFLARE_ENVIRONMENT_AND_SECRET_MAP.md`.
6. Read `docs/CLOUDFLARE_CUTOVER_AND_ROLLBACK_CHECKLIST.md`.
7. Fresh-check current `main` and open migration PRs.
8. Execute only the exact next repository-only preparation step above.

## Continuation rule

GitHub is the source of truth. If newer `main` changes contradict this handoff, newer repository state wins and this document must be updated again before the chat ends.
