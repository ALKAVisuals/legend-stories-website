# LegendMural storefront — Cloudflare migration notice

**Last updated:** 2026-09-08  
**Scope:** active Netlify → Cloudflare infrastructure migration for `ALKAVisuals/legend-stories-website`.

## Current source of truth

The Cloudflare migration is now tracked primarily in this storefront repository.

Start with:

```text
docs/CLOUDFLARE_PREVIEW_B2_STATUS_20260908.md
```

Then read the locked architecture and cutover contracts:

```text
docs/CLOUDFLARE_TARGET_ARCHITECTURE_AND_MIGRATION_PLAN_20260907.md
docs/CLOUDFLARE_ENVIRONMENT_AND_SECRET_MAP.md
docs/CLOUDFLARE_CUTOVER_AND_ROLLBACK_CHECKLIST.md
docs/CLOUDFLARE_PREVIEW_ACCOUNT_PROOF_20260908.md
```

Older dashboard migration handoffs are historical continuity material only. Do not use the dashboard repository as the default place for new storefront/Cloudflare progress unless a dashboard integration itself must change.

Always fresh-check storefront `main` and open storefront PRs before continuing.

## Current checkpoint

```text
storefront main: 2a526f027bcdeb27a974ca280d05279bbc110cec
Cloudflare Worker: legendmural-cloudflare-preview
workers.dev: https://legendmural-cloudflare-preview.lively-bonus-08da.workers.dev
active Worker version: cddf4f08
```

`legendmural.com` still runs through Netlify. No Cloudflare Production cutover is authorized and LegendMural is not officially live.

## Current B2 status

Completed/proven:

- real Cloudflare preview Worker + Static Assets;
- private preview R2 binding with public access disabled;
- unknown `/api/*` fails closed;
- isolated Neon branch and least-privilege Cloudflare runtime role;
- real Worker → isolated Neon lookup proof (`404 ORDER_NOT_FOUND`);
- existing `LegendMural Sandbox` PayPal app reused;
- `PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET`, and `PAYPAL_WEBHOOK_ID` configured as Cloudflare Secrets;
- dedicated Cloudflare PayPal Sandbox webhook configured with the four approved events;
- storefront PR #212 merged, fixing deploy-time browser commerce runtime generation;
- browser runtime now exposes only the same-origin routes `/api/paypal/checkout`, `/api/order-status`, and `/api/paypal/capture`;
- preview-only checkout unpause explicitly owner-approved;
- PayPal Live, emails, and all V3 activation flags remain disabled.

Current blocker:

```text
Secure payment could not be started. Your cart is still saved. Please try again.
```

The browser-side configuration blocker is already solved. The frontend now reaches the real `POST /api/paypal/checkout` path, but its backend response has not yet been diagnosed.

## Exact next migration step

> Inspect the failed `POST /api/paypal/checkout` request in Chrome DevTools → Network → Response and capture only its HTTP status plus response body/error code. Diagnose that exact backend error before retrying checkout or changing any runtime configuration.

Do not change PayPal credentials, Neon settings, checkout flags, DNS, or Production settings before that response is known.

## Locked target architecture

```text
Vite/static hosting         -> Cloudflare Worker + Static Assets
Netlify Functions           -> Cloudflare Worker route adapters
Netlify Scheduled Function  -> Cloudflare Cron Trigger
@netlify/blobs invoice PDF  -> private Cloudflare R2
Netlify config/redirects     -> Cloudflare routing/config
Netlify preview/runtime CI   -> Cloudflare compatibility CI + real preview proof
```

Neon remains durable accounting/order truth. PayPal and Resend remain providers. The LegendMural dashboard remains hosted through ChatGPT Sites.

## Non-negotiable boundaries

- Technisch Bouwadvies stays on Netlify and must not be modified from this workstream.
- The LegendMural dashboard is not to be changed or published unless a specific dashboard integration change is required and separately approved.
- Secret/environment-variable values must never be copied into GitHub/docs/chat.
- Existing V3 commerce/accounting/numbering/idempotency/authorization contracts remain authoritative.
- Existing legal/product/launch blockers remain separate.
- No Production deployment, DNS change, Production Neon mutation, PayPal Live activation, Resend activation, V3 activation, or Netlify removal is authorized by code completion or merge.

## Production remains untouched

Do not:

- attach `legendmural.com` to Cloudflare;
- change LegendMural DNS;
- use Production Neon credentials or write Production data;
- set `PAYPAL_ALLOW_LIVE=true`;
- enable live order emails/Resend;
- activate V3 Profile 1, reconciliation, invoice storage, or dashboard invoice API;
- create/write Production R2 invoice storage;
- remove or alter Netlify Production;
- modify Technisch Bouwadvies.

Production cutover remains a separate explicit approval later.
