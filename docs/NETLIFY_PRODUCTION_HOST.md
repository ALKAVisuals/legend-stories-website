# Netlify production host decision

## Decision

LegendMural uses Netlify as the single intended production host for the storefront and serverless commerce layer.

GitHub remains responsible for source control, branches, pull requests, CI, code review and repository history. GitHub Pages is not maintained as a second production website target.

## Why

The storefront contains runtime-generated Vite asset URLs, cart persistence, a runtime product registry and Netlify Functions for checkout, webhook and order status. Maintaining a second public host with a repository-prefixed base path introduced duplicate URL rules and caused cart image, runtime asset and deployment-artifact complexity without adding a production requirement.

A single production host keeps these contracts aligned:

- Vite browser assets use the Netlify root deployment model;
- cart image recovery only accepts approved local Netlify/Vite paths;
- `/api/checkout`, `/api/order-status` and `/api/stripe-webhook` remain same-origin Netlify routes;
- production secrets and Stripe live enablement stay server-side;
- GitHub Actions can focus on quality, accessibility and Netlify compatibility instead of publishing a second website.

## Guardrail

Future work must not add GitHub Pages or another parallel production host without an explicit architecture decision that covers runtime asset paths, cart persistence, checkout routing, canonical URLs, SEO and operational ownership.
