# LegendMural Cloudflare migration — current handoff

**Last updated:** 2026-09-11  
**Repository:** `ALKAVisuals/legend-stories-website`  
**Migration scope:** Netlify -> Cloudflare for the public LegendMural storefront  
**Base `main` verified for this handoff update:** `a717c436c5bc767d0959c9597dff8bdb7ae3a050`

> This is the canonical continuation document for the active Cloudflare migration. Always fresh-check current `main` before taking an action. GitHub is the source of truth.

## Non-negotiable scope boundaries

- `legendmural.com` stays on its current public path until the owner explicitly approves the exact Cloudflare DNS/domain cutover.
- Technisch Bouwadvies stays on Netlify and is out of scope.
- `ALKAVisuals/legendmural-dashboard` stays hosted through ChatGPT Sites.
- Neon remains the database unless separately approved.
- Never commit or print PayPal, Resend, Neon or Cloudflare secret values.
- No PayPal Live, DNS/nameserver cutover, Cloudflare Production custom-domain/routing mutation, Netlify Production mutation, Production R2 write, Production Neon mutation or V3 activation without explicit owner approval for that exact step.
- Repository changes must use a task branch and PR; never write directly to `main`.

## Current checkpoint

The heavy migration proof work is complete. The exact hosting cutover is now the active task.

```text
Production Worker: legendmural-cloudflare-production
Known bootstrap Worker version: 5d05b26d-4179-4ab0-a7b3-35cb990de854
workers.dev: disabled
preview_urls: disabled
Production custom domain: none yet
Production R2: legendmural-v3-invoice-pdfs-prod
Production R2 public exposure: none
Production application secret names: none for Stage C
```

Required Stage C fail-closed values:

```text
LEGENDMURAL_DEPLOY_CONTEXT=production
LEGENDMURAL_CHECKOUT_PAUSED=true
PAYPAL_ALLOW_LIVE=false
ORDER_EMAILS_ENABLED=false
V3_PROFILE1_ORDER_CREATION_ENABLED=false
V3_INVOICE_RECONCILIATION_ENABLED=false
V3_INVOICE_STORAGE_ENABLED=false
V3_DASHBOARD_INVOICE_API_ENABLED=false
```

Do not combine the hosting cutover with PayPal Live.

## Exact cutover plan

The authoritative execution plan is:

- `docs/CLOUDFLARE_PRODUCTION_CUTOVER_PLAN_20260911.md`

Read that document before any provider mutation. It defines the read-only preflight, DNS preservation contract, Cloudflare full-zone onboarding, nameserver switch, Worker Custom Domains, post-cutover probes and Stage C recovery behavior.

Key architecture decision: the Production Worker is the storefront origin, so use **Cloudflare Worker Custom Domains**, not classic Worker Routes. The intended final Custom Domains are:

```text
legendmural.com
www.legendmural.com
```

Both point to `legendmural-cloudflare-production`. The existing Worker code already redirects `www.legendmural.com` to `https://legendmural.com` with HTTP 301 while preserving path/query.

Cloudflare requires the zone to be **Active** before Worker Custom Domains can be created. Therefore the DNS zone and preserved records are prepared first, the authoritative nameservers are changed, Cloudflare activation is confirmed, and only then are the two Custom Domains attached.

## DNS contract — complete and frozen for migration

Source proof:

- `docs/NETLIFY_DNS_ZONE_EXPORT_PROOF_20260911.md`
- source CSV SHA-256: `1681495c3e2a0adf932a20c2f4af7d3dc40bcbfde13cf9ad9f130fa45c75e493`
- 10 managed records total; all captured TTLs `3600`

The two Netlify hosting records for apex and `www` are migration-specific and will be replaced. The other eight records must be preserved exactly:

1. `resend._domainkey.mail.legendmural.com` TXT — captured Resend DKIM public key;
2. `send.mail.legendmural.com` MX -> `feedback-smtp.eu-west-1.amazonses.com`, priority `10`;
3. `send.mail.legendmural.com` TXT -> `v=spf1 include:amazonses.com ~all`;
4. `_dmarc.legendmural.com` TXT -> `v=DMARC1; p=none;`;
5. apex TXT -> `v=spf1 include:secureserver.net -all`;
6. `autodiscover.legendmural.com` CNAME -> `autodiscover.outlook.com`;
7. `email.legendmural.com` CNAME -> `email.secureserver.net`;
8. apex MX -> `legendmural-com.mail.protection.outlook.com`, priority `0`.

Do not clean up or redesign SPF/DMARC/DKIM/mail configuration during this migration. Mail/service CNAMEs stay DNS-only in Cloudflare.

Current public authoritative DNS is still Netlify/NS1-backed. The prior authoritative nameservers were captured as:

```text
dns1.p01.nsone.net.
dns2.p01.nsone.net.
dns3.p01.nsone.net.
dns4.p01.nsone.net.
```

## Current host / rollback decision

The current Netlify Production deploy is reported `ready`, but every tested custom/default/branch/immutable serving form returns Netlify HTTP 404. It is **not** a proven working serving rollback target.

The exact source behind that deploy, `95a57e8f05a0af547efa0dfc4d044b8a96de7fe3`, was rebuilt successfully outside Netlify: 293 output files / 78,951,418 bytes and HTTP 200 for `/`, `/index.html`, `/shop.html`, `/robots.txt` and `/sitemap.xml` when served locally. Evidence:

- `docs/NETLIFY_PRODUCTION_SOURCE_BUILD_PROOF_20260911.md`

The owner wants to leave Netlify because of credits/cost. Do not create another Netlify rollback project. A GitHub Pages fallback was considered and intentionally skipped because LegendMural is not officially live and checkout remains paused through Stage C.

Stage C therefore proceeds without an independent third-provider serving fallback. Recovery uses the previous known-good Worker version, the complete DNS snapshot, and—only if Cloudflare DNS onboarding itself cannot be recovered—the prior Netlify/NS1 authoritative DNS delegation. Do not describe the old Netlify storefront as a working serving fallback.

## Exact next action

1. Merge the exact cutover-plan documentation PR only after CI and owner approval.
2. Then perform **read-only Gate 0 preflight** from `docs/CLOUDFLARE_PRODUCTION_CUTOVER_PLAN_20260911.md`:
   - fresh `main` SHA;
   - current remote Production Worker/version;
   - all fail-closed values;
   - zero Stage C application secrets;
   - private Production R2;
   - whether Cloudflare zone `legendmural.com` already exists;
   - current NS delegation and registrar DNSSEC/DS state;
   - exact eight-record mail/service contract.
3. Stop and request explicit owner authorization for the exact cutover mutation bundle.
4. Only after that authorization may the Cloudflare zone/DNS/nameserver/Custom Domain cutover begin.

No live provider mutation is authorized by this handoff or by the cutover-plan documentation PR.

## Immediately after stable Cloudflare hosting — PayPal Live

Once Cloudflare hosting and the post-cutover checks are green, **PayPal Live is the next main phase**:

1. configure PayPal Production credentials only in Cloudflare secret storage;
2. configure the PayPal Production webhook to the Cloudflare Production endpoint;
3. prove Live create-order -> approval -> capture -> webhook -> Neon/order-state flow;
4. perform one small real self-payment;
5. verify amount, PayPal order/capture, webhook verification, Neon paid state and idempotency;
6. request separate explicit owner approval before customer checkout is opened.

Resend/order-email activation and V3/R2 invoice-storage activation remain separate later phases.

## Evidence anchors / merged checkpoints

- #228 actual Worker PDFKit + preview R2 proof
- #230 six-route preview API matrix
- #232 Production account inventory
- #234 Production R2 provisioning
- #236 Production Worker bootstrap
- #237 clean Wrangler Production alias configuration
- #238 Stage C zero-secret fail-closed contract
- #239 public DNS inventory
- #240 Netlify account/routing proof
- #241 complete Netlify DNS export proof
- #242 historical Netlify Production-source build proof
- #243 Cloudflare-cutover-then-PayPal-Live execution sequence

Canonical preview Worker:

```text
https://legendmural-cloudflare-preview.lively-bonus-08da.workers.dev
Full storefront proof run: 34461889551
Preview Worker version: 411070c2-5250-480c-85df-2c22e6260d3b
```

Preview PayPal Sandbox, webhook verification/idempotency, isolated Neon paid persistence, PDFKit Worker runtime, private preview R2 semantics and the six-route API matrix are already proven. Preview checkout was restored fail-closed after testing.

## What must not change without new exact approval

- `legendmural.com` DNS/nameservers/custom-domain routing;
- Netlify Production deploy/config/domain attachments;
- Production Worker deployment/custom domain;
- PayPal Live;
- Resend Production activation;
- Production application secrets;
- Production R2 object writes;
- Production Neon credentials/data;
- V3 activation flags;
- dashboard hosting/design;
- Technisch Bouwadvies;
- unrelated storefront/UI code.

## Startup order for the next migration chat

1. Read `docs/READ_ME_FIRST.md`.
2. Read this file.
3. Read `docs/CLOUDFLARE_PRODUCTION_CUTOVER_PLAN_20260911.md`.
4. Read `docs/CLOUDFLARE_CUTOVER_AND_ROLLBACK_CHECKLIST.md`.
5. Read `docs/NETLIFY_DNS_ZONE_EXPORT_PROOF_20260911.md`.
6. Read `docs/CLOUDFLARE_STAGE_C_ZERO_SECRET_DECISION_20260910.md`.
7. Fresh-check current `main` and open migration PRs.
8. Continue only with the exact next action above.

## Continuation rule

GitHub is the source of truth. Newer `main` state overrides this handoff and must be reconciled before any action.
