# Netlify production host decision

Laatst inhoudelijk bijgewerkt: 14 augustus 2026.

## Decision

LegendMural uses Netlify as the single intended production host for the storefront and serverless commerce layer.

GitHub remains responsible for source control, branches, pull requests, CI, code review and repository history. GitHub Pages is not maintained as a second production website target.

## Why

The storefront contains runtime-generated Vite asset URLs, cart persistence, a runtime product registry and Netlify Functions for PayPal checkout/capture and order status. Maintaining a second public host with a repository-prefixed base path previously introduced duplicate URL rules and caused cart image, runtime asset and deployment-artifact complexity without adding a production requirement.

A single production host keeps these contracts aligned:

- Vite browser assets use the Netlify root deployment model;
- cart image recovery only accepts approved local Netlify/Vite paths;
- `/api/paypal/checkout`, `/api/paypal/capture` and `/api/order-status` remain same-origin Netlify routes;
- PayPal and Neon secrets remain server-side;
- PayPal Live stays fail-closed until separately approved;
- GitHub Actions can focus on quality, accessibility and Netlify compatibility instead of publishing a second website.

## Temporary legacy Stripe routes

`netlify.toml` still contains legacy Stripe fallback routes while PayPal Sandbox + Neon staging is being proven. Stripe is not the intended launch provider and these routes must be removed in a dedicated cleanup PR after the complete PayPal flow, including webhook/reconciliation, is green.

## Guardrail

Future work must not add GitHub Pages or another parallel production host without an explicit architecture decision that covers runtime asset paths, cart persistence, checkout routing, canonical URLs, SEO and operational ownership.
