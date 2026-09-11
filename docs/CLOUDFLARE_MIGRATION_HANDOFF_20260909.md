# LegendMural Cloudflare migration — current handoff

**Last updated:** 2026-09-11  
**Repository:** `ALKAVisuals/legend-stories-website`  
**Migration scope:** Netlify -> Cloudflare for the public LegendMural storefront only  
**Base `main` verified for this handoff update:** `33b4b373fc5490ca9314f9d195e6de30926b4f09`

> This is the canonical continuation document for the active Cloudflare migration. Always fresh-check current `main` before taking an action. GitHub is the source of truth.

## Non-negotiable scope boundaries

- `legendmural.com` Production remains on Netlify until an explicit final cutover is approved.
- Technisch Bouwadvies stays on Netlify and must not be changed by this migration.
- `ALKAVisuals/legendmural-dashboard` stays hosted through ChatGPT Sites; only migration-required integration points may be touched.
- Neon remains the database unless separately approved.
- PayPal, Resend, Neon and Cloudflare secret values must never be committed, printed or pasted into repository documentation.
- No PayPal Live activation, DNS/nameserver cutover, Production Cloudflare cutover, Netlify Production change, Production Worker redeploy or Production-data mutation without explicit owner approval for that exact step.
- Repository changes must go through a task branch and PR; never write directly to `main`.

## Current checkpoint

Cloudflare preview/runtime proofs and the fail-closed Production bootstrap are substantially complete.

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

## Preview/runtime proof anchors

Canonical preview Worker:

```text
Worker: legendmural-cloudflare-preview
Origin: https://legendmural-cloudflare-preview.lively-bonus-08da.workers.dev
Full storefront proof run ID: 34461889551
Worker version ID: 411070c2-5250-480c-85df-2c22e6260d3b
Result: success
```

Preview PayPal Sandbox, isolated Neon paid persistence/idempotency, PDFKit Worker runtime, private preview R2 semantics and the six-route API matrix have all been proven in earlier merged checkpoints. Preview checkout was restored fail-closed after testing.

## Production bootstrap state

Production R2 exists and is private:

```text
Bucket: legendmural-v3-invoice-pdfs-prod
r2.dev: off
custom domains: none
objects written: none
```

Production Worker exists separately and is fail-closed:

```text
Worker: legendmural-cloudflare-production
Version: 5d05b26d-4179-4ab0-a7b3-35cb990de854
V3_INVOICE_PDFS -> legendmural-v3-invoice-pdfs-prod
Production application secrets: zero
custom domain / DNS attachment: none
```

## Section C — DNS inventory / rollback readiness

Dedicated evidence:

- public DNS: `docs/CLOUDFLARE_DNS_INVENTORY_PROOF_20260910.md`;
- Netlify project/deploy/routing: `docs/NETLIFY_ACCOUNT_READONLY_INVENTORY_PROOF_20260910.md`;
- complete Netlify DNS export: `docs/NETLIFY_DNS_ZONE_EXPORT_PROOF_20260911.md`;
- isolated historical Production-source build: `docs/NETLIFY_PRODUCTION_SOURCE_BUILD_PROOF_20260911.md`;
- cutover gates: `docs/CLOUDFLARE_CUTOVER_AND_ROLLBACK_CHECKLIST.md`.

### Public/account routing facts already proven

- authoritative DNS is still Netlify/NS1-backed;
- public apex and `www` still reach Netlify rather than Cloudflare;
- Netlify project is `legendmural`;
- active Netlify Production deploy ID is `6a8d7a5e5b89930b8ea3b5ff`;
- active Netlify storefront commit is `95a57e8f05a0af547efa0dfc4d044b8a96de7fe3`;
- Netlify reports that deploy as `ready`;
- its configured publish directory is `dist`;
- the source commit contains `index.html`/`shop.html` and Vite builds root HTML into `dist`;
- nevertheless apex, `www`, default Netlify hostname, `main` branch hostname and the immutable deploy permalink all returned Netlify HTTP 404 for the tested static paths;
- therefore the current immutable Netlify deploy is **not a proven usable rollback target**.

### Complete account-level DNS export — captured

The owner supplied a Netlify DNS CSV export on 2026-09-11.

```text
Filename: legendmural.com (DNS Records).csv
SHA-256: 1681495c3e2a0adf932a20c2f4af7d3dc40bcbfde13cf9ad9f130fa45c75e493
Byte length: 918
Record count: 10
TTL on all exported records: 3600
```

The 10 managed records are:

1. apex `NETLIFY` -> `legendmural.netlify.app`;
2. `www` `NETLIFY` -> `legendmural.netlify.app`;
3. `resend._domainkey.mail.legendmural.com` TXT public key;
4. `send.mail.legendmural.com` MX -> `feedback-smtp.eu-west-1.amazonses.com`, priority `10`;
5. `send.mail.legendmural.com` TXT `v=spf1 include:amazonses.com ~all`;
6. `_dmarc.legendmural.com` TXT `v=DMARC1; p=none;`;
7. apex TXT `v=spf1 include:secureserver.net -all`;
8. `autodiscover.legendmural.com` CNAME -> `autodiscover.outlook.com`;
9. `email.legendmural.com` CNAME -> `email.secureserver.net`;
10. apex MX -> `legendmural-com.mail.protection.outlook.com`, priority `0`.

This closes the prior full-zone enumeration gap. The two `NETLIFY` records are hosting records to replace only during an approved cutover. The other eight records are mail/service records and must be preserved exactly; do not combine this migration with mail-policy cleanup.

Important correction to the public-only discovery: Resend/Amazon SES records do exist, but under `mail.legendmural.com`. Earlier public checks queried common candidate names one level higher and therefore did not enumerate them.

### MX priorities — captured

The Netlify CSV schema does not contain a separate priority column. Both preferences are nevertheless established without DNS mutation:

- apex Outlook MX priority `0` was captured by the earlier public DNS proof;
- Amazon SES authoritative Custom MAIL FROM documentation specifies `10 feedback-smtp.<region>.amazonses.com`, so the exported target `feedback-smtp.eu-west-1.amazonses.com` uses priority `10`.

Provider reference: `https://docs.aws.amazon.com/ses/latest/dg/mail-from.html`.

The DNS inventory is complete for cutover planning.

### Exact Production source build — proven cleanly outside Netlify

The exact source commit behind the current Netlify Production deploy was rebuilt in an isolated GitHub Actions job with no provider credentials and no provider/runtime mutation.

```text
Source SHA: 95a57e8f05a0af547efa0dfc4d044b8a96de7fe3
Workflow: Netlify Production source build proof
Run ID: 34590681486
Build job ID: 103235087481
Node: 22.23.2
Result: success
Output files: 293
Total dist bytes: 78,951,418
Historical repository build validator: 127 HTML pages / 293 output files
```

Required files were present and non-empty, including `index.html`, `shop.html`, `robots.txt`, `sitemap.xml` and `js/commerce/runtime-config.mjs`.

The generated `dist` was served only on `127.0.0.1:4173`; all of these returned HTTP 200:

```text
/
/index.html
/shop.html
/robots.txt
/sitemap.xml
```

Compact proof artifact ID `10195505491`, ZIP SHA-256 `b88801cc04da860b2906020e78185d6f4e0aec181e4bc6fee9b93c511ca36e5d`.

This rules out the simple explanation that the pinned source/build contract itself cannot produce a serveable storefront. It does **not** identify the internal reason why the current Netlify immutable deploy returns 404.

## Section C remaining blocker

The only remaining Section C blocker before any Cloudflare Production domain cutover is a **working, independently reachable rollback serving target**.

The source artifact is now proven buildable and locally serveable, but the existing Netlify immutable Production permalink still cannot be used because it returns 404 for the tested storefront/static paths. Read-only inspection has not proven the internal Netlify root cause. No repair, redeploy, publish-directory change or domain change has been performed.

The connected Netlify integration exposes current project/deploy metadata but not deploy history, so no older working Netlify deploy has been identified objectively through the connector. GitHub history also contains no independently proven old Netlify permalink that can safely be called the rollback target.

A Netlify Production repair/redeploy would change Production and requires separate explicit owner approval. Creating any alternative externally reachable rollback hosting resource is also an external mutation and must be approved for the exact action before execution.

## Exact next step

1. Use the proven source/build evidence to choose the minimum-risk way to create one independently reachable rollback serving target **without changing `legendmural.com` or `www` while it is prepared**.
2. Prefer a non-Production/draft/static target that can be tested by its own unique URL and that can serve the proven historical artifact/source.
3. Before creating/publishing that external target, stop and request explicit owner approval for the exact provider/action; do not silently repair or redeploy Netlify Production.
4. After approval and creation, GET-probe at minimum `/`, `/index.html`, `/shop.html`, `/robots.txt` and `/sitemap.xml`, and record the target URL/deploy identifier/source SHA plus HTTP results in GitHub.
5. Only after the rollback target is independently HTTP-successful may the exact Cloudflare DNS/nameserver/custom-domain cutover plan be finalized.

No DNS, nameserver, Netlify Production, Cloudflare Production route/custom-domain, PayPal Live, Resend activation, Neon Production data, R2 Production write or V3 activation is authorized by the source-build proof.

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
3. Read `docs/NETLIFY_PRODUCTION_SOURCE_BUILD_PROOF_20260911.md`.
4. Read `docs/NETLIFY_DNS_ZONE_EXPORT_PROOF_20260911.md`.
5. Read `docs/CLOUDFLARE_CUTOVER_AND_ROLLBACK_CHECKLIST.md`.
6. Read `docs/NETLIFY_ACCOUNT_READONLY_INVENTORY_PROOF_20260910.md`.
7. Read `docs/CLOUDFLARE_DNS_INVENTORY_PROOF_20260910.md`.
8. Read `docs/CLOUDFLARE_STAGE_C_ZERO_SECRET_DECISION_20260910.md`.
9. Fresh-check current `main` and open migration PRs.
10. Continue only with externally reachable rollback-target proof until separate Production cutover approval is given.

## Continuation rule

GitHub is the source of truth. If newer `main` changes contradict this handoff, newer repository state wins and this document must be updated before continuing.
