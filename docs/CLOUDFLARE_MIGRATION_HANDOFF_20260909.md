# LegendMural Cloudflare migration — current handoff

**Last updated:** 2026-09-11  
**Repository:** `ALKAVisuals/legend-stories-website`  
**Migration scope:** Netlify -> Cloudflare for the public LegendMural storefront  
**Base `main` verified for this handoff update:** `899187e87b5548e78c78c12b5404e650beaca9af`

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

The heavy migration proof work, exact cutover planning and **Gate 0 read-only preflight** are complete.

Latest Gate 0 proof:

```text
Public authoritative NS:
- dns1.p01.nsone.net
- dns2.p01.nsone.net
- dns3.p01.nsone.net
- dns4.p01.nsone.net
Public DS records present: false

Cloudflare zone legendmural.com in intended account: ABSENT
Production Worker: legendmural-cloudflare-production
Production Worker exists: true
Production Worker Custom Domains: none
Fail-closed flags proven remotely: true
Production application secret names present: none
Production R2: legendmural-v3-invoice-pdfs-prod
Production R2 public exposure: false
```

Gate 0 evidence:

- `docs/CLOUDFLARE_GATE0_READONLY_PREFLIGHT_PROOF_20260911.md`
- proofed PR head `23d08fbb7550f71f662f1e2a408ebaeab7871848`
- workflow run `34595472854`
- inventory job `103250140985`

No Production state was changed by Gate 0. The public DS lookup returned zero records, so there is no existing registrar-level DS record that must be removed before the future nameserver switch.

Required Stage C fail-closed values remain proven:

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

Read that document before any provider mutation. It defines the DNS preservation contract, Cloudflare full-zone onboarding, nameserver switch, Worker Custom Domains, post-cutover probes and Stage C recovery behavior.

Key architecture decision: the Production Worker is the storefront origin, so use **Cloudflare Worker Custom Domains**, not classic Worker Routes. The intended final Custom Domains are:

```text
legendmural.com
www.legendmural.com
```

Both point to `legendmural-cloudflare-production`. The existing Worker already redirects `www.legendmural.com` to `https://legendmural.com` with HTTP 301 while preserving path/query.

Cloudflare requires the zone to be **Active** before Worker Custom Domains can be created. Gate 0 has now proven that `legendmural.com` is not yet present as a zone in the intended Cloudflare account. Therefore the first approved external write must be **Cloudflare full-zone creation/onboarding** for `legendmural.com`.

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

Current public authoritative DNS is still Netlify/NS1-backed and Gate 0 reconfirmed the captured authoritative nameservers. No public DS record is currently published.

## Current host / rollback decision

The current Netlify Production deploy is reported `ready`, but every tested custom/default/branch/immutable serving form returns Netlify HTTP 404. It is **not** a proven working serving rollback target.

The exact source behind that deploy, `95a57e8f05a0af547efa0dfc4d044b8a96de7fe3`, was rebuilt successfully outside Netlify: 293 output files / 78,951,418 bytes and HTTP 200 for `/`, `/index.html`, `/shop.html`, `/robots.txt` and `/sitemap.xml` when served locally. Evidence:

- `docs/NETLIFY_PRODUCTION_SOURCE_BUILD_PROOF_20260911.md`

The owner wants to leave Netlify because of credits/cost. Do not create another Netlify rollback project. A GitHub Pages fallback was considered and intentionally skipped because LegendMural is not officially live and checkout remains paused through Stage C.

Stage C therefore proceeds without an independent third-provider serving fallback. Recovery uses the previous known-good Worker version, the complete DNS snapshot, and—only if Cloudflare DNS onboarding itself cannot be recovered—the prior Netlify/NS1 authoritative DNS delegation. Do not describe the old Netlify storefront as a working serving fallback.

## Exact next action

PR #245 contains the Gate 0 proof and the permanent GET-only zone/custom-domain/public-NS/DS inventory extension. Before any provider write:

1. let all exact-head CI on PR #245 finish;
2. fresh-check `main`, PR head and mergeability;
3. request owner approval to merge PR #245;
4. after #245 is merged, request **separate explicit owner authorization for the exact Production cutover mutation bundle** below.

The exact cutover mutation bundle is:

1. add/create `legendmural.com` in the intended Cloudflare account using full/primary DNS setup;
2. record the exact Cloudflare-assigned authoritative nameservers;
3. recreate the frozen eight mail/service records exactly before delegation changes;
4. verify those records read-only in Cloudflare;
5. replace the Netlify/NS1 authoritative nameservers at the registrar with only the Cloudflare-assigned pair;
6. wait until the Cloudflare zone is Active;
7. attach `legendmural.com` and `www.legendmural.com` to `legendmural-cloudflare-production` as Worker Custom Domains;
8. run the full non-mutating post-cutover probe matrix and record the result in GitHub.

Gate 0 found no current DS record, so no registrar DS removal is presently expected before the nameserver switch. Recheck public DS immediately before delegation in case external state changes.

That authorization must also explicitly acknowledge the already chosen pre-live tradeoff that there is **no independent third-provider serving fallback** during this first cutover window.

The cutover authorization does **not** authorize PayPal Live, customer checkout opening, Resend activation, V3 activation, Production R2 object writes or Neon Production mutation.

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
- #244 exact Cloudflare Production cutover plan
- #245 Gate 0 read-only zone/custom-domain/public-NS/DS preflight — open at time of this handoff update

Canonical preview Worker:

```text
https://legendmural-cloudflare-preview.lively-bonus-08da.workers.dev
Full storefront proof run: 34461889551
Preview Worker version: 411070c2-5250-480c-85df-2c22e6260d3b
```

Preview PayPal Sandbox, webhook verification/idempotency, isolated Neon paid persistence, PDFKit Worker runtime, private preview R2 semantics and the six-route API matrix are already proven. Preview checkout was restored fail-closed after testing.

## What must not change without new exact approval

- `legendmural.com` Cloudflare zone creation or DNS records;
- `legendmural.com` registrar nameservers/DNSSEC/DS;
- Cloudflare Worker Custom Domains;
- Netlify Production deploy/config/domain attachments;
- Production Worker deployment;
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
4. Read `docs/CLOUDFLARE_GATE0_READONLY_PREFLIGHT_PROOF_20260911.md`.
5. Read `docs/CLOUDFLARE_CUTOVER_AND_ROLLBACK_CHECKLIST.md`.
6. Read `docs/NETLIFY_DNS_ZONE_EXPORT_PROOF_20260911.md`.
7. Read `docs/CLOUDFLARE_STAGE_C_ZERO_SECRET_DECISION_20260910.md`.
8. Fresh-check current `main` and open migration PRs.
9. Continue only with the exact next action above.

## Continuation rule

GitHub is the source of truth. Newer `main` state overrides this handoff and must be reconciled before any action.
