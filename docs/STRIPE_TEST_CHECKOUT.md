# Stripe test Checkout boundary

## Current scope

The repository now contains a platform-neutral server endpoint for creating Stripe-hosted Checkout Sessions:

- `server/api/create-checkout-session.mjs`
- `server/payments/checkout-session.mjs`
- `server/payments/stripe-api.mjs`

The endpoint always rebuilds the order from `data/products/catalog.json` through the authoritative order quote engine. Browser-supplied product names, prices, line totals, discounts, shipping costs and grand totals are ignored.

No Netlify configuration, deployment adapter, Stripe secret or live checkout redirect is included in this sprint.

## Test-mode safety

`STRIPE_SECRET_KEY` must start with `sk_test_` by default. A key starting with `sk_live_` is rejected unless `STRIPE_ALLOW_LIVE=true` is deliberately configured in the server environment.

Never commit Stripe keys to GitHub. Store them only in the secret manager of the eventual serverless platform.

## Required server environment

```text
STRIPE_SECRET_KEY=sk_test_...
CHECKOUT_SUCCESS_URL=https://your-domain.example/order-success.html
CHECKOUT_CANCEL_URL=https://your-domain.example/order-cancelled.html
CHECKOUT_ALLOWED_ORIGINS=https://your-domain.example
```

Optional:

```text
STRIPE_API_VERSION=<account-compatible Stripe API version>
STRIPE_API_BASE=https://api.stripe.com/v1
```

## Request contract

The endpoint accepts a JSON `POST` body containing only the minimal order request and customer delivery data:

```json
{
  "request": {
    "items": [
      {
        "page": "music-example.html",
        "quantity": 1
      }
    ],
    "countryCode": "NL",
    "discountCode": "LEGEND10"
  },
  "customer": {
    "firstname": "Test",
    "lastname": "Buyer",
    "email": "buyer@example.com",
    "street": "Teststraat 10",
    "zip": "1234 AB",
    "city": "Amsterdam",
    "country": "NL"
  }
}
```

The response contains a Stripe Checkout Session ID, hosted Checkout URL, test/live mode and a non-reversible order reference hash.

## Security controls

- POST-only JSON endpoint with a 32 KB request limit;
- same-origin requests allowed by default and explicit cross-origin allowlist support;
- server-controlled success and cancel URLs;
- catalog-authoritative product names and prices;
- central discount and shipping policies;
- deterministic idempotency keys;
- exact integer-cent reconciliation between quote and Stripe line items;
- validated Stripe-hosted redirect URL;
- no customer address or email stored in Stripe metadata;
- no Stripe secret returned in errors.

## Discount representation

Stripe Checkout does not accept negative line items. The central discount amount is therefore distributed deterministically across the product line totals using largest-remainder allocation. Each displayed Stripe product line represents the complete total for that product and includes the original quantity in its description. Shipping is added as a separate line when required.

The generated Stripe line items must always add up exactly to the authoritative grand total in cents.

## Remaining work before activation

1. Choose a serverless platform and add a thin adapter around `handleCreateCheckoutSession()`.
2. Configure the server-only environment variables and test secret.
3. Add the endpoint URL to the storefront configuration.
4. Wire the existing checkout button to POST the minimal request and redirect to the returned Stripe URL.
5. Add a signed Stripe webhook using the raw request body.
6. Persist completed orders idempotently before enabling live payments.

Stripe documentation:

- https://docs.stripe.com/api/checkout/sessions/create
- https://docs.stripe.com/webhooks
- https://docs.stripe.com/testing-use-cases
