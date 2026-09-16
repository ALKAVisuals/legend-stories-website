# LegendMural Cloudflare — PayPal Stage P1 proof

**Date:** 2026-09-14
**Starting main:** `bc495a382e8bc307740b141cd8e73acddd791d10`

Stage P1 was executed with owner approval according to `docs/CLOUDFLARE_PAYPAL_LIVE_ACTIVATION_PLAN_20260911.md`.

## Verified state

- The four required Production dependency entries defined by the activation plan are present in the Cloudflare Production Worker and displayed as encrypted entries.
- Canonical checkout success, cancel and allowed-origin configuration is present.
- `PAYPAL_API_BASE=https://api-m.paypal.com` is present.
- `LEGENDMURAL_CHECKOUT_PAUSED=true` remains unchanged.
- `PAYPAL_ALLOW_LIVE=false` remains unchanged.
- `ORDER_EMAILS_ENABLED=false` remains unchanged.
- All V3 activation flags remain false.
- A direct request to `https://legendmural.com/api/paypal/checkout` returned HTTP 503 with `CHECKOUT_PAUSED`, `Cache-Control: no-store`, Cloudflare serving evidence and the expected security headers.
- The PayPal Live app `LegendMural Production` has its webhook target set to exactly `https://legendmural.com/api/paypal/webhook`.
- No real order or payment was attempted during P1.

No credential values, connection strings, PayPal identifiers, customer data or payment identifiers are recorded in this proof.

## Result

**Stage P1 is complete for its defined scope.**

The next possible stage is **P2**, which requires a new explicit owner approval. During P2 checkout must remain paused. P2 is not approval for a real payment or customer checkout.