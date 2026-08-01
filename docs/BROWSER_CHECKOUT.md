# Browser Checkout Integration

## Current status

The storefront is connected to the hosted Checkout client, but hosted payment remains deliberately disabled:

```js
export const HOSTED_CHECKOUT_ENDPOINT = '';
```

With an empty endpoint, the existing informational order summary remains active. The browser does not contact Stripe or any payment endpoint.

## Browser flow

When a future endpoint is configured, `js/app.js` will:

1. validate the checkout form and address;
2. build the minimal order request from stable product-page IDs and quantities;
3. send only `{ request, customer }` to the configured endpoint;
4. keep browser-calculated names, prices, shipping and totals out of the network payload;
5. validate the returned Stripe session ID, mode, reference and Checkout URL;
6. store the server-generated reference and session ID in `sessionStorage`;
7. redirect only to `https://checkout.stripe.com`.

The cart is not cleared on redirect or on the return page. Cart clearing must wait for a future server-verified payment status.

## Return pages

- `order-success.html` is a neutral payment-return page. It does not claim the order is paid before server verification exists.
- `order-cancelled.html` explains that no payment was completed and that the browser cart remains saved.
- Both pages are marked `noindex, nofollow`.

## Future activation checklist

Activation must be handled in a separate deployment sprint:

1. Deploy a thin serverless adapter around `server/api/create-checkout-session.mjs`.
2. Configure a Stripe test secret on the server only.
3. Configure server-controlled success and cancellation URLs.
4. Configure the allowed storefront origin.
5. Set `HOSTED_CHECKOUT_ENDPOINT` to the deployed HTTPS endpoint or same-origin route.
6. Complete an end-to-end Stripe test-mode payment.
7. Add a signed Stripe webhook and persistent order-status storage.
8. Clear the cart only after the application has verified the paid order status.
9. Keep live Stripe mode blocked until test-mode checkout, webhook handling, refunds and operational procedures are reviewed.

## Security invariants

- Stripe secret keys never appear under `js/` or in HTML.
- Endpoint requests use `credentials: 'omit'` and reject unexpected HTTP redirects.
- Non-local endpoints require HTTPS.
- Browser responses may redirect only to `checkout.stripe.com`.
- The endpoint remains empty in the repository until deployment is intentionally configured.
- Client prices and totals never become payment authority.

## Validation

Run:

```bash
npm run validate:browser-checkout
npm test
npm run quality
```

The browser checkout gate checks the dormant configuration, minimal request payload, Stripe redirect restrictions, return-page wording and indexing policy.
