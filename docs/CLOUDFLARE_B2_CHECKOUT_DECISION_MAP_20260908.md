# LegendMural Cloudflare B2 — checkout decision map after unpause

**Date:** 2026-09-08  
**Repository:** `ALKAVisuals/legend-stories-website`  
**Starting `main`:** `8454f8dbc59bbd456e6699e1784be19e3fb35e18`  
**Scope:** read-only code audit / documentation only. No Cloudflare, PayPal, Neon, DNS, Production, Netlify, dashboard, Resend, V3 activation, or Technisch Bouwadvies change.

## 1. Why this exists

The public Cloudflare preview currently proves:

```text
POST /api/paypal/checkout
HTTP 503
error.code: CHECKOUT_PAUSED
```

The canonical current execution status remains:

```text
docs/CLOUDFLARE_PREVIEW_B2_STATUS_20260908.md
```

This document is a supporting code-level decision map for the **first checkout attempt after the preview runtime flag is restored to `LEGENDMURAL_CHECKOUT_PAUSED=false`**.

Do not use this map as permission to unpause Production or enable PayPal Live.

## 2. Entry boundary

`cloudflare/worker.mjs` checks the preview checkout pause before loading the active API runtime.

When:

```text
LEGENDMURAL_CHECKOUT_PAUSED=true
```

checkout stops immediately with:

```text
503 CHECKOUT_PAUSED
```

When the owner-approved preview-only Sandbox proof restores:

```text
LEGENDMURAL_CHECKOUT_PAUSED=false
```

then `/api/paypal/checkout` proceeds to `handleActiveCheckout(...)`.

For a normal browser request from the same `workers.dev` origin, the Worker derives:

```text
/order-success.html
/order-cancelled.html
```

from the request origin. Therefore the normal same-origin preview path does not depend on Production return URLs.

## 3. Cloudflare checkout bootstrap boundary

Before PayPal order creation, `cloudflare/api-runtime.mjs` resolves:

1. the V3 order-creation document profile;
2. the Cloudflare commerce order store backed by `NEON_DATABASE_URL`;
3. the shared PayPal create-order handler.

Current B2 flags intentionally keep:

```text
V3_PROFILE1_ORDER_CREATION_ENABLED=false
```

so the document profile resolves to legacy/profile `0`. A `V3_ORDER_CREATION_NOT_CONFIGURED` response would therefore indicate that this safety flag or its surrounding configuration changed unexpectedly and should be stopped/investigated rather than worked around.

Possible bootstrap failures:

```text
503 V3_ORDER_CREATION_NOT_CONFIGURED
503 PAYPAL_CHECKOUT_SERVICE_NOT_CONFIGURED
500 PAYPAL_CHECKOUT_SERVICE_FAILED
```

`PAYPAL_CHECKOUT_SERVICE_NOT_CONFIGURED` is the Cloudflare wrapper response for commerce-runtime configuration failures such as a missing/invalid Neon checkout-store configuration.

A real `/api/order-status` request has already proven that the current Worker could reach the isolated Neon branch using the preview least-privilege credential. The checkout persistence path still needs a real write proof after unpause.

## 4. Request-contract failures before PayPal API work

The shared create-order handler can reject the browser request before contacting PayPal.

Normal request-level results include:

```text
403 ORIGIN_NOT_ALLOWED
405 METHOD_NOT_ALLOWED
400 UNSUPPORTED_CONTENT_TYPE
400 REQUEST_TOO_LARGE
400 INVALID_JSON
```

The browser runtime is same-origin and has already reached the Worker successfully, so `ORIGIN_NOT_ALLOWED` would be a new regression or unexpected origin/config change.

The checkout payload is then revalidated server-side. User/cart validation errors map to HTTP 400, including these important groups:

```text
INVALID_CUSTOMER
INVALID_COUNTRY
COUNTRY_MISMATCH
EMPTY_CART
TOO_MANY_LINE_ITEMS
TOO_MANY_ITEMS
INVALID_QUANTITY
MISSING_PRODUCT_ID
UNKNOWN_PRODUCT
PRODUCT_ID_MISMATCH
UNKNOWN_PRODUCT_VARIANT
UNSUPPORTED_CURRENCY
PRODUCT_UNAVAILABLE
INVALID_DISCOUNT_CODE
SHIPPING_COUNTRY_UNAVAILABLE
QUOTE_RECONCILIATION_FAILED
INVALID_CHECKOUT_URL
INVALID_PAYPAL_CLIENT
INVALID_PAYPAL_ORDER
```

These are request/catalog/integrity failures, not Cloudflare infrastructure failures.

## 5. PayPal Sandbox client-configuration failures

The PayPal client defaults to:

```text
https://api-m.sandbox.paypal.com
```

when `PAYPAL_API_BASE` is absent.

Current B2 must keep:

```text
PAYPAL_ALLOW_LIVE=false
```

Configuration failures map to HTTP 503 and keep their specific code, for example:

```text
PAYPAL_CREDENTIALS_NOT_CONFIGURED
INVALID_PAYPAL_API_BASE
PAYPAL_LIVE_NOT_ALLOWED
UNTRUSTED_PAYPAL_API_BASE
PAYPAL_FETCH_UNAVAILABLE
```

If one of these appears tomorrow, do not rotate or paste secret values into chat. First inspect the Cloudflare preview variable/secret names and environment scope only.

## 6. PayPal outbound API failures

If PayPal client creation succeeds, the server first obtains a Sandbox OAuth token and then creates a PayPal order.

PayPal transport/API failures map to HTTP 502. Important codes are:

```text
PAYPAL_OAUTH_FAILED
PAYPAL_OAUTH_INVALID_RESPONSE
PAYPAL_API_REQUEST_FAILED
PAYPAL_API_INVALID_RESPONSE
INVALID_PAYPAL_ORDER_ID
INVALID_PAYPAL_REQUEST_ID
```

Interpretation:

- `PAYPAL_OAUTH_FAILED` strongly points to PayPal Sandbox authentication/credential validity or PayPal's OAuth response;
- `PAYPAL_API_REQUEST_FAILED` means PayPal authenticated the request path far enough to reject the actual API operation;
- `PAYPAL_API_INVALID_RESPONSE` / `PAYPAL_OAUTH_INVALID_RESPONSE` means PayPal returned an unexpected/non-usable response;
- `INVALID_PAYPAL_ORDER_ID` means the returned order identity failed the repository's strict validation.

Do not switch to PayPal Live to solve any Sandbox error.

## 7. Successful PayPal order must still be persisted to isolated Neon

The checkout flow intentionally does **not** return success merely because PayPal created an order.

After PayPal returns a valid Sandbox order and approval URL, the code persists a durable pending order to Neon and validates the exact persisted result.

Persistence/integrity failures map primarily to HTTP 503, except an immutable conflict which maps to HTTP 409.

Relevant codes include:

```text
503 CHECKOUT_STORE_NOT_CONFIGURED
503 CHECKOUT_PERSISTENCE_FAILED
503 INVALID_CHECKOUT_RECORD
503 INVALID_CHECKOUT_STORE_RESULT
503 CHECKOUT_AMOUNT_MISMATCH
503 CHECKOUT_CURRENCY_MISMATCH
409 CHECKOUT_STORE_CONFLICT
```

The Neon adapter uses serializable transactions, validates immutable order data, treats matching repeat persistence idempotently, and rejects conflicting persisted state.

Because PayPal order creation occurs before the Neon persistence write, repeated manual checkout retries after a persistence failure are intentionally avoided. The PayPal create call uses a deterministic idempotency key derived from the checkout reference, but the correct procedure is still: **one attempt → inspect exact response → diagnose before retry**.

## 8. Expected successful create-order boundary

The expected successful `/api/paypal/checkout` result is:

```text
HTTP 201
provider: paypal
mode: test
sessionId: <PayPal Sandbox order id>
url: <HTTPS PayPal Sandbox approval URL>
reference: <deterministic checkout reference>
```

The approval URL is accepted only if it resolves to a trusted PayPal Sandbox hostname when `mode=test`.

At that point the browser should proceed to PayPal Sandbox buyer approval. That is the next success boundary; it does **not** yet prove capture, webhook reconciliation, or Neon paid-state finalization.

## 9. Exact runtime decision rule for the next attempt

After Cloudflare access is available:

1. fresh-check the exact active preview Worker version/deployment;
2. confirm `PAYPAL_ALLOW_LIVE=false`, `ORDER_EMAILS_ENABLED=false`, and all V3 activation flags remain `false`;
3. change only preview runtime `LEGENDMURAL_CHECKOUT_PAUSED=false` under the already-approved Sandbox proof;
4. perform exactly one checkout attempt;
5. read the HTTP status + `error.code` or the HTTP 201 payload;
6. classify it using this document before changing anything else.

Quick classification:

```text
503 CHECKOUT_PAUSED
  -> preview flag did not become active / was reapplied

503 PAYPAL_CHECKOUT_SERVICE_NOT_CONFIGURED
  -> Cloudflare commerce bootstrap / Neon config boundary

503 PAYPAL_* configuration code
  -> PayPal Sandbox client configuration boundary

502 PAYPAL_OAUTH_*
  -> PayPal Sandbox OAuth boundary

502 PAYPAL_API_*
  -> PayPal Sandbox order API boundary

400 ...
  -> browser payload, customer, catalog, shipping, quote, or PayPal response-integrity validation

503 CHECKOUT_* persistence/integrity
409 CHECKOUT_STORE_CONFLICT
  -> PayPal create may already have succeeded; inspect isolated Neon persistence boundary before retry

201
  -> PayPal Sandbox create-order + isolated pending-order persistence succeeded; continue to buyer approval proof
```

## 10. Safety locks remain unchanged

This audit does not authorize any of the following:

- Production Cloudflare deployment/cutover;
- DNS/custom-domain changes;
- Production Neon credentials or writes;
- PayPal Live credentials or `PAYPAL_ALLOW_LIVE=true`;
- Resend/order emails;
- V3 Profile 1;
- V3 reconciliation;
- V3 invoice storage;
- dashboard invoice API;
- Production R2 writes;
- Netlify removal/change;
- LegendMural dashboard changes/publication;
- Technisch Bouwadvies changes.
