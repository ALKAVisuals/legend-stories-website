# LegendMural storefront — Cloudflare migration notice

**Last updated:** 2026-09-07  
**Scope:** infrastructure routing notice for `ALKAVisuals/legend-stories-website`.

## Current state

`legendmural.com` still runs through Netlify. No Cloudflare Production cutover is authorized and LegendMural is not officially live.

A read-only Netlify → Cloudflare migration audit was completed on 2026-09-07 against storefront `main`:

```text
7c3fd2422ef06045e8d49a2f6f543f2c61f26403
```

The canonical migration handoff lives in the dashboard/handoff repository:

```text
ALKAVisuals/legendmural-dashboard
docs/CLOUDFLARE_MIGRATION_READ_ME_FIRST.md
```

Always fresh-check current `main`; the SHA above is only the audit checkpoint.

## Boundaries

- Technisch Bouwadvies stays on Netlify and must not be modified from the LegendMural Cloudflare workstream.
- The LegendMural dashboard stays hosted through ChatGPT Sites.
- Neon should remain the database unless a later source-backed blocker proves otherwise.
- PayPal and Resend should remain providers unless a later source-backed blocker proves otherwise.
- Secret/environment-variable values must never be copied into GitHub.
- Existing V3 commerce/accounting/numbering/idempotency/authorization contracts remain authoritative and must be preserved.
- Existing launch/legal/product blockers remain separate and are not closed by the hosting migration.
- No Production deployment, DNS change, secret rotation, Production migration or V3 activation is authorized by this notice.

## Audit direction

The migration should preserve the existing application/business architecture and replace the Netlify-specific platform layer:

```text
Vite/static hosting         -> Cloudflare Worker + Static Assets
Netlify Functions           -> Cloudflare Worker route adapters
Netlify Scheduled Function  -> Cloudflare Cron Trigger
@netlify/blobs invoice PDF  -> private Cloudflare R2
Netlify config/redirects     -> Cloudflare routing/config
Netlify preview/runtime CI   -> Cloudflare preview/runtime parity checks
```

Neon remains durable accounting/order truth. PayPal and Resend remain external providers. The dashboard continues to consume the authenticated storefront invoice endpoint from ChatGPT Sites where possible.

## Exact next migration step

The next migration step is **planning/documentation only**:

> Write the exact Cloudflare target architecture + file-by-file migration plan before changing Production/runtime code.

Do not begin implementation from this notice alone; read the canonical dashboard handoff first.
