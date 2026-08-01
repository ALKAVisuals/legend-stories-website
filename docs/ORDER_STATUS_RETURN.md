# Verified Order Status Return Flow

## Current status

The payment return page can verify an order with a server endpoint, but verification remains deliberately disabled:

```js
export const ORDER_STATUS_ENDPOINT = '';
```

With an empty endpoint, the return page performs no network request and never clears the cart.

## Verification identity

The browser must possess both:

- the 64-character server-generated order reference stored in `sessionStorage`;
- the exact Stripe Checkout Session ID returned in the success URL.

The return script compares the URL session ID with the stored session ID before contacting the server. It then removes the query string from the address bar.

The status request contains only:

```json
{
  "reference": "…",
  "sessionId": "cs_test_…"
}
```

No browser price, total, customer, address or product data is sent.

## Server endpoint

`server/api/order-status.mjs` requires an injected store with:

```js
orderStore.getOrderByReference(reference)
```

The endpoint:

- accepts only `POST` JSON requests;
- enforces the configured storefront origin;
- returns `503` without a store;
- returns the same generic `404` for an unknown reference, wrong session ID or wrong test/live mode;
- returns `500` for corrupt stored status data;
- uses `Cache-Control: no-store`;
- returns no customer, address, product or payment amount data.

The successful response is limited to:

```json
{
  "reference": "…",
  "sessionId": "cs_test_…",
  "mode": "test",
  "status": "paid",
  "paid": true,
  "terminal": true,
  "updatedAt": 1800000000,
  "version": 2
}
```

## Cart-clearing policy

The cart is cleared only when the endpoint response is internally consistent and contains:

```text
status = paid
paid = true
```

The following statuses never clear the cart:

- `payment_pending`;
- `payment_processing`;
- `payment_failed`;
- `expired`;
- unknown or unavailable status.

Verified cleanup removes only Checkout-related keys. Unrelated browser preferences and session data remain untouched.

## Return-page behavior

`order-success.html` loads `js/order-return.js` and displays one of the following states:

- verification disabled;
- verification in progress;
- payment pending;
- payment processing;
- payment failed;
- Checkout expired;
- payment confirmed;
- verification unavailable.

The page remains `noindex, nofollow`.

## Future activation

1. Implement a durable order store supporting pending-order persistence, webhook event processing and order lookup.
2. Deploy the Checkout, webhook and order-status adapters.
3. Configure the same allowed storefront origin on Checkout and status endpoints.
4. Set `ORDER_STATUS_ENDPOINT` to the deployed HTTPS endpoint or same-origin route.
5. Complete test-mode payments for immediate and delayed payment methods.
6. Confirm that pending and failed states retain the cart.
7. Confirm that only a signed webhook transition to `paid` clears the cart on return.
8. Keep live mode disabled until operational review is complete.

## Validation

Run:

```bash
npm run validate:order-return
npm test
npm run quality
```

The catalog-wide validation checks privacy-minimal status responses and paid-only cart clearing for all 111 products.
