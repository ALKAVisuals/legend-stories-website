# LegendMural Cloudflare preview API route matrix proof

**Date:** 2026-09-10  
**Repository:** `ALKAVisuals/legend-stories-website`  
**Head SHA:** `573db2a7ddd2d972a5dcbd2efbd1f39e40dea216`  
**Workflow:** `Cloudflare preview API route matrix`  
**Run:** #1  
**Run ID:** `34471706281`  
**Result:** success

## Scope

This was a read-only remote proof against the existing canonical Cloudflare preview Worker:

`https://legendmural-cloudflare-preview.lively-bonus-08da.workers.dev`

The workflow used only `GET` requests with no request bodies. It used no Cloudflare, Neon, PayPal, Resend or dashboard secrets and performed no deploy, DNS change, Production action, order creation, capture, webhook processing or invoice write.

## Exact observed route matrix

| Path | Method | HTTP | Response code |
|---|---|---:|---|
| `/api/paypal/checkout` | GET | 503 | `CHECKOUT_PAUSED` |
| `/api/paypal/capture` | GET | 405 | `METHOD_NOT_ALLOWED` |
| `/api/paypal/webhook` | GET | 405 | `METHOD_NOT_ALLOWED` |
| `/api/order-status` | GET | 405 | `METHOD_NOT_ALLOWED` |
| `/api/invoice-download` | GET | 405 | `METHOD_NOT_ALLOWED` |
| `/api/internal/dashboard-invoice` | GET | 405 | `METHOD_NOT_ALLOWED` |

The verifier also required JSON responses and `no-store` cache policy. All six intended routes reached the canonical preview Worker and returned the expected fail-closed response.

## Conclusion

The Section B routing evidence gap is closed for the existing Cloudflare preview Worker. This proof does not authorize or imply any Production cutover or Production account configuration.

## Next migration step

Reconcile the remaining Cloudflare account-side Section B items read-only before any Production mutation. In particular, inventory whether a separate Production Worker exists, whether the expected Production R2 bucket exists and remains unused/private, and whether any Production secret configuration is present by **name/presence only**. Do not print secret values and do not create or change Production resources without separate explicit owner approval.
