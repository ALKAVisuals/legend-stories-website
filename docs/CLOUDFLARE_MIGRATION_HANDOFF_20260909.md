# LegendMural Cloudflare migration — current handoff

**Last updated:** 2026-09-11  
**Repository:** `ALKAVisuals/legend-stories-website`  
**Migration scope:** Netlify -> Cloudflare for the public LegendMural storefront  
**Base `main` verified for this handoff update:** `6949f49f1788686657cfe84e3566db1422bee8d0`

> This is the canonical continuation document for the active Cloudflare migration. Always fresh-check current `main` before taking an action. GitHub is the source of truth.

## Non-negotiable scope boundaries

- `legendmural.com` remains on the current Production path until the owner explicitly approves the exact Cloudflare domain/DNS cutover.
- Technisch Bouwadvies stays on Netlify and is out of scope.
- `ALKAVisuals/legendmural-dashboard` stays hosted through ChatGPT Sites.
- Neon remains the database unless separately approved.
- PayPal, Resend, Neon and Cloudflare secret values must never be committed or printed.
- No PayPal Live activation, DNS/nameserver cutover, Production Cloudflare cutover, Netlify Production mutation, Production Worker redeploy or Production-data mutation without explicit owner approval for that exact step.
- Repository changes must go through a task branch and PR; never write directly to `main`.

## Current checkpoint

Cloudflare preview/runtime proofs and the fail-closed Production bootstrap are complete enough for final cutover planning.

```text
Production Worker: legendmural-cloudflare-production
Worker bootstrap version ID: 5d05b26d-4179-4ab0-a7b3-35cb990de854
workers.dev exposure: disabled by Production config
preview URL exposure: disabled by Production config
custom domain / DNS attachment: none
Production R2 bucket: legendmural-v3-invoice-pdfs-prod
R2 public exposure: none
Production application secret names present: none
```

All live/commerce/V3 switches remain OFF:

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

Stage C remains hosting-only and intentionally requires zero LegendMural application secrets while those features remain off.

## Merged checkpoints relevant to continuation

| PR | Purpose | Main checkpoint |
|---|---|---|
| #228 | Actual Worker PDFKit + preview R2 proof | `2d44dd103bea6e136c697e57740d5f9aed27a0b9` |
| #230 | Preview six-route API matrix proof | `36820e6c64f5d4f88e03e1de0e37758708fb805b` |
| #232 | Production account inventory proof | `5a9f5bff1206b0b240140e28b85403b37ff75cbb` |
| #234 | Production R2 provisioning proof | `6fc7eb414274685f8102b2268d4614556d5b11e0` |
| #236 | Production Worker bootstrap proof | `d63d7096e65662e4e18cdf79c36f200267e3c3fa` |
| #237 | Clean Production Wrangler alias configuration | `cbfc525b47f4b29e71278b5d8784e7d883f9b0f1` |
| #238 | Stage C zero-secret fail-closed contract | `9a8ccf21618e3fd3af87c3cab6b675d559c3e69e` |
| #239 | Public DNS cutover inventory | `9cf90d05fb9b57700bb4ea44144208fd1ff2b963` |
| #240 | Netlify account routing read-only proof | `f69735d3cb52fb4ca1b390c283a0c8006bb8921c` |
| #241 | Complete Netlify DNS zone export proof | `33b4b373fc5490ca9314f9d195e6de30926b4f09` |
| #242 | Historical Netlify Production-source build proof | `6949f49f1788686657cfe84e3566db1422bee8d0` |

## Evidence already proven

Canonical preview Worker:

```text
Worker: legendmural-cloudflare-preview
Origin: https://legendmural-cloudflare-preview.lively-bonus-08da.workers.dev
Full storefront proof run ID: 34461889551
Worker version ID: 411070c2-5250-480c-85df-2c22e6260d3b
Result: success
```

Preview PayPal Sandbox, isolated Neon paid persistence/idempotency, PDFKit Worker runtime, private preview R2 semantics and the six-route API matrix have all been proven. Preview checkout was restored fail-closed after testing.

Production R2 exists and is private. The Production Worker exists separately, is fail-closed, has the correct Production R2 binding, has zero application secrets, and has no custom domain attached yet.

## DNS/current-host inventory — complete

Dedicated evidence:

- public DNS: `docs/CLOUDFLARE_DNS_INVENTORY_PROOF_20260910.md`;
- Netlify project/deploy/routing: `docs/NETLIFY_ACCOUNT_READONLY_INVENTORY_PROOF_20260910.md`;
- complete Netlify DNS export: `docs/NETLIFY_DNS_ZONE_EXPORT_PROOF_20260911.md`;
- historical Production-source build: `docs/NETLIFY_PRODUCTION_SOURCE_BUILD_PROOF_20260911.md`;
- cutover gates: `docs/CLOUDFLARE_CUTOVER_AND_ROLLBACK_CHECKLIST.md`.

The complete Netlify DNS export contains 10 records. The two `NETLIFY` hosting records for apex and `www` are the records to replace during the approved cutover. The other eight mail/service records must be preserved exactly, including Microsoft 365, SPF, DMARC and Resend/Amazon SES records under `mail.legendmural.com`.

The current Netlify Production deploy is reported `ready` but all tested custom/default/branch/immutable serving forms return HTTP 404. The exact source commit behind it, `95a57e8f05a0af547efa0dfc4d044b8a96de7fe3`, was rebuilt cleanly outside Netlify: 293 output files, 78,951,418 bytes, with HTTP 200 on `/`, `/index.html`, `/shop.html`, `/robots.txt` and `/sitemap.xml` when served locally. This proves the source/build artifact itself is viable but does not explain Netlify's 404.

## Rollback strategy decision

The owner wants LegendMural to move away from Netlify because Netlify credits/costs are undesirable. A separate Netlify rollback project will therefore **not** be created.

A GitHub Pages fallback was considered but is intentionally not being added before cutover because LegendMural is not officially live yet, checkout will remain paused during the hosting migration, and creating a third hosting path would add work without enough value at this stage.

The initial Stage C rollback strategy is therefore intentionally simpler:

1. retain the previous known-good Cloudflare Worker version so a Worker/runtime regression can be rolled back quickly;
2. preserve the full DNS-zone export and exact mail/service records so DNS can be reconstructed/restored if needed;
3. keep checkout/live payments disabled throughout the hosting cutover;
4. accept that there is no independent third-provider serving fallback during the first cutover window.

This is a deliberate pre-live tradeoff, not a statement that an independent fallback is never useful. If LegendMural becomes business-critical later, add a stronger independent continuity plan then.

## Exact next step — hosting migration

The next task is **not** to build another rollback site.

1. Fresh-check current `main` and current Cloudflare Production Worker/config.
2. Prepare the exact Cloudflare DNS/nameserver/custom-domain cutover plan using the captured 10-record zone.
3. Prove in that plan that all eight non-hosting mail/service records are preserved exactly.
4. Confirm immediately before cutover that checkout and all live/V3 flags remain OFF.
5. Stop and request explicit owner approval for the exact Production domain/DNS cutover.
6. After approval, perform the cutover and immediately verify HTTPS, apex, `www`, homepage, shop, product/static media and the six fail-closed API routes.
7. Record the exact Worker version, storefront commit and post-cutover DNS/runtime proof in GitHub.

Do not combine the hosting cutover with PayPal Live activation.

## Immediately after stable Cloudflare hosting — PayPal Live is next

Once Cloudflare hosting is stable and the post-cutover checks are green, **PayPal Live becomes the next main task**.

Required order:

1. create/confirm the real PayPal Production app/webhook configuration;
2. add real PayPal credentials only through Cloudflare secret storage, never GitHub;
3. point the real PayPal webhook at the Cloudflare Production endpoint;
4. prove Live create-order -> approval -> capture -> webhook -> Neon/order-status end to end;
5. perform one small real self-payment and verify amount, order state, capture ID, webhook/idempotency and Neon persistence;
6. keep Resend/V3 invoice-storage activation separate unless explicitly approved;
7. only after the real payment proof is green, request explicit owner approval to open checkout for customers.

This means the operational sequence is:

```text
Cloudflare cutover plan
-> explicit cutover approval
-> Cloudflare live
-> technical post-cutover verification
-> PayPal Live configuration
-> real small end-to-end payment test
-> explicit approval to open customer checkout
-> later Resend / V3 invoice-storage activation as separate phases
```

## What must not be changed without new exact approval

- `legendmural.com` DNS/nameservers/custom-domain routing;
- Netlify Production deploy/config/domain attachments;
- Production Worker deployment or custom domain;
- PayPal Live;
- Resend Production activation;
- Production application secrets;
- Production R2 object writes;
- Production Neon credentials/data;
- V3 activation flags;
- dashboard hosting/design;
- Technisch Bouwadvies;
- unrelated storefront/UI code.

## Recommended startup order for the next migration chat

1. Read `docs/READ_ME_FIRST.md`.
2. Read this file.
3. Read `docs/CLOUDFLARE_CUTOVER_AND_ROLLBACK_CHECKLIST.md`.
4. Read `docs/NETLIFY_DNS_ZONE_EXPORT_PROOF_20260911.md`.
5. Read `docs/NETLIFY_PRODUCTION_SOURCE_BUILD_PROOF_20260911.md`.
6. Read `docs/CLOUDFLARE_STAGE_C_ZERO_SECRET_DECISION_20260910.md`.
7. Fresh-check current `main` and open migration PRs.
8. Continue with the exact Cloudflare cutover plan; do not create another rollback host unless the owner changes this decision.
9. After stable Cloudflare hosting, make PayPal Live the next main phase.

## Continuation rule

GitHub is the source of truth. If newer `main` changes contradict this handoff, newer repository state wins and this document must be updated before continuing.
