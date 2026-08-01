# Order security boundary

## Current state

The storefront may display prices and totals in the browser, but browser values are not trusted as payment authority.

`server/commerce/order-quote.mjs` is the provider-independent server quote engine. It accepts only product identifiers, quantities, destination country and an optional discount code. Product names, images, availability, currency and prices are resolved again from `data/products/catalog.json`.

## Trusted inputs

- the central product catalog;
- the shared shipping configuration;
- the shared discount-code policy;
- integer quantities within the configured limits.

## Untrusted browser inputs

- product price;
- line total;
- subtotal;
- discount amount or percentage;
- shipping cost;
- grand total;
- product name or image.

These values may be present for display purposes, but a server endpoint must ignore them and use the authoritative quote output instead.

## Required payment flow

1. The browser sends `{ items: [{ page, quantity }], countryCode, discountCode }`.
2. The server loads the current product catalog.
3. The server calls `createAuthoritativeOrderQuote()`.
4. A payment session is created from `quote.amountInCents.grandTotal` and the authoritative line data.
5. The order stores the quote and the payment-provider session ID.
6. A signed provider webhook confirms payment before the order is marked paid.

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

Run `npm run validate:order-security` to quote every catalog product by page and slug while deliberately supplying tampered browser prices.

## Deployment boundary

This repository does not yet connect the engine to Stripe, Netlify or another server platform. That integration must be a separate reviewed change because it requires secrets, provider configuration, webhook verification and production URLs.
