# LegendMural — Cloudflare cutover & rollback checklist

**Last updated:** 2026-09-10  
**Current phase:** Section C account/DNS inventory / no Production domain cutover authorized.

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

## C. DNS / current-host inventory gate — read-only

Public DNS evidence is recorded in `docs/CLOUDFLARE_DNS_INVENTORY_PROOF_20260910.md`. Netlify account/routing evidence is recorded in `docs/NETLIFY_ACCOUNT_READONLY_INVENTORY_PROOF_20260910.md`.

- [x] authoritative nameservers — Netlify/NS1-backed NS + SOA captured;
- [ ] apex A/AAAA/CNAME/flattening state — public A/AAAA/CNAME response captured; provider-side flattening configuration still requires complete zone inspection;
- [x] `www` public record response state captured;
- [x] MX records captured;
- [x] SPF TXT captured;
- [ ] DKIM records — Microsoft 365 selector1/selector2 and Resend candidate queried and absent, but DKIM selectors are not publicly enumerable; full zone inventory still required;
- [x] DMARC TXT captured;
- [ ] Resend verification records — standard public candidate names were queried and absent; full account-level zone inventory still required before calling the zone complete;
- [ ] any other LegendMural subdomains — two independent certificate-transparency sources found only apex + `www`, but public CT cannot enumerate all DNS names;
- [x] current TTLs captured for the observed public records;
- [x] current Netlify project/domain attachment identified account-level as project `legendmural` with primary custom URL `https://legendmural.com`;
- [x] active Netlify Production deploy identified: deploy `6a8d7a5e5b89930b8ea3b5ff`, commit `95a57e8f05a0af547efa0dfc4d044b8a96de7fe3`, state `ready`;
- [x] branch and immutable Netlify deploy URLs captured;
- [x] current 404 scope isolated: custom apex, `www`, default Netlify hostname, `main` branch hostname and immutable deploy hostname all return Netlify 404 for tested storefront/static paths;
- [ ] complete Netlify DNS-zone record list captured — **blocked because the connected Netlify integration exposes no DNS-record-list reader; requires Netlify DNS UI/export evidence**;
- [ ] a working Netlify or equivalent rollback serving target proven — **current immutable Production deploy is not a valid proven rollback target because it returns 404**.

### Current Section C evidence / blockers

Public DNS workflow `Cloudflare DNS read-only inventory`, run #6 / ID `34486539162`, completed successfully with zero credentials and zero mutation.

Netlify routing workflow `Netlify account routing read-only proof`, run #3 / ID `34492049415`, head `098a0b944e973587ab5b56038392673d208d121f`, completed successfully with zero provider credentials and GET-only probes. All 25 tested URL/path combinations returned HTTP 404 with Netlify serving evidence, including the immutable deploy permalink itself.

The active Production commit contains `index.html` and `shop.html`; its Vite config explicitly builds all root HTML files to `dist`, and `netlify.toml` publishes `dist`. The available read-only evidence therefore rules out a custom-domain-only issue and rules out the simple explanation that `index.html` is absent from the configured source/build contract. It does **not** prove the exact internal Netlify cause, so do not guess or mutate Production to diagnose it without separate approval.

Because the current authoritative DNS is Netlify/NS1-backed, a future Cloudflare cutover may require a nameserver-level DNS-hosting transition. Do not change nameservers until the complete Netlify DNS zone is captured and every record is accounted for.

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
- [ ] complete current DNS zone captured before any nameserver change;
- [ ] working rollback serving target proven before routing change;
- [ ] custom domain/origin changed to Cloudflare;
- [ ] `www` canonical redirect verified;
- [ ] HTTPS certificate/redirect verified;
- [ ] homepage/shop/product/static media smoke test passed;
- [ ] six API paths verified at canonical origin using non-mutating GET probes and the Stage C zero-secret expected matrix;
- [ ] security/no-store/CORS behavior verified;
- [ ] rollback target retained and re-proven after cutover;
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

**Current blocker:** the published Netlify Production deploy is not currently a proven working rollback target. Its immutable deploy permalink returns 404 for the tested storefront/static paths. Do not authorize Stage C cutover until a working rollback serving target has been proven.

Once a working rollback target exists, rollback steps are:

1. pause checkout if not already paused;
2. keep all V3 activation/storage flags OFF;
3. restore `legendmural.com` origin/DNS to the specifically proven rollback target;
4. verify HTTPS/apex/www;
5. verify storefront and applicable API smoke tests on that target;
6. record the failed Cloudflare Worker version and evidence in GitHub;
7. fix on branch/preview before another cutover attempt.

Because Stage C has no Production R2 invoice writes, storage rollback remains operationally simple, but DNS/runtime rollback is not considered ready until the serving target itself is proven.

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

Section C is **partially closed**. Public DNS/HTTPS and the available Netlify account/project/deploy/routing facts are proven. The complete Netlify DNS-zone record list is still mandatory before any nameserver change, and the current Netlify immutable deploy has been proven unusable as a rollback serving target because it returns 404 on all tested paths. No DNS, Netlify deploy/domain attachment, Cloudflare custom domain or Production routing mutation is authorized by these proofs.
