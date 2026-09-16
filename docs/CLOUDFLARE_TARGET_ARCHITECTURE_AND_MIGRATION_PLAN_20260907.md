# LegendMural — Cloudflare target architecture & migration plan

**Last updated:** 2026-09-07  
**Status:** approved workstream execution plan; implementation may proceed on the migration branch only.  
**Production activation:** NOT AUTHORIZED.

## 1. Target architecture

```text
legendmural.com
  |
  v
Cloudflare Worker + Static Assets
  |- Vite `dist/`
  |- POST /api/paypal/checkout
  |- POST /api/paypal/capture
  |- POST /api/paypal/webhook
  |- /api/order-status
  |- POST /api/invoice-download
  `- /api/internal/dashboard-invoice

Cloudflare Cron Trigger (`*/5 * * * *`)
  `- V3 invoice reconciliation

Private Cloudflare R2
  `- immutable exact invoice PDF bytes

External systems retained:
PayPal -> Worker
Neon  -> Worker
Resend -> Worker

ChatGPT Sites dashboard
  `-> authenticated storefront internal invoice endpoint
```

The business/accounting core is preserved. This migration replaces platform bootstrap, storage provider and hosting/routing only.

## 2. Non-negotiable boundaries

- `ALKAVisuals/legend-stories-website` is the only repository whose runtime/hosting code may change in this workstream.
- Technisch Bouwadvies remains on Netlify and must not be touched.
- `ALKAVisuals/legendmural-dashboard` remains hosted on ChatGPT Sites; only storefront integration documentation may change where required.
- Neon remains the durable order/accounting source of truth.
- PayPal remains the payment provider.
- Resend remains the email provider.
- Secret values must never be committed to GitHub.
- Existing V3 numbering, immutable invoice snapshot, payment truth, idempotency, authorization and least-privilege contracts remain authoritative.
- No Production migration, DNS change, live PayPal switch, live Resend switch, V3 activation or R2 Production write is authorized by code completion or merge.

## 3. File-by-file migration plan

### Add

```text
wrangler.jsonc
cloudflare/worker.mjs
server/adapters/cloudflare-r2-v3-invoice-pdf-store.mjs
tests/cloudflare-r2-v3-invoice-pdf-store.test.mjs
tests/cloudflare-worker-routing.test.mjs
tests/cloudflare-config.test.mjs
.github/workflows/cloudflare-migration-compatibility.yml
docs/CLOUDFLARE_ENVIRONMENT_AND_SECRET_MAP.md
docs/CLOUDFLARE_CUTOVER_AND_ROLLBACK_CHECKLIST.md
```

Additional focused files may be added only when required by proven runtime compatibility gaps.

### Modify during migration

```text
.gitignore
package.json                    # only if a reproducible Cloudflare validation script is needed
PR/handoff documentation
```

### Keep during parallel validation / rollback window

```text
netlify.toml
netlify/functions/**
server/adapters/netlify-v3-invoice-pdf-store.mjs
@netlify/blobs dependency
Netlify-specific CI
```

These stay until Cloudflare Production has been separately activated and proven stable. Their presence is deliberate rollback insurance, not the target architecture.

### Do not expose

```text
netlify/functions/create-withdrawal.mjs
```

There is no active public `/api/...` mapping for this legacy/dormant function. The Cloudflare Worker must not create a public route for it merely because the host changes.

## 4. Public route contract

The following public URLs remain unchanged:

```text
/api/paypal/checkout
/api/paypal/capture
/api/paypal/webhook
/api/order-status
/api/invoice-download
/api/internal/dashboard-invoice
```

The Worker handles these paths directly. Cloudflare static redirect files are not used as function proxies.

Unknown `/api/*` paths return an explicit hardened 404 and are never silently served as static HTML.

## 5. Static asset contract

- Vite still builds to `dist/`.
- Cloudflare Workers Static Assets serves `dist/` directly.
- Only `/api/*` is configured `run_worker_first`.
- Ordinary website images/video remain static assets; they are not moved to R2 as part of this migration.
- R2 is reserved for private immutable invoice PDF bytes in this scope.

## 6. Cloudflare environment isolation

Use two Wrangler environments:

```text
default/top-level -> preview/non-production Worker + preview R2 binding
production        -> explicit named Production Worker + Production R2 binding
```

Production access must never be inferred from a preview hostname. Runtime code uses an explicit non-secret deployment-context variable:

```text
LEGENDMURAL_DEPLOY_CONTEXT=preview|production
```

Netlify's `CONTEXT=production` guard is not reused as Cloudflare truth. Where existing shared/bootstrap code still expects `CONTEXT`, the Cloudflare runtime may provide a compatibility projection derived only from `LEGENDMURAL_DEPLOY_CONTEXT`.

## 7. R2 invoice storage contract

Target binding:

```text
V3_INVOICE_PDFS
```

Target buckets:

```text
preview:    legendmural-v3-invoice-pdfs-preview
production: legendmural-v3-invoice-pdfs-prod
```

Durable storage backend identifier:

```text
cloudflare_r2
```

Storage key remains unchanged:

```text
v1/invoices/{invoiceId}/{pdfSha256}.pdf
```

Required semantics remain:

1. validate immutable artifact identity;
2. verify source bytes hash + byte length before write;
3. conditional create-only R2 write (`If-None-Match: *` semantics);
4. strong read after write;
5. verify exact hash + byte length again;
6. return backend/key only after verification;
7. Neon remains durable binding truth;
8. no raw/public R2 URL.

If the conditional write reports that the object already exists, read and verify the existing bytes. A mismatching existing object is an integrity failure, never an overwrite opportunity.

## 8. Scheduling contract

Netlify scheduled function:

```text
*/5 * * * *
```

becomes a Cloudflare Worker `scheduled()` handler with the same cron expression.

The existing V3 reconciliation feature flags remain fail-closed. Preview and initial Production Cloudflare configuration keep reconciliation disabled.

## 9. Environment/secrets rule

GitHub stores names and classification only, never values.

Sensitive values must use Cloudflare Secrets, including at minimum:

```text
NEON_DATABASE_URL
PAYPAL_CLIENT_ID
PAYPAL_CLIENT_SECRET
PAYPAL_WEBHOOK_ID
RESEND_API_KEY
LEGENDMURAL_DASHBOARD_INVOICE_TOKEN
```

Other secret-class values discovered later follow the same rule.

Non-secret runtime flags/origins may live in Wrangler `vars` when appropriate. Production activation flags remain explicitly false until a separately approved activation step.

## 10. CI / proof plan

Cloudflare migration CI must prove, without Production credentials:

1. repository unit tests still pass;
2. Vite build still passes;
3. `wrangler.jsonc` contract is valid and contains no secret values;
4. Wrangler can bundle the Worker in dry-run mode;
5. both preview and `production` named environments dry-run bundle successfully;
6. exact API route map is preserved;
7. unknown API path fails closed;
8. legacy withdrawal function is not exposed;
9. R2 adapter create-only/idempotent/integrity behavior passes against a deterministic fake R2 binding;
10. Production storage guard cannot be enabled from preview context;
11. Production dashboard API guard cannot be enabled from preview context;
12. static build continues to serve independently of Worker API routes.

A real Cloudflare preview is a later proof step after account/binding setup and must not promote to Production.

## 11. PDFKit compatibility gate

Do not replace PDFKit preemptively.

The Worker is configured for current Node compatibility and must first prove:

- successful Wrangler bundle;
- successful Worker startup in preview/workerd;
- deterministic fixture PDF generation under Worker runtime before Production invoice activation.

Only if that proof fails may renderer-specific compatibility work begin.

## 12. DNS / custom-domain cutover

DNS is not changed during implementation.

Before cutover, perform a fresh read-only inventory of the LegendMural DNS zone:

```text
nameservers
apex
www
MX
SPF
DKIM
DMARC
Resend verification records
other subdomains
```

The Technisch Bouwadvies zone is unrelated and forbidden in this workstream.

At cutover, `legendmural.com` becomes a Cloudflare Worker custom domain/origin. `www.legendmural.com` must redirect to the canonical apex. The old `legendmural.netlify.app` redirect may require the Netlify site to remain alive temporarily because Cloudflare does not control that hostname.

## 13. Rollback stages

### Stage A — branch only

- Netlify Production unchanged.
- Cloudflare code only on migration branch.
- rollback = discard/revert branch commits.

### Stage B — Cloudflare preview

- Netlify Production unchanged.
- Cloudflare preview has no Production secrets/bucket.
- rollback = disable/delete preview.

### Stage C — runtime/domain cutover, V3 storage still OFF

- Cloudflare serves site/API runtime.
- no Cloudflare Production R2 invoice writes yet.
- rollback = restore origin/DNS to Netlify.

### Stage D — R2 Production storage activation

This is a separate later activation after runtime stability. Once new durable invoice artifacts are written only to R2, simple DNS rollback to an old Netlify-only storage runtime is no longer sufficient. A storage-aware rollback plan must exist before this stage.

## 14. Merge strategy

The migration branch/PR may accumulate the complete migration implementation and evidence while `main` stays unchanged.

Before final merge:

1. fresh-check current `main`;
2. compare/rebase if `main` changed;
3. rerun all required CI on the exact final head;
4. update the canonical Cloudflare handoff with final evidence;
5. obtain explicit owner approval for the exact PR;
6. merge only then.

Merge does not itself authorize Production cutover.

## 15. Current exact next implementation slice

> Add the parallel Cloudflare Worker + Wrangler configuration + private R2 adapter + focused no-secret CI tests while leaving Netlify files fully intact.
