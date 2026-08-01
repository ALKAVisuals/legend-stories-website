# Payment server modules

- `stripe-api.mjs` is the minimal Stripe HTTPS client. Test secret keys are accepted by default; live keys require an explicit opt-in.
- `checkout-session.mjs` converts an authoritative order quote into exact Stripe Checkout line items and creates a hosted Checkout Session through an injected Stripe client.
- `../api/create-checkout-session.mjs` exposes the platform-neutral HTTP boundary.

These modules are server-only. Do not import them from browser code and never expose `STRIPE_SECRET_KEY` to the storefront.
