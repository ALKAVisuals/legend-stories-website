# LegendMural — Cloudflare Preview Account Proof

**Date:** 2026-09-08  
**Phase:** B1 — isolated Cloudflare account/runtime preview proof  
**Production impact:** forbidden

## Purpose

This phase begins only after repository migration PR #208 and dashboard handoff PR #63 were merged.

B1 proves the real Cloudflare account/runtime boundary with a fail-closed `workers.dev` preview while Netlify remains Production. It does **not** yet prove Neon/PayPal/Resend integration.

## Current storefront main checkpoint

```text
bd5e1be61a72f455b0d86051115fa02dd87223c5
```

Post-merge preview branch:

```text
cloudflare/preview-account-proof-20260908
```

## B1 allowed actions

- authenticate Wrangler to the LegendMural Cloudflare account through GitHub Actions secrets;
- create or confirm the private preview R2 bucket:

```text
legendmural-v3-invoice-pdfs-preview
```

- deploy the top-level fail-closed Worker config to a `workers.dev` preview URL;
- prove static assets load;
- prove unknown APIs fail closed;
- prove checkout remains paused;
- prove dashboard invoice API remains disabled.

## B1 forbidden actions

- `--env production`;
- `legendmural-cloudflare-production` deployment;
- Production R2 bucket creation/write;
- DNS/custom-domain changes;
- `legendmural.com` traffic changes;
- Neon Production credentials or migrations;
- PayPal Live credentials or activation;
- Resend live credentials or sending;
- Profile 1 activation;
- invoice storage activation;
- reconciliation activation;
- dashboard invoice API activation;
- Netlify removal or Production changes;
- any Technisch Bouwadvies change.

## GitHub secrets required for B1

Values must be configured directly in GitHub Actions secrets and must never be committed or pasted into docs/PRs/logs.

```text
CLOUDFLARE_ACCOUNT_ID
CLOUDFLARE_API_TOKEN
```

The API token should be scoped to the LegendMural Cloudflare account only and should contain only the permissions needed for this phase: Worker deployment plus R2 bucket write/provisioning. No DNS/zone-edit permission is required for B1.

Cloudflare's CI guidance requires an account ID and API token for non-interactive Wrangler use. R2 bucket creation requires R2 write permission.

## Workflow

```text
.github/workflows/cloudflare-preview-account-proof.yml
```

The workflow has both PR validation and manual execution modes.

A real account run requires:

```text
confirm_phrase = PREVIEW_ONLY
provision_preview_r2 = true
deploy_preview_worker = true
```

It fails before account access if the confirmation phrase or Cloudflare secrets are absent.

The workflow deliberately consumes no Neon, PayPal, Resend or dashboard authorization secret in B1.

## Remote proof

After deployment, the workflow passes the returned Worker URL to:

```text
scripts/verify-cloudflare-remote-preview.mjs
```

The verifier requires HTTPS and a `.workers.dev` hostname and rejects the Production domain. It proves:

1. `/shop.html` returns HTML with HTTP 200;
2. unknown `/api/*` returns `API_ROUTE_NOT_FOUND` with HTTP 404;
3. `/api/paypal/checkout` returns `CHECKOUT_PAUSED` with HTTP 503;
4. `/api/internal/dashboard-invoice` returns `DASHBOARD_INVOICE_API_DISABLED` with HTTP 503.

## B2 after B1 succeeds

Only after B1 is green should a separate, explicitly isolated B2 configure non-production credentials for:

- isolated Neon database/branch;
- PayPal Sandbox;
- preview PayPal webhook ID;
- optional test-only Resend path if separately authorized.

B2 must then prove the six API contracts, sandbox checkout/capture/webhook, isolated Neon writes, invoice-access audit persistence, PDFKit runtime behavior and R2 integrity against preview-only resources.

Production remains a later, separately approved phase.
