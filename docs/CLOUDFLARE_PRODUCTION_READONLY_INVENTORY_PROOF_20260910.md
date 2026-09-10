# LegendMural — Cloudflare Production read-only inventory proof

**Date:** 2026-09-10  
**Repository:** `ALKAVisuals/legend-stories-website`  
**Scope:** read-only Cloudflare Production account inventory only

## Workflow evidence

```text
Workflow: Cloudflare Production read-only inventory
Run number: 2
Run ID: 34473528687
Head SHA: 30f5dba3ad2a8ad7b7966b5903dd0dc4d4d8e28f
Branch: main
Result: success
Confirmation: PRODUCTION_INVENTORY_READ_ONLY
```

The workflow used Cloudflare API `GET` requests only. The policy gate passed before account access. No POST, PUT, PATCH or DELETE request was used. No Worker, R2 bucket, binding, secret, DNS record, deployment or provider configuration was created or changed.

## Observed Production account state

### Production Worker

Expected name:

```text
legendmural-cloudflare-production
```

Observed:

```text
exists: false
```

Therefore:

- no remote Production Worker flags could be inspected;
- `failClosedFlagsProven=false` because the Worker is absent, not because unsafe flags were observed;
- no Production R2 bindings exist on that absent Worker;
- no Production Worker secret-name presence can be inspected yet.

The repository's intended fail-closed Production defaults remain:

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

These are intended repository configuration values only; they were not remotely proven because the Production Worker does not exist.

### Production R2 bucket

Expected name:

```text
legendmural-v3-invoice-pdfs-prod
```

Observed:

```text
exists: false
```

Therefore `r2.dev` exposure, custom-domain exposure and public-exposure state are not applicable yet. No Production R2 write occurred.

## Secret handling

No secret values were printed. The inventory only has permission to inspect secret names/presence if the Production Worker exists. Because the Worker is absent, Production secret-name presence is currently not applicable.

Expected later Production secret names remain:

```text
NEON_DATABASE_URL
PAYPAL_CLIENT_ID
PAYPAL_CLIENT_SECRET
PAYPAL_WEBHOOK_ID
RESEND_API_KEY
LEGENDMURAL_DASHBOARD_INVOICE_TOKEN
```

Their values must never be committed or printed. Their later presence does not authorize live payment, email, V3 storage or dashboard activation.

## Section B consequence

The read-only inventory closes the uncertainty about whether the expected Production resources already existed: they do not.

Still open on the Production side:

- create the private Production R2 bucket;
- create/deploy a distinct fail-closed Production Worker;
- verify its bindings and non-secret flags;
- configure required Production secrets through Cloudflare secret storage only, under separately approved steps;
- re-run read-only verification after each relevant setup step.

No Production cutover, DNS change or live feature activation is authorized by this proof.

## Exact next action

The safest next Production setup step is to request explicit owner approval to create **only** the inert private R2 bucket:

```text
legendmural-v3-invoice-pdfs-prod
```

That step must not deploy a Worker, bind a custom/public domain, write an object, configure secrets, change DNS, touch Netlify Production, activate PayPal Live/Resend, or enable any V3 feature flag.

After creation, verify read-only that the bucket exists and has no public `r2.dev` or custom-domain exposure before considering the separate Production Worker setup step.
