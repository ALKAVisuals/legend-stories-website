# LegendMural — Cloudflare cutover & rollback checklist

**Last updated:** 2026-09-11  
**Current phase:** DNS/current-host inventory complete / final Cloudflare cutover planning / no Production domain cutover authorized.

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
- [ ] Netlify Production remains unchanged until explicit cutover approval;
- [ ] canonical migration handoff is updated with exact evidence;
- [ ] owner explicitly approves the exact final PR merge.

Merging is not Production authorization.

## B. Cloudflare pre-production gate

Before custom-domain cutover:

- [x] Cloudflare account/project confirmed;
- [x] preview Worker separate from Production Worker;
- [x] preview R2 bucket exists;
- [x] Production R2 bucket exists and is private;
- [x] preview uses sandbox/isolated credentials only;
- [x] no secrets exposed in GitHub/CI;
- [x] real Cloudflare preview serves static assets correctly;
- [x] all six existing public API routes proven through Worker routing;
- [x] unknown `/api/*` hardened 404 proven;
- [x] no public withdrawal endpoint introduced;
- [x] PayPal Sandbox create/capture/return path proven;
- [x] PayPal Sandbox webhook signature verification proven;
- [x] isolated Neon persistence/idempotency proven;
- [x] PDFKit under actual Worker runtime proven;
- [x] R2 preview create-only/read/hash/length proof complete;
- [x] Production Worker created separately and fail-closed;
- [x] Production application-secret inventory intentionally empty for hosting-only Stage C;
- [x] Production R2 binding verified;
- [x] no Production custom domain/DNS attachment yet;
- [x] Resend remains non-live;
- [x] reconciliation remains OFF;
- [x] dashboard invoice API remains OFF.

## C. DNS / current-host inventory gate — complete

Evidence:

- `docs/CLOUDFLARE_DNS_INVENTORY_PROOF_20260910.md`
- `docs/NETLIFY_ACCOUNT_READONLY_INVENTORY_PROOF_20260910.md`
- `docs/NETLIFY_DNS_ZONE_EXPORT_PROOF_20260911.md`
- `docs/NETLIFY_PRODUCTION_SOURCE_BUILD_PROOF_20260911.md`

Completed:

- [x] authoritative Netlify/NS1 nameservers + SOA captured;
- [x] apex and `www` provider-side hosting state captured;
- [x] complete 10-record Netlify DNS export captured;
- [x] all TTLs captured;
- [x] Microsoft 365 MX/autodiscover records captured;
- [x] SPF records captured;
- [x] DMARC captured;
- [x] Resend/Amazon SES records under `mail.legendmural.com` captured;
- [x] required MX priorities captured: apex `0`, SES Custom MAIL FROM `10`;
- [x] current Netlify project/domain/deploy identified;
- [x] Netlify 404 scope isolated across custom/default/branch/immutable URLs;
- [x] exact historical Production source commit rebuilt successfully outside Netlify;
- [x] historical build produced 293 files / 78,951,418 bytes;
- [x] local proof returned HTTP 200 on `/`, `/index.html`, `/shop.html`, `/robots.txt`, `/sitemap.xml`.

## D. Rollback strategy decision for the initial cutover

LegendMural is not officially live yet and checkout remains paused during the hosting migration. The owner also wants to move away from Netlify because of credits/costs.

Therefore:

- [x] no new Netlify rollback project will be created;
- [x] no GitHub Pages fallback will be added before this first cutover;
- [x] previous known-good Cloudflare Worker version will be retained for runtime rollback;
- [x] complete DNS-zone evidence is preserved for DNS reconstruction/restoration;
- [x] checkout/live payments remain OFF during cutover;
- [ ] final Production cutover approval must explicitly accept that there is **no independent third-provider serving fallback** during the first cutover window.

This is an intentional pre-live tradeoff to avoid extra hosting work and Netlify cost. If LegendMural becomes business-critical later, add a stronger independent continuity/fallback strategy.

## E. Runtime/domain cutover gate — Stage C

Before changing Production routing:

- [ ] fresh-check storefront `main` and final cutover branch;
- [ ] identify and record exact Cloudflare Production Worker version;
- [ ] confirm `LEGENDMURAL_CHECKOUT_PAUSED=true`;
- [ ] confirm `PAYPAL_ALLOW_LIVE=false`;
- [ ] confirm `ORDER_EMAILS_ENABLED=false`;
- [ ] confirm `V3_PROFILE1_ORDER_CREATION_ENABLED=false`;
- [ ] confirm `V3_INVOICE_RECONCILIATION_ENABLED=false`;
- [ ] confirm `V3_INVOICE_STORAGE_ENABLED=false`;
- [ ] confirm `V3_DASHBOARD_INVOICE_API_ENABLED=false`;
- [ ] map the two hosting records from Netlify to the exact Cloudflare target;
- [ ] prove all eight non-hosting mail/service records are preserved exactly;
- [ ] document exact nameserver/custom-domain sequence;
- [ ] document previous Worker version for immediate runtime rollback;
- [ ] explicit owner approval for the exact Production DNS/domain cutover and accepted no-third-provider-fallback tradeoff.

After approval and cutover:

- [ ] `legendmural.com` serves through Cloudflare;
- [ ] `www` canonical behavior verified;
- [ ] HTTPS certificate/redirect verified;
- [ ] homepage verified;
- [ ] shop verified;
- [ ] product/static media verified;
- [ ] six API routes verified at canonical origin using non-mutating GET probes;
- [ ] security/no-store/CORS behavior verified;
- [ ] exact Worker version and storefront commit recorded;
- [ ] post-cutover DNS state recorded;
- [ ] checkout remains paused until PayPal Live phase is separately completed.

## F. Rollback during Stage C

If a Worker/runtime regression occurs:

1. keep checkout paused and all V3/live flags OFF;
2. roll back to the previous known-good Cloudflare Worker version;
3. verify apex, `www`, homepage, shop, static assets and the six API routes;
4. record failed and restored Worker versions in GitHub.

If a DNS/configuration error occurs:

1. keep checkout paused;
2. use the captured 10-record zone and exact mail/service evidence to reconstruct/restore DNS correctly;
3. verify Microsoft 365 and Resend/Amazon SES records remain intact;
4. verify HTTPS/apex/`www` again.

Known limitation accepted for this pre-live cutover: there is no independent third-provider serving target. A complete Cloudflare/provider outage could therefore make the storefront unavailable until Cloudflare is restored or an alternative host is deployed. No customer payments are exposed to this cutover risk because checkout stays paused.

## G. PayPal Live activation — immediately after stable Cloudflare hosting

Do not combine this with the hosting cutover.

PayPal Live becomes the **next main phase** as soon as Cloudflare hosting is stable and all post-cutover checks are green.

Required sequence:

- [ ] confirm/prepare real PayPal Production app;
- [ ] configure real PayPal credentials only in Cloudflare secret storage;
- [ ] never commit Production PayPal values to GitHub;
- [ ] configure real PayPal webhook against the Cloudflare Production endpoint;
- [ ] prove Live create-order path;
- [ ] prove Live approval/capture path;
- [ ] prove Live webhook verification;
- [ ] prove Neon/order-status persistence and idempotency;
- [ ] execute one small real self-payment;
- [ ] verify exact amount, PayPal order/capture, webhook event and Neon paid state;
- [ ] verify duplicate webhook handling remains idempotent;
- [ ] keep Resend and V3 invoice-storage activation separate unless separately approved;
- [ ] explicit owner approval before customer checkout is opened;
- [ ] only then unpause customer checkout / enable Live payment path.

Operational order:

```text
Cloudflare cutover
-> post-cutover verification
-> PayPal Live configuration
-> real small payment proof
-> owner approval
-> customer checkout open
```

## H. R2 Production storage / V3 activation — separate later phase

Do not combine this with initial hosting cutover or the first PayPal Live activation unless separately approved.

Before enabling Production invoice storage/reconciliation/dashboard invoice paths:

- [ ] all V3 Production migration prerequisites closed;
- [ ] least-privilege Production Neon runtime credential proven;
- [ ] Production R2 binding re-verified private;
- [ ] actual Production Worker-runtime PDF generation proven;
- [ ] exact artifact create-only/read/hash/length proof complete;
- [ ] authenticated invoice-download path proven;
- [ ] authenticated dashboard invoice path proven;
- [ ] reconciliation behavior proven separately;
- [ ] storage-aware rollback strategy exists;
- [ ] explicit owner approval for Production R2 writes.

## I. Netlify exit

Only after Cloudflare hosting is stable and the required live payment path is proven:

- [ ] confirm `legendmural.com` and `www` no longer depend on Netlify;
- [ ] confirm mail/service DNS remains healthy;
- [ ] confirm no required LegendMural function/runtime remains on Netlify;
- [ ] document any remaining Netlify dependency;
- [ ] obtain explicit owner approval before deleting/disabling the LegendMural Netlify project or other Production resources;
- [ ] do not touch Technisch Bouwadvies Netlify resources.

## Current state

Cloudflare preview/runtime, Production bootstrap, DNS inventory and historical source-build proof are complete. The next step is **final Cloudflare cutover planning**, not creation of another rollback host. The actual Production DNS/domain cutover still requires separate explicit owner approval. After stable Cloudflare hosting, **PayPal Live is the next main task**, followed by one real small end-to-end payment test before customer checkout is opened.
