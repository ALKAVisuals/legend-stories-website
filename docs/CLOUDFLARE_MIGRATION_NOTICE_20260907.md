# LegendMural storefront — Cloudflare migration notice

**Last updated:** 2026-09-07  
**Scope:** active Netlify → Cloudflare infrastructure migration for `ALKAVisuals/legend-stories-website`.

## Current state

`legendmural.com` still runs through Netlify. No Cloudflare Production cutover is authorized and LegendMural is not officially live.

The migration is being built entirely on:

```text
branch: docs/cloudflare-migration-pointer-20260907
PR:     #208 (pre-cutover implementation; not a deployment authorization)
base main audit checkpoint: 7c3fd2422ef06045e8d49a2f6f543f2c61f26403
```

`main` remains unchanged until the complete migration is ready, fresh-checked against current `main`, fully CI-proven and explicitly owner-approved for merge.

The canonical cross-repository migration handoff lives in:

```text
ALKAVisuals/legendmural-dashboard
docs/CLOUDFLARE_MIGRATION_READ_ME_FIRST.md
PR #63
```

Always fresh-check current `main`; the SHA above is only the original audit checkpoint.

## Boundaries

- Technisch Bouwadvies stays on Netlify and must not be modified from the LegendMural Cloudflare workstream.
- The LegendMural dashboard stays hosted through ChatGPT Sites.
- Neon remains the database/accounting source of truth unless a later proven blocker requires otherwise.
- PayPal and Resend remain providers unless a later proven blocker requires otherwise.
- Secret/environment-variable values must never be copied into GitHub.
- Existing V3 commerce/accounting/numbering/idempotency/authorization contracts remain authoritative and must be preserved.
- Existing launch/legal/product blockers remain separate and are not closed by the hosting migration.
- No Production deployment, DNS change, secret rotation, Production migration or V3 activation is authorized by code completion or merge.

## Target architecture — LOCKED FOR IMPLEMENTATION

Read:

```text
docs/CLOUDFLARE_TARGET_ARCHITECTURE_AND_MIGRATION_PLAN_20260907.md
docs/CLOUDFLARE_ENVIRONMENT_AND_SECRET_MAP.md
docs/CLOUDFLARE_CUTOVER_AND_ROLLBACK_CHECKLIST.md
```

Target:

```text
Vite/static hosting         -> Cloudflare Worker + Static Assets
Netlify Functions           -> Cloudflare Worker route adapters
Netlify Scheduled Function  -> Cloudflare Cron Trigger
@netlify/blobs invoice PDF  -> private Cloudflare R2
Netlify config/redirects     -> Cloudflare routing/config
Netlify preview/runtime CI   -> Cloudflare migration compatibility CI + later real preview proof
```

Neon remains durable accounting/order truth. PayPal and Resend remain external providers. The ChatGPT Sites dashboard continues to consume the authenticated storefront invoice endpoint.

## Implementation completed on PR #208

Implemented in parallel with the still-intact Netlify runtime:

```text
wrangler.jsonc
cloudflare/worker.mjs
cloudflare/runtime.mjs
cloudflare/pdfkit-worker-runtime.mjs
server/adapters/cloudflare-r2-v3-invoice-pdf-store.mjs
scripts/create-cloudflare-pdfkit-node-proof.mjs
scripts/verify-cloudflare-workerd-smoke.mjs
tests/cloudflare-config.test.mjs
tests/cloudflare-worker-routing.test.mjs
tests/cloudflare-r2-v3-invoice-pdf-store.test.mjs
tests/fixtures/cloudflare-pdfkit-probe-worker.mjs
tests/fixtures/wrangler.pdfkit-probe.jsonc
.github/workflows/cloudflare-migration-compatibility.yml
docs/CLOUDFLARE_TARGET_ARCHITECTURE_AND_MIGRATION_PLAN_20260907.md
docs/CLOUDFLARE_ENVIRONMENT_AND_SECRET_MAP.md
docs/CLOUDFLARE_CUTOVER_AND_ROLLBACK_CHECKLIST.md
```

`.gitignore` excludes local Cloudflare/env secret files and Wrangler state while allowing explicit example files.

### Implemented behavior

- all six existing public API URLs are preserved;
- unknown `/api/*` fails closed with a hardened 404;
- dormant `create-withdrawal` is **not** exposed;
- Vite `dist/` remains static content through the `ASSETS` binding;
- only `/api/*` is worker-first;
- preview and Production R2 buckets are explicitly isolated;
- exact invoice object key remains `v1/invoices/{invoiceId}/{pdfSha256}.pdf`;
- R2 writes are conditional create-only, followed by read + SHA-256/byte-length verification;
- private R2 has no public invoice URL contract;
- Production storage requires both `V3_INVOICE_STORAGE_ENABLED=true` and explicit `LEGENDMURAL_DEPLOY_CONTEXT=production`;
- Netlify `CONTEXT` is not Cloudflare Production truth;
- Production Wrangler defaults keep checkout paused and PayPal live/email/Profile-1/reconciliation/storage/dashboard invoice API OFF;
- Cloudflare scheduled reconciliation uses the existing `*/5 * * * *` cadence but remains disabled by feature flag;
- Netlify runtime/config/dependency remain intact during migration as the rollback target.

## PDFKit / immutable invoice proof — COMPLETED

The existing shared invoice renderer remains renderer v2. It was **not** rewritten for Cloudflare.

PDFKit 0.20.2 required a Worker-only compatibility boundary because its Node build is not workerd-safe and its browser ESM build evaluates the unused PDF/A ICC profile URL at module startup.

The proven Cloudflare boundary is:

```text
bare import `pdfkit`
  -> Wrangler alias
  -> cloudflare/pdfkit-worker-runtime.mjs
  -> PDFKit browser ESM build
  -> explicit Helvetica + Helvetica-Bold standard-font registration
  -> stable synthetic import.meta.url for the unused PDF/A ICC path
```

The standalone Browserify build was explicitly tested and rejected because it caused a workerd startup failure through a dynamic `require("url")`.

LegendMural does not request PDF/A. If PDF/A is ever introduced later, its ICC asset must be wired explicitly instead of relying on the current compatibility boundary.

### Exact artifact parity

Technical proof checkpoint:

```text
storefront migration head: d27c7e4c54445acca105ad099e85296ee8da4f11
Cloudflare migration compatibility run: #40 / SUCCESS
```

For the exact same immutable invoice fixture, CI proved:

```text
Node renderer version       == workerd renderer version
Node filename               == workerd filename
Node PDF header             == workerd PDF header (%PDF-1.4)
Node byte length            == workerd byte length
Node SHA-256                == workerd SHA-256
workerd repeated render #1  == workerd repeated render #2
```

This means the Cloudflare runtime preserves the existing exact invoice artifact identity, not merely a visually similar PDF.

## Repository CI proof — GREEN

On technical proof checkpoint `d27c7e4c54445acca105ad099e85296ee8da4f11`:

```text
Cloudflare migration compatibility: SUCCESS
Quality checks:                      SUCCESS
Accessibility and purchase-flow:    SUCCESS
Mobile checkout WebKit regression:  SUCCESS
```

The Cloudflare workflow additionally proved:

```text
Cloudflare routing/isolation/R2 tests: SUCCESS
deterministic Node V3 invoice PDF tests: SUCCESS
Vite build: SUCCESS
storefront Worker in local workerd: SUCCESS
R2 create-only/idempotency/integrity in local workerd: SUCCESS
PDFKit renderer v2 in local workerd: SUCCESS
Node <-> workerd PDF SHA/length parity: SUCCESS
Wrangler preview deploy --dry-run bundle: SUCCESS
Wrangler Production env deploy --dry-run bundle: SUCCESS
```

The workflow uses no Cloudflare Production deployment and no Production credentials.

## Remaining migration work

Repository-side before merge:

1. synchronize dashboard PR #63 with this exact implementation/evidence;
2. fresh-check current storefront and dashboard `main` branches;
3. if either `main` moved materially, update/reconcile the migration branch before final approval;
4. rerun/confirm required CI on the exact merge-ready head;
5. obtain explicit owner approval for the exact PRs before merge.

External/pre-production proof still required before any Production cutover:

1. create/configure isolated Cloudflare Worker environments and private R2 buckets;
2. configure secrets directly in Cloudflare without exposing values to GitHub;
3. deploy a non-Production Cloudflare preview;
4. prove the real preview static site + six API routes;
5. prove PayPal sandbox create/capture/return/webhook end to end;
6. prove isolated Neon persistence from actual Cloudflare Worker runtime;
7. prove PDFKit generation and R2 create-only/read/hash/length behavior against the actual preview R2 bucket;
8. perform read-only LegendMural DNS inventory;
9. only then prepare a separately approved Production runtime/domain cutover.

## Exact next migration step

> Synchronize dashboard PR #63, fresh-check both repository `main` branches, and lock merge-ready repository evidence. Do not merge and do not deploy to Cloudflare Production.

After repository merge-readiness is explicitly owner-approved, the next distinct phase is isolated real Cloudflare preview/account setup and runtime proof. Production remains untouched.
