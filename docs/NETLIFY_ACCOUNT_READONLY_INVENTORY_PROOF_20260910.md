# LegendMural — Netlify account read-only inventory proof

**Date:** 2026-09-10  
**Scope:** current Netlify Production site/domain/routing evidence before any Cloudflare cutover  
**Mutation performed:** none  
**Production deploy/config change:** none

## Purpose

This proof closes the account-level questions that can be answered safely through the connected Netlify read-only project/deploy readers plus public GET-only routing probes. It does **not** change Netlify, DNS, Cloudflare, PayPal, Neon, Resend, R2, the dashboard, or Technisch Bouwadvies.

The complete Netlify DNS zone record list remains unproven because the connected Netlify integration exposes project/deploy/team/user readers but no DNS-record listing action. The zone must therefore still be captured separately before any nameserver-level cutover.

## Netlify account state

Read-only Netlify account metadata identified the active public storefront project as:

```text
Netlify project: legendmural
Primary custom site URL: https://legendmural.com
Production context: production
Production branch: main
Production deploy state: ready
Production deploy ID: 6a8d7a5e5b89930b8ea3b5ff
Production deploy commit: 95a57e8f05a0af547efa0dfc4d044b8a96de7fe3
Published: 2026-08-25T11:20:26.137Z
Branch URL: https://main--legendmural.netlify.app
Immutable deploy permalink: https://6a8d7a5e5b89930b8ea3b5ff--legendmural.netlify.app
Framework: Vite
Processed redirect rules: 8, with no reported redirect-processing errors
Deployed Netlify Functions: 5
```

No secret values are recorded in this proof.

## Exact Production source/build contract

The active Production commit `95a57e8f05a0af547efa0dfc4d044b8a96de7fe3` contains `index.html` and `shop.html` in the repository root.

Its `vite.config.mjs` enumerates every root `*.html` file as a Rollup entry and writes the build to `dist`. Its `netlify.toml` runs the Vite build and publishes `dist`.

Therefore the observed 404 cannot be explained simply by `index.html` being absent from the repository or by the configured Netlify publish directory pointing somewhere other than `dist`.

## External GET-only routing proof

Workflow:

```text
Netlify account routing read-only proof
Run number: 3
Run ID: 34492049415
Head SHA: 098a0b944e973587ab5b56038392673d208d121f
Observed: 2026-09-10T14:54:00.899Z
Policy gate: success
Probe job: success
Credentials used by probe: false
Mutation performed: false
HTTP methods: GET only
```

The probe checked five serving forms:

```text
https://legendmural.com
https://www.legendmural.com
https://legendmural.netlify.app
https://main--legendmural.netlify.app
https://6a8d7a5e5b89930b8ea3b5ff--legendmural.netlify.app
```

Each was checked for:

```text
/
/index.html
/shop.html
/robots.txt
/sitemap.xml
```

### Result

All **25 of 25** requests returned:

```text
HTTP 404
server: Netlify
Netlify request-id evidence: present
```

No redirect response was observed for the default Netlify hostname during this proof.

The critical result is that the 404 reproduces on the **immutable deploy permalink itself**, not only on `legendmural.com` or `www.legendmural.com`.

## Conclusion about the 404

The evidence rules out a custom-domain-only failure. The currently published Netlify Production deploy is reported by the Netlify account as `ready`, but its custom domains, default Netlify hostname, branch hostname and immutable deploy hostname all fail to serve the probed storefront/static paths.

The exact internal Netlify cause is **not proven** by the available read-only interfaces. Possible causes must not be guessed into the migration record.

What is proven is:

1. the current 404 is not limited to apex or `www` DNS/domain attachment;
2. the active immutable deploy does not currently provide a working static storefront response for the tested paths;
3. the current Netlify deploy therefore **must not be treated as a proven working rollback target** for the Cloudflare cutover;
4. a working rollback target must be separately proven before any Production domain/runtime cutover is authorized.

## DNS-zone limitation

The connected Netlify integration does not expose a read-only DNS-record-list operation. The public DNS proof already captured authoritative NS, apex/`www`, MX, SPF, DMARC, candidate DKIM/Resend names and TTLs, but public DNS cannot enumerate every record.

Because `legendmural.com` is currently Netlify/NS1 authoritative, the full Netlify DNS zone still needs to be captured from the Netlify DNS UI/export before any nameserver migration is planned. This is especially important for mail/service records that may not be discoverable publicly.

## Safety boundary

No action in this proof:

- changed a DNS record or nameserver;
- changed a Netlify domain attachment;
- created or published a Netlify deploy;
- changed the Netlify Production deploy;
- changed a Cloudflare Worker/custom domain/zone;
- added Production application secrets;
- activated checkout, PayPal Live, Resend, V3 storage/reconciliation, or dashboard APIs;
- wrote Production R2 or Neon data;
- touched Technisch Bouwadvies.

## Remaining Section C blockers

Before an exact Cloudflare cutover/rollback plan can be approved, two items remain mandatory:

1. capture the **complete Netlify DNS zone** read-only from the Netlify DNS management UI/export;
2. establish and prove a **working rollback serving target**. The currently published immutable Netlify deploy is not sufficient because it returns 404 on all tested paths.

Do not fix, redeploy, republish, change DNS, or change domain assignment as part of this read-only inventory without a separate explicit owner approval.
