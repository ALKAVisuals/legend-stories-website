# LegendMural Cloudflare PayPal Live — Stage P2 proof

**Date:** 2026-09-14  
**Repository:** `ALKAVisuals/legend-stories-website`  
**Starting `main`:** `bc0477dfe9686ca36c0bdb7317275735177c383b`  
**Scope:** prove Stage P2 only: enable the PayPal Live client while keeping customer checkout paused.

## Authorization

The owner explicitly authorized **Stage P2** after Stage P1 had been completed and recorded in GitHub.

This authorization covered only:

```text
PAYPAL_ALLOW_LIVE=true
```

while preserving:

```text
LEGENDMURAL_CHECKOUT_PAUSED=true
ORDER_EMAILS_ENABLED=false
V3_PROFILE1_ORDER_CREATION_ENABLED=false
V3_INVOICE_RECONCILIATION_ENABLED=false
V3_INVOICE_STORAGE_ENABLED=false
V3_DASHBOARD_INVOICE_API_ENABLED=false
```

It did not authorize Stage P3, a real payment, customer checkout, Production email, V3 activation, R2 writes, DNS changes or Netlify decommission.

## Verified Cloudflare runtime state

Provider-side screenshots were reviewed after the P2 mutation and confirmed:

- `PAYPAL_ALLOW_LIVE=true`;
- `PAYPAL_API_BASE=https://api-m.paypal.com`;
- `LEGENDMURAL_CHECKOUT_PAUSED=true`;
- `ORDER_EMAILS_ENABLED=false`;
- all four V3 activation flags remain `false`;
- `NEON_DATABASE_URL` remains stored as an encrypted secret;
- `PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET` and `PAYPAL_WEBHOOK_ID` remain stored as encrypted secrets.

No secret values were copied into this repository proof.

## Read-only / no-charge runtime verification

The following live endpoint checks were performed after enabling `PAYPAL_ALLOW_LIVE=true`:

```text
GET /api/paypal/checkout
=> CHECKOUT_PAUSED
```

Result: PASS. New checkout creation remains blocked by the kill switch.

```text
GET /api/paypal/webhook
=> METHOD_NOT_ALLOWED
```

Result: PASS. The webhook route now initializes beyond the previous Live-configuration block and safely rejects GET because it accepts POST only.

```text
GET /api/paypal/capture
=> METHOD_NOT_ALLOWED
```

Result: PASS. The capture route initializes and rejects GET before any capture operation.

```text
GET /api/order-status
=> METHOD_NOT_ALLOWED
```

Result: PASS. The order-status route initializes and rejects GET before any order lookup.

These checks were intentionally non-mutating. No order was created, no PayPal payment or capture was attempted, and no deliberate Neon write, R2 write or customer email was performed.

## P2 conclusion

**Stage P2: PASS / COMPLETE for its defined scope.**

The PayPal Live client is enabled for the Production Worker while customer checkout remains paused. The Production runtime remains contained and fail-closed for new checkout creation.

Current guarded state:

```text
PAYPAL_ALLOW_LIVE=true
LEGENDMURAL_CHECKOUT_PAUSED=true
ORDER_EMAILS_ENABLED=false
V3_PROFILE1_ORDER_CREATION_ENABLED=false
V3_INVOICE_RECONCILIATION_ENABLED=false
V3_INVOICE_STORAGE_ENABLED=false
V3_DASHBOARD_INVOICE_API_ENABLED=false
```

## Next gate

The next possible payment phase is **Stage P3** as defined in `docs/CLOUDFLARE_PAYPAL_LIVE_ACTIVATION_PLAN_20260911.md`.

P3 requires a **new, separate explicit owner approval** because it involves a tightly controlled real self-payment and a brief checkout-unpause window.

Until that approval is given:

- keep checkout paused;
- do not create a real order;
- do not perform a PayPal payment or capture;
- do not enable customer checkout;
- do not enable Production order emails;
- do not enable any V3 activation flag;
- do not write Production R2 objects;
- do not decommission Netlify.
