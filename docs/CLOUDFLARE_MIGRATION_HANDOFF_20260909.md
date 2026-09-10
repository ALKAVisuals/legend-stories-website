# LegendMural Cloudflare migration — current handoff

**Last updated:** 2026-09-10  
**Repository:** `ALKAVisuals/legend-stories-website`  
**Migration scope:** Netlify -> Cloudflare for the public LegendMural storefront only  
**Base `main` verified for this handoff update:** `ddc8646ab2e1a9b887c94a0542a13dbc2e49af2d`

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

Cloudflare preview/runtime proofs are substantially complete. The private Production R2 bucket exists and the distinct Production Worker has now been created in a deliberately fail-closed, non-public state.

Current Production state:

```text
Production Worker: legendmural-cloudflare-production
exists: true
Worker version ID: 5d05b26d-4179-4ab0-a7b3-35cb990de854
workers.dev exposure: disabled by repository Production config
preview URL exposure: disabled by repository Production config
custom domain / DNS attachment: none
fail-closed flags proven remotely: true
Production application secret names present: none

Production R2 bucket: legendmural-v3-invoice-pdfs-prod
exists: true
r2.dev public access: false
enabled custom domains: none
public exposure detected: false
objects written: none
```

The Worker has the exact private R2 binding:

```text
V3_INVOICE_PDFS -> legendmural-v3-invoice-pdfs-prod
```

All live/commerce/V3 switches remain OFF:

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

`legendmural.com` has not been cut over. Netlify Production remains the active rollback/current-host target.

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
| #234 | Record Production R2 provisioning proof | `6fc7eb414274685f8102b2268d4614556d5b11e0` |
| #235 | Add guarded fail-closed Production Worker bootstrap | `ddc8646ab2e1a9b887c94a0542a13dbc2e49af2d` |

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

The direct Cloudflare Git/Workers Builds integration remains disconnected. Canonical preview deploys use the repository's manually dispatched GitHub Actions workflow.

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

Preview checkout was restored to `LEGENDMURAL_CHECKOUT_PAUSED=true` after the proof.

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

## Production R2 provisioning — PASSED

Dedicated evidence: `docs/CLOUDFLARE_PRODUCTION_R2_PROVISION_PROOF_20260910.md`.

```text
Workflow: Cloudflare Production R2 bootstrap
Run number: 2
Run ID: 34475333977
Head SHA: 422b98c32e55f2c23e204c607924cc6bd0e90eb8
Result: success
Bucket: legendmural-v3-invoice-pdfs-prod
r2.dev public access enabled: false
Enabled custom domains: none
Public exposure detected: false
R2 object writes: none
```

## Production Worker bootstrap — PASSED

Dedicated evidence: `docs/CLOUDFLARE_PRODUCTION_WORKER_BOOTSTRAP_PROOF_20260910.md`.

```text
Workflow: Cloudflare Production Worker bootstrap
Run number: 2
Run ID: 34478408523
Head SHA: ddc8646ab2e1a9b887c94a0542a13dbc2e49af2d
Result: success
Worker: legendmural-cloudflare-production
Worker version ID: 5d05b26d-4179-4ab0-a7b3-35cb990de854
failClosedFlagsProven: true
Production application secret names present: none
R2 public exposure detected: false
```

The five-minute schedule was deployed, but reconciliation remains a no-op while `V3_INVOICE_RECONCILIATION_ENABLED=false` and `ORDER_EMAILS_ENABLED=false`.

### Open Wrangler warning

Both the Production dry-run and real deploy emitted:

```text
Unexpected fields found in env.production field: "alias"
```

The Worker deployment and startup succeeded and the post-deploy safety verifier passed, but the nested Production `alias` field must not be considered supported/proven. Resolve this repository-side before DNS/custom-domain cutover.

## Section B status now

### Proven / closed

- Cloudflare account access for controlled GitHub Actions proofs;
- separate functioning preview Worker;
- private preview R2 and actual R2 runtime semantics;
- preview static serving and hardened API routing;
- all six intended API routes;
- PayPal Sandbox create/capture/webhook path;
- isolated Neon paid persistence and duplicate idempotency;
- actual Worker PDFKit runtime in preview proof;
- preview checkout restored fail-closed;
- Production account inventory;
- private Production R2 bucket existence;
- distinct Production Worker existence;
- Production Worker remote fail-closed flags;
- Production R2 binding on the Worker;
- zero Production application secrets currently present;
- no Production R2 object has been written;
- no DNS/custom-domain cutover performed.

### Still open before cutover

- clean up and prove the Wrangler `env.production.alias` compatibility issue;
- re-run Production dry-run with no alias warning;
- then determine/configure only the Production secrets actually required for the Stage C runtime, through Cloudflare secret storage and under separate exact approval;
- re-run read-only account verification after any secret/setup step;
- perform DNS inventory immediately before any later cutover;
- obtain separate explicit owner approval for the actual domain/runtime cutover.

## Exact next step

Do **not** change DNS, custom domains, Production secrets or live feature flags yet.

The next step is repository-only compatibility cleanup:

1. inspect Wrangler environment inheritance/support for `alias`;
2. remove or relocate the unsupported nested `env.production.alias` declaration if appropriate while preserving the canonical top-level PDFKit alias;
3. update `tests/cloudflare-config.test.mjs` so the intended alias contract is explicit;
4. run the Cloudflare compatibility suite and `wrangler deploy --env production --dry-run`;
5. require that the Production dry-run no longer reports `Unexpected fields found in env.production field: "alias"`;
6. stop before any Production redeploy and request exact owner approval if a redeploy is needed.

No Production mutation is required for this repository-only cleanup/proof.

## What must not be changed without a new exact approval

- `legendmural.com` DNS/custom-domain routing;
- Netlify Production;
- PayPal Live;
- Resend Production activation;
- Production Worker redeployment;
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
3. Read `docs/CLOUDFLARE_PRODUCTION_WORKER_BOOTSTRAP_PROOF_20260910.md`.
4. Read `docs/CLOUDFLARE_PRODUCTION_R2_PROVISION_PROOF_20260910.md`.
5. Read `docs/CLOUDFLARE_ENVIRONMENT_AND_SECRET_MAP.md`.
6. Read `docs/CLOUDFLARE_CUTOVER_AND_ROLLBACK_CHECKLIST.md`.
7. Fresh-check current `main` and open migration PRs.
8. Execute only the exact next repository-only compatibility step above.

## Continuation rule

GitHub is the source of truth. If newer `main` changes contradict this handoff, newer repository state wins and this document must be updated before continuing.
