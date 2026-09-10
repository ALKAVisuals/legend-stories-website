# LegendMural — Cloudflare cutover & rollback checklist

**Last updated:** 2026-09-10  
**Current phase:** Section C DNS inventory / no Production domain cutover authorized.

## A. Merge-readiness gate — before `main`

All must be true on the exact final migration head:

- [ ] current storefront `main` fresh-checked;
- [ ] migration branch rebased/updated if `main` moved;
- [ ] no unintended website/V3 changes from parallel work overwritten;
- [ ] Cloudflare route contract tests pass;
- [ ] R2 create-only/integrity/idempotency tests pass;
- [ ] Wrangler preview dry-run bundle passes;
- [ ] Wrangler Production-env dry-run bundle passes;
- [ ] deterministic invoice PDF regression still passes;
- [ ] Quality checks pass;
- [ ] Accessibility checks pass;
- [ ] Mobile WebKit checks pass;
- [ ] no secret values are present in GitHub;
- [ ] Netlify Production remains unchanged;
- [ ] canonical migration handoff is updated with exact evidence;
- [ ] owner explicitly approves the exact final PR merge.

Merging is not Production authorization.

## B. Cloudflare account/pre-production setup gate

Before any custom-domain cutover:

- [ ] Cloudflare account/project is confirmed;
- [ ] preview Worker is created separately from Production Worker;
- [ ] preview R2 bucket exists;
- [ ] Production R2 bucket exists but Production invoice storage remains OFF;
- [ ] preview gets sandbox/isolated credentials only;
- [ ] Production application-secret inventory matches the active stage and any required secrets are configured only through Cloudflare secret storage; **Stage C intentionally requires zero application secrets**;
- [ ] no secret values are exposed in GitHub or CI;
- [ ] real Cloudflare preview serves Vite static assets correctly;
- [ ] all six existing public API routes respond through Worker routing;
- [ ] unknown `/api/*` returns hardened 404;
- [ ] no public withdrawal endpoint was introduced;
- [ ] PayPal sandbox create/capture/return path works in preview;
- [ ] PayPal sandbox webhook signature verification works in preview;
- [ ] Neon isolated/non-production persistence works from Worker runtime;
- [ ] PDFKit produces expected invoice fixture under actual Worker runtime;
- [ ] R2 preview test proves create-only + read-after-write + hash/length verification;
- [ ] Resend stays non-live unless separately approved;
- [ ] reconciliation stays OFF unless a non-production proof explicitly enables it;
- [ ] dashboard invoice API stays OFF by default.

Stage C secret rationale and the zero-secret fail-closed API contract are defined in `docs/CLOUDFLARE_STAGE_C_ZERO_SECRET_DECISION_20260910.md`. Never copy Preview/Sandbox credentials into Production just to satisfy this gate.

## C. DNS inventory gate — read-only

Immediately before any domain change, inventory the current LegendMural zone. Public proof is recorded in `docs/CLOUDFLARE_DNS_INVENTORY_PROOF_20260910.md`.

- [x] authoritative nameservers — Netlify/NS1-backed NS + SOA captured;
- [ ] apex A/AAAA/CNAME/flattening state — public A/AAAA/CNAME response captured; provider-side flattening configuration still requires account-level zone inspection;
- [x] `www` public record response state captured;
- [x] MX records captured;
- [x] SPF TXT captured;
- [ ] DKIM records — Microsoft 365 selector1/selector2 and Resend candidate queried and absent, but DKIM selectors are not publicly enumerable; full zone inventory still required;
- [x] DMARC TXT captured;
- [ ] Resend verification records — standard public candidate names were queried and absent; full account-level zone inventory still required before calling the zone complete;
- [ ] any other LegendMural subdomains — two independent certificate-transparency sources found only apex + `www`, but public CT cannot enumerate all DNS names;
- [x] current TTLs captured for the observed public records;
- [ ] current Netlify domain attachment state — public HTTPS reaches Netlify, but apex and `www` both return HTTP 404; exact internal site/domain assignment is still unproven.

### Current Section C evidence / blocker

Read-only workflow `Cloudflare DNS read-only inventory`, run #6 / ID `34486539162`, head `8a285a7ab3edcb06386610a0b686eb7335cdf0a2`, completed successfully with zero credentials and zero mutation.

Public authoritative DNS is still Netlify/NS1-backed. Both `https://legendmural.com/` and `https://www.legendmural.com/` returned HTTP 404 with `server: Netlify` and `x-nf-request-id` present. This is a pre-existing observed state, not a result of the migration proof. The exact Netlify site/domain attachment and complete zone record list must be read account-level before any cutover plan can be approved.

Do not modify any DNS record or hosting/domain attachment during this inventory. Do not modify Technisch Bouwadvies DNS or hosting.

## D. Runtime/domain cutover gate — Stage C

This stage changes hosting runtime only. Permanent V3 R2 invoice storage remains OFF. Stage C starts with **zero LegendMural application secrets** in the Production Worker.

- [ ] explicit owner approval for this exact Production cutover;
- [ ] Cloudflare Production Worker version identified and recorded;
- [ ] Production application-secret inventory remains intentionally empty for hosting-only Stage C;
- [ ] `LEGENDMURAL_CHECKOUT_PAUSED=true` before routing change;
- [ ] `PAYPAL_ALLOW_LIVE=false` unless a separate approved live-payment step says otherwise;
- [ ] `ORDER_EMAILS_ENABLED=false` unless separately approved;
- [ ] `V3_PROFILE1_ORDER_CREATION_ENABLED=false`;
- [ ] `V3_INVOICE_RECONCILIATION_ENABLED=false`;
- [ ] `V3_INVOICE_STORAGE_ENABLED=false`;
- [ ] `V3_DASHBOARD_INVOICE_API_ENABLED=false`;
- [ ] custom domain/origin changed to Cloudflare;
- [ ] `www` canonical redirect verified;
- [ ] HTTPS certificate/redirect verified;
- [ ] homepage/shop/product/static media smoke test passed;
- [ ] six API paths verified at canonical origin using non-mutating GET probes and the Stage C zero-secret expected matrix;
- [ ] security/no-store/CORS behavior verified;
- [ ] Netlify site retained as rollback target;
- [ ] old `legendmural.netlify.app` behavior reviewed separately.

Only after runtime stability is established may checkout/live feature activation be considered under its own existing V3/launch gates.

## E. Stage C rollback — before any R2 Production writes

Rollback trigger examples:

- sustained Worker 5xx;
- static-asset routing failure;
- checkout/capture/webhook parity failure;
- Neon runtime incompatibility;
- PDF runtime incompatibility that affects active paths;
- severe security/CORS regression.

Rollback steps:

1. pause checkout if not already paused;
2. keep all V3 activation/storage flags OFF;
3. restore `legendmural.com` origin/DNS to the proven Netlify Production site;
4. verify HTTPS/apex/www;
5. verify storefront and API smoke tests on Netlify;
6. record the failed Cloudflare Worker version and evidence in GitHub;
7. fix on branch/preview before another cutover attempt.

Because Stage C has no Production R2 invoice writes, this rollback remains operationally simple.

## F. R2 Production storage activation — Stage D, separate later action

Do not combine this with the initial hosting cutover.

Before enabling `V3_INVOICE_STORAGE_ENABLED=true`:

- [ ] all existing V3 Production migrations/activation prerequisites are closed;
- [ ] dedicated least-privilege Production Neon runtime credential is proven;
- [ ] R2 Production bucket binding is verified private;
- [ ] actual Worker-runtime PDF generation is proven;
- [ ] exact artifact create-only/read/hash/length proof is complete;
- [ ] invoice download path reads R2 through authenticated server logic;
- [ ] dashboard invoice path reads R2 through authenticated server logic;
- [ ] reconciliation behavior is proven separately;
- [ ] storage-aware rollback strategy exists;
- [ ] explicit owner approval for Production R2 writes is given.

Once a new immutable invoice exists only in R2, simply restoring an old Netlify runtime that only understands Netlify Blobs is insufficient. Stage D therefore requires a storage-aware rollback or a Cloudflare-capable fallback runtime.

## G. Post-cutover verification

Record exact timestamps and versions, never secrets:

- [ ] Cloudflare Worker version/deployment ID;
- [ ] storefront commit SHA;
- [ ] DNS state after cutover;
- [ ] canonical apex HTTPS result;
- [ ] `www` redirect result;
- [ ] static media result;
- [ ] API route status matrix;
- [ ] PayPal sandbox/live proof as applicable;
- [ ] Neon persistence proof as applicable;
- [ ] R2 proof only if separately activated;
- [ ] dashboard access proof only if separately activated;
- [ ] Resend proof only if separately activated;
- [ ] rollback path still available or explicitly superseded.

## Current state

Section C is **partially closed**: the public DNS/HTTPS portion is proven, but the account-level Netlify zone/domain-attachment inventory remains mandatory before a cutover plan. No DNS, Netlify domain attachment, Cloudflare custom domain or Production routing mutation is authorized by the public proof.
