# LegendMural — Cloudflare Production Worker bootstrap proof

**Date:** 2026-09-10  
**Repository:** `ALKAVisuals/legend-stories-website`  
**Source `main`:** `ddc8646ab2e1a9b887c94a0542a13dbc2e49af2d`

## Scope

This document records the first controlled creation/deployment of the distinct Cloudflare Production Worker for LegendMural. The deployment was intentionally fail-closed and did not authorize a domain cutover or any live commerce/V3 activation.

## GitHub Actions proof

```text
Workflow: Cloudflare Production Worker bootstrap
Run number: 2
Run ID: 34478408523
Head SHA: ddc8646ab2e1a9b887c94a0542a13dbc2e49af2d
Branch: main
Event: workflow_dispatch
Result: success
Confirmation: CREATE_FAIL_CLOSED_PRODUCTION_WORKER_ONLY
```

The policy gate and the create/verify job both completed successfully.

## Preflight

Before the mutation, the guarded preflight proved:

```text
Worker: legendmural-cloudflare-production
Worker exists before bootstrap: false
Production R2 bucket: legendmural-v3-invoice-pdfs-prod
Production R2 private state: proven
```

The workflow then performed a Wrangler Production dry-run before the real deploy.

## Production Worker result

```text
Worker: legendmural-cloudflare-production
Worker exists after bootstrap: true
Cloudflare Worker version ID: 5d05b26d-4179-4ab0-a7b3-35cb990de854
R2 binding: V3_INVOICE_PDFS -> legendmural-v3-invoice-pdfs-prod
Production application secret names present: none
R2 public exposure detected: false
```

The remote post-deploy verifier reported `failClosedFlagsProven: true`.

The deployed non-secret Production flags remained:

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

The Production environment is configured with `workers_dev=false`, `preview_urls=false`, no custom route/domain attachment, and no DNS change was part of this workflow.

The existing schedule `*/5 * * * *` was deployed, but the scheduled handler remains a no-op because `V3_INVOICE_RECONCILIATION_ENABLED=false` and `ORDER_EMAILS_ENABLED=false`.

## Explicitly not changed

- no `legendmural.com` DNS/custom-domain cutover;
- no Netlify Production change;
- no Cloudflare application secrets configured;
- no R2 object writes;
- no PayPal Live activation;
- no Resend Production activation;
- no Neon Production activation/data mutation;
- no V3 activation flag enabled;
- no dashboard hosting/design change;
- no Technisch Bouwadvies change.

## Wrangler compatibility warning observed

Both the Production dry-run and real deploy emitted this configuration warning:

```text
Unexpected fields found in env.production field: "alias"
```

The deploy itself succeeded and the Worker started successfully, and the safety/post-deploy checks all passed. However, the warning means the repository should not treat the nested `env.production.alias` declaration as a proven supported environment field.

Before any DNS/custom-domain cutover, resolve this as a repository-only compatibility cleanup and prove that the Production dry-run no longer emits the warning while the canonical top-level PDFKit alias/runtime behavior remains intact.

## Next step

Do not change DNS and do not activate any live feature yet.

The next step is repository-only: inspect Wrangler environment inheritance for `alias`, remove or relocate the unsupported nested Production alias declaration if appropriate, update regression tests, and re-run the Cloudflare Production dry-run/compatibility suite. No Production redeploy is required merely to prepare and test that fix; any later Production redeploy remains a separate explicitly approved action.
