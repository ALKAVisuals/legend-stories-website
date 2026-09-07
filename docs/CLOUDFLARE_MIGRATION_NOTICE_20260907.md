# LegendMural storefront — Cloudflare migration notice

**Last updated:** 2026-09-07  
**Scope:** active Netlify → Cloudflare infrastructure migration for `ALKAVisuals/legend-stories-website`.

## Current state

`legendmural.com` still runs through Netlify. No Cloudflare Production cutover is authorized and LegendMural is not officially live.

The migration is being built entirely on:

```text
branch: docs/cloudflare-migration-pointer-20260907
PR:     #208
base main audit checkpoint: 7c3fd2422ef06045e8d49a2f6f543f2c61f26403
```

`main` remains unchanged until the complete migration is ready, rebased/fresh-checked, fully CI-proven and explicitly owner-approved for merge.

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

## Implementation completed on PR #208 so far

Added in parallel with the still-intact Netlify runtime:

```text
wrangler.jsonc
cloudflare/worker.mjs
cloudflare/runtime.mjs
server/adapters/cloudflare-r2-v3-invoice-pdf-store.mjs
tests/cloudflare-config.test.mjs
tests/cloudflare-worker-routing.test.mjs
tests/cloudflare-r2-v3-invoice-pdf-store.test.mjs
.github/workflows/cloudflare-migration-compatibility.yml
docs/CLOUDFLARE_TARGET_ARCHITECTURE_AND_MIGRATION_PLAN_20260907.md
docs/CLOUDFLARE_ENVIRONMENT_AND_SECRET_MAP.md
docs/CLOUDFLARE_CUTOVER_AND_ROLLBACK_CHECKLIST.md
```

`.gitignore` now excludes local Cloudflare/env secret files and Wrangler state while allowing explicit example files.

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

## CI proof completed so far

Cloudflare migration compatibility run #1 on implementation head `bd73f6890069aa265b8d328426013b306f96e81a` completed successfully, including:

```text
Cloudflare routing/isolation/R2 tests: SUCCESS
deterministic V3 invoice PDF regression: SUCCESS
Vite build: SUCCESS
Wrangler preview deploy --dry-run bundle: SUCCESS
Wrangler production env deploy --dry-run bundle: SUCCESS
```

The workflow uses no Cloudflare Production deployment and no Production credentials.

On the later exact head, Cloudflare migration compatibility and Accessibility also reran successfully. Quality and Mobile WebKit are being rechecked as part of the current PR evidence cycle.

Before final merge, the exact final head must have all required checks green after any rebase/update from `main`.

## Remaining migration work

Repository-side:

1. complete all existing CI regression checks on the current exact head;
2. review/fix any failures;
3. add any compatibility fixes revealed by real Worker runtime proof;
4. synchronize dashboard PR #63 with exact implementation evidence;
5. fresh-check/rebase against `main` immediately before final CI and merge approval.

External/pre-production proof still required before cutover:

1. create/configure isolated Cloudflare Worker environments and private R2 buckets;
2. configure secrets directly in Cloudflare without exposing values to GitHub;
3. deploy a non-Production Cloudflare preview;
4. prove PayPal sandbox create/capture/webhook end to end;
5. prove isolated Neon persistence from actual Worker runtime;
6. prove deterministic PDFKit generation and private R2 byte contract in actual Worker runtime;
7. perform read-only DNS inventory;
8. only then prepare a separately approved Production runtime/domain cutover.

## Exact next migration step

> Finish repository CI/evidence on PR #208, fix any regressions, and bring the canonical dashboard handoff up to date. Do not merge and do not deploy to Cloudflare Production.
