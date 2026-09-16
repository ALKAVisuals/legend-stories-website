# LegendMural — Cloudflare environment & secret map

**Last updated:** 2026-09-10  
**Rule:** names/classification only. Secret values must never be committed to GitHub.

## 1. Deployment contexts

Cloudflare runtime truth:

```text
LEGENDMURAL_DEPLOY_CONTEXT=preview
LEGENDMURAL_DEPLOY_CONTEXT=production
```

Do not use Netlify `CONTEXT` as Cloudflare production truth.

## 2. Cloudflare Secrets

Configure secrets through Cloudflare Secrets for the exact environment **and activation stage that actually needs them**. Do not add them to `wrangler.jsonc` `vars`.

**Stage C hosting-only rule:** the Production Worker intentionally has **zero LegendMural application secrets** while checkout, PayPal Live, email, V3 storage/reconciliation and the dashboard invoice API remain OFF. An absent Stage C application secret is therefore expected, not a setup defect. Never put Sandbox credentials into Production merely to satisfy an inventory/checklist item.

| Name | Purpose | Preview | Production activation rule |
|---|---|---:|---|
| `NEON_DATABASE_URL` | Neon runtime connection | isolated/non-production credential only | dedicated least-privilege Production credential only when an approved active path needs Neon |
| `PAYPAL_CLIENT_ID` | PayPal server API | sandbox credential | live/approved Production credential only when payment activation is separately authorized |
| `PAYPAL_CLIENT_SECRET` | PayPal server API | sandbox credential | live/approved Production credential only when payment activation is separately authorized |
| `PAYPAL_WEBHOOK_ID` | PayPal webhook verification | preview/sandbox endpoint ID | Production endpoint ID only when the Production webhook step is separately approved |
| `RESEND_API_KEY` | transactional email API | non-live/test where needed | Production key only when email activation is approved |
| `LEGENDMURAL_DASHBOARD_INVOICE_TOKEN` | storefront internal dashboard authorization | absent by default | configure only when dashboard invoice API activation is approved |

Any later credential/token discovered by runtime review is secret by default unless proven otherwise.

Dedicated Stage C rationale and fail-closed route expectations: `docs/CLOUDFLARE_STAGE_C_ZERO_SECRET_DECISION_20260910.md`.

## 3. Non-secret environment variables / feature flags

These may be Cloudflare `vars` because they contain deployment policy/configuration rather than credentials.

| Name | Preview migration default | Production migration default | Activation rule |
|---|---|---|---|
| `LEGENDMURAL_DEPLOY_CONTEXT` | `preview` | `production` | fixed per environment |
| `LEGENDMURAL_CHECKOUT_PAUSED` | `true` | `true` | unpause only during approved cutover/activation step |
| `CHECKOUT_SUCCESS_URL` | preview/runtime same-origin where applicable | `https://legendmural.com/order-success.html` | preserve canonical return path |
| `CHECKOUT_CANCEL_URL` | preview/runtime same-origin where applicable | `https://legendmural.com/order-cancelled.html` | preserve canonical return path |
| `CHECKOUT_ALLOWED_ORIGINS` | explicit preview origin(s) only when known | `https://legendmural.com` | never wildcard |
| `PAYPAL_API_BASE` | PayPal sandbox API URL/config when required | live/sandbox according to separately approved mode | provider contract unchanged |
| `PAYPAL_ALLOW_LIVE` | `false` | `false` | may become `true` only in approved live-payment step |
| `ORDER_EMAILS_ENABLED` | `false` | `false` | enable only after Resend/live delivery approval |
| `ORDER_NOTIFICATION_TO` | non-production destination only if needed | approved merchant recipient only | not a credential; still treat as operational data |
| `RESEND_FROM` | approved test identity if needed | final technical sender identity only after decision/verification | unresolved V3 input remains separate |
| `RESEND_REPLY_TO` | approved test identity if needed | `info@legendmural.com` or current approved value | no secret value required |
| `V3_PROFILE1_ORDER_CREATION_ENABLED` | `false` | `false` | separate controlled V3 cutover only |
| `V3_INVOICE_RECONCILIATION_ENABLED` | `false` | `false` | separate controlled V3 activation only |
| `V3_INVOICE_STORAGE_ENABLED` | `false` | `false` | R2 writes forbidden until separately approved |
| `V3_DASHBOARD_INVOICE_API_ENABLED` | `false` | `false` | separate dashboard integration activation only |

## 4. Cloudflare bindings

### Static assets

```text
ASSETS -> ./dist
```

### Private invoice PDFs

```text
binding: V3_INVOICE_PDFS
preview bucket:    legendmural-v3-invoice-pdfs-preview
production bucket: legendmural-v3-invoice-pdfs-prod
```

Buckets must remain private. No public R2 domain is part of the invoice contract. The Production binding may exist during Stage C while `V3_INVOICE_STORAGE_ENABLED=false`; no Production R2 invoice write is authorized by that binding alone.

## 5. Netlify-only items being retired from runtime truth

```text
CONTEXT
Netlify Function routing
@netlify/blobs runtime credentials/context
Netlify Scheduled Function metadata
```

They remain in the repository during the migration/rollback window because Netlify Production remains the current host until cutover.

## 6. Secret transfer procedure at a later approved activation step

1. Confirm that the target feature/stage has separate explicit approval and actually requires the secret.
2. Read the configured value directly from the authorized provider/hosting environment; never copy it through GitHub.
3. Classify the value against this document.
4. Create the Cloudflare Secret in the correct Worker environment.
5. Never print the value into CI logs, PR comments, docs, screenshots or commit messages.
6. Verify only presence/behavior, not the secret contents.
7. Preview receives sandbox/isolated credentials only.
8. Production must never receive Sandbox credentials merely for migration parity.
9. Production credentials remain unused while the relevant feature flag is OFF.
10. Rotate a credential only when rotation is separately required; migration does not itself require unnecessary secret rotation.

## 7. Current safety checkpoint

`wrangler.jsonc` intentionally contains **no credential values** and keeps every commerce/V3 Production activation flag OFF. Stage C intentionally requires no LegendMural application secrets in the Production Worker. This document does not authorize provisioning, secret creation, DNS changes or Production feature activation.
