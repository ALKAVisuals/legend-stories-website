# Order security boundary

Laatst inhoudelijk bijgewerkt: 14 augustus 2026.

## Current state

The storefront may display prices and totals in the browser, but browser values are not trusted as payment authority.

`server/commerce/order-quote.mjs` is the provider-independent server quote engine. It resolves authoritative product, variant, price, discount and shipping data from central server-controlled sources before a PayPal order can be created.

## Trusted inputs

- the central product catalog;
- the shared product-variant policy;
- the shared shipping configuration;
- the shared discount-code policy;
- integer quantities within configured limits;
- server-side payment/database state.

## Untrusted browser inputs

- product price;
- line total;
- subtotal;
- discount amount or percentage;
- shipping cost;
- grand total;
- product name or image;
- claimed payment status.

Browser values may exist for presentation, but payment creation and order persistence must derive authoritative values independently.

## Required PayPal payment flow

1. Browser sends the minimal product/variant/quantity/destination/discount request plus normalized customer data.
2. Server loads the current catalog and commerce policies.
3. Server calls the authoritative order quote.
4. A PayPal Sandbox/Live order is created only from the authoritative cent amounts and line data.
5. The durable LegendMural order stores the authoritative quote and PayPal order ID.
6. Buyer approval alone is not payment proof.
7. Server-side capture validates PayPal order ID, reference, amount and currency.
8. Neon persists the `paid` state.
9. A PayPal webhook/reconciliation layer must independently confirm/reconcile provider state before production launch.

## Validation contract

The quote engine:

- rejects empty carts;
- rejects unknown or conflicting product identifiers;
- rejects unavailable or non-EUR products;
- rejects invalid quantities and excessive cart sizes;
- validates discount codes centrally;
- applies shipping after discount using the shared commerce policy;
- returns rounded currency values and integer cent amounts;
- ignores client-supplied names, prices and totals.

Run:

```bash
npm run validate:order-security
npm run validate:commerce-runtime
npm test
```

The repository validators deliberately supply tampered browser prices to prove that client values are ignored.

## Deployment boundary

The order-security engine is now connected to Netlify Functions, Neon Postgres and PayPal create/capture handlers.

Production remains blocked until:

- PayPal webhook/reconciliation is implemented;
- PayPal Sandbox + isolated Neon staging is green;
- legacy Stripe is removed after PayPal proof;
- PayPal Live and production Neon are separately approved/configured;
- final legal/operational launch checks are complete.

Secrets remain deployment-only and never belong in browser code or repository files.
