# LegendMural Cloudflare migration — current handoff

**Last updated:** 2026-09-10  
**Repository:** `ALKAVisuals/legend-stories-website`  
**Migration scope:** Netlify -> Cloudflare for the public LegendMural storefront only  
**Base `main` verified for this handoff update:** `9cf90d05fb9b57700bb4ea44144208fd1ff2b963`

> This is the canonical continuation document for the active Cloudflare migration. Always fresh-check current `main` before taking an action. GitHub is the source of truth.

## Non-negotiable scope boundaries

- `legendmural.com` Production remains on Netlify until an explicit final cutover is approved.
- Technisch Bouwadvies stays on Netlify and must not be changed by this migration.
- `ALKAVisuals/legendmural-dashboard` stays hosted through ChatGPT Sites; only migration-required integration points may be touched.
- Neon remains the database unless a separately approved migration says otherwise.
- PayPal, Resend, Neon and Cloudflare secret values must never be committed, printed or pasted into repository documentation.
- No PayPal Live activation, DNS cutover, Production Cloudflare cutover, Netlify Production change or Production-data mutation without explicit owner approval for that exact step.
- Repository changes must go through a task branch and PR; never write directly to `main`.

## Current checkpoint

Cloudflare preview/runtime proofs and the pre-cutover Production bootstrap are substantially complete. The private Production R2 bucket exists and the distinct Production Worker exists in a deliberately fail-closed, non-public state.

Current Production state:

```text
Production Worker: legendmural-cloudflare-production
exists: true
Worker bootstrap version ID: 5d05b26d-4179-4ab0-a7b3-35cb990de854
workers.dev exposure: disabled by repository Production config
preview URL exposure: disabled by repository Production config
custom domain / DNS attachment: none
fail-closed flags proven remotely: true
Production application secret names present: none

Production R2 bucket: legendmural-v3-invoice-pdfs-prod
exists: true
r2.dev public access: false
enabled custom domains: none
public exposure detected: false
objects written: none
```

The Worker has the exact private R2 binding:

```text
V3_INVOICE_PDFS -> legendmural-v3-invoice-pdfs-prod
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

`legendmural.com` has not been cut over. Public DNS/HTTPS still reaches Netlify. Netlify account-level read-only inspection has now confirmed that the relevant site is `legendmural`, that the custom LegendMural domains are attached to that site, and that the current Production deploy is marked ready on storefront commit `95a57e8f05a0af547efa0dfc4d044b8a96de7fe3`.

A dedicated external GET-only proof then showed that the current Netlify serving problem is broader than the custom-domain attachment: apex, `www`, the default Netlify site URL, the `main` branch URL and the immutable Production deploy permalink all return Netlify HTTP 404 for the tested static storefront paths. The immutable current deploy therefore is **not a proven working rollback target** in its present state.

The remaining Section C account-level inventory gap is the complete Netlify DNS-zone record list. The connected Netlify tool can inspect project/deploy/domain metadata but does not expose a DNS-zone record-listing action, so the complete zone must be captured separately before any nameserver-level cutover is prepared.

## Stage C application-secret decision

Stage C is hosting-only. It intentionally requires **zero LegendMural application secrets** in the Cloudflare Production Worker while checkout, PayPal Live, order email and every V3 activation flag remain OFF.

Do not copy Preview/Sandbox credentials into Production. Do not add Live credentials before the separately approved feature stage that actually needs them.

Dedicated decision: `docs/CLOUDFLARE_STAGE_C_ZERO_SECRET_DECISION_20260910.md`.

The repository regression contract for zero-secret Stage C uses GET-only probes and expects:

```text
GET /api/paypal/checkout                -> 503 CHECKOUT_PAUSED
GET /api/paypal/capture                 -> 503 PAYPAL_CAPTURE_SERVICE_NOT_CONFIGURED
GET /api/paypal/webhook                 -> 503 PAYPAL_WEBHOOK_SERVICE_NOT_CONFIGURED
GET /api/order-status                   -> 503 ORDER_STATUS_SERVICE_NOT_CONFIGURED
GET /api/invoice-download               -> 405 METHOD_NOT_ALLOWED
GET /api/internal/dashboard-invoice     -> 405 METHOD_NOT_ALLOWED
```

These responses must stay JSON + `no-store`. The 503 configuration responses are deliberately fail-closed and require no provider/network mutation.

## Important merged checkpoints

| PR | Purpose | Merge/main checkpoint |
|---|---|---|
| #217 | PayPal duplicate webhook least-privilege path | `c912e012e14a9337a37464f3556977b882b806db` |
| #219 | Preserve explicit `.html` URLs on Cloudflare | `555df319ed155f02f1ccf8d53861051c7d175f64` |
| #222 | Fix Cloudflare bare-root route | `e2618084687b35377359e1809127e11b82875884` |
| #223 | Record Cloudflare preview run #10 | `34aad55768e00ff0e557c4a4b274041a2dbffa51` |
| #224 | Record PayPal Sandbox duplicate-webhook proof | `e2d3acc3e729647ab40e5154350237ce5b995531` |
| #225 | Record fresh PayPal Sandbox checkout proof | `0df0966661bbe1164a4ca886120e400c29ed9fca` |
| #226 | Add isolated Cloudflare preview PDF/R2 proof workflow | `7dac56453ed00fa466dc21ad44063aa949dc3aa4` |
| #227 | Normalize Cloudflare proof account ID | `34d8b8f9a6169424daf59dd009b2353bfa0b5a56` |
| #228 | Record actual Worker PDFKit + preview R2 proof | `2d44dd103bea6e136c697e57740d5f9aed27a0b9` |
| #229 | Add read-only six-route preview API matrix | `573db2a7ddd2d972a5dcbd2efbd1f39e40dea216` |
| #230 | Record successful preview API route proof | `36820e6c64f5d4f88e03e1de0e37758708fb805b` |
| #231 | Add Cloudflare Production read-only inventory | `30f5dba3ad2a8ad7b7966b5903dd0dc4d4d8e28f` |
| #232 | Record Production inventory proof | `5a9f5bff1206b0b240140e28b85403b37ff75cbb` |
| #233 | Add guarded Production R2 bootstrap | `422b98c32e55f2c23e204c607924cc6bd0e90eb8` |
| #234 | Record Production R2 provisioning proof | `6fc7eb414274685f8102b2268d4614556d5b11e0` |
| #235 | Add guarded fail-closed Production Worker bootstrap | `ddc8646ab2e1a9b887c94a0542a13dbc2e49af2d` |
| #236 | Record Production Worker bootstrap proof | `d63d7096e65662e4e18cdf79c36f200267e3c3fa` |
| #237 | Remove unsupported nested Production `alias`; clean Production dry-run | `cbfc525b47f4b29e71278b5d8784e7d883f9b0f1` |
| #238 | Prove Stage C zero-secret fail-closed contract | `9a8ccf21618e3fd3af87c3cab6b675d559c3e69e` |
| #239 | Record public read-only DNS cutover inventory | `9cf90d05fb9b57700bb4ea44144208fd1ff2b963` |

## Preview proof anchors

Canonical preview Worker:

```text
Worker: legendmural-cloudflare-preview
Origin: https://legendmural-cloudflare-preview.lively-bonus-08da.workers.dev
Full storefront preview proof run: #10
Run ID: 34461889551
Worker version ID: 411070c2-5250-480c-85df-2c22e6260d3b
Result: success
```

The direct Cloudflare Git/Workers Builds integration remains disconnected. Canonical preview deploys use the repository's manually dispatched GitHub Actions workflow.

### PayPal Sandbox / isolated Neon

Fresh paid proof anchor:

```text
PayPal order ID: 8YF93007BW575474P
Amount: 49.95 EUR
Mode: test
Neon status: paid
Neon version: 1
Capture ID: 1KF63004E9093115U
Webhook event: WH-7BV26182T4398862C-2AX615180S755454D
Webhook result: SUCCESS / DELIVERED / HTTP 200 OK
```

Duplicate-webhook anchor:

```text
Event ID: WH-6RC26966LE938421A-4TS169605E543550Y
PayPal order ID: 8U692661E3486793D
Capture ID: 69815081UN702743U
Amount: 45.45 EUR
Result: duplicate resend delivered; isolated Neon stayed paid/version 1 with one canonical ledger row
```

Preview checkout was restored to `LEGENDMURAL_CHECKOUT_PAUSED=true` after the proof.

### Actual Worker PDFKit + preview R2

```text
Workflow: Cloudflare preview PDF R2 account proof
Successful run ID: 34469940961
Temporary Worker: legendmural-cloudflare-preview-pdf-r2-proof
Temporary Worker version ID: ed2d799c-a696-4089-b64a-0ce5be871fe4
Preview bucket: legendmural-v3-invoice-pdfs-preview
PDF SHA-256: 8fddafde6eba252eaa257fc85aa357a69043b7651eea829f355770b967718c1f
PDF byte length: 24256
firstDuplicate: false
secondDuplicate: true
read-back bytes equal: true
```

The temporary proof Worker was deleted afterward.

### Six-route preview API matrix

Dedicated evidence: `docs/CLOUDFLARE_PREVIEW_API_ROUTE_MATRIX_PROOF_20260910.md`.

```text
Run ID: 34471706281
GET /api/paypal/checkout                -> 503 CHECKOUT_PAUSED
GET /api/paypal/capture                 -> 405 METHOD_NOT_ALLOWED
GET /api/paypal/webhook                 -> 405 METHOD_NOT_ALLOWED
GET /api/order-status                   -> 405 METHOD_NOT_ALLOWED
GET /api/invoice-download               -> 405 METHOD_NOT_ALLOWED
GET /api/internal/dashboard-invoice     -> 405 METHOD_NOT_ALLOWED
```

## Production R2 provisioning — PASSED

Dedicated evidence: `docs/CLOUDFLARE_PRODUCTION_R2_PROVISION_PROOF_20260910.md`.

```text
Workflow: Cloudflare Production R2 bootstrap
Run number: 2
Run ID: 34475333977
Head SHA: 422b98c32e55f2c23e204c607924cc6bd0e90eb8
Result: success
Bucket: legendmural-v3-invoice-pdfs-prod
r2.dev public access enabled: false
Enabled custom domains: none
Public exposure detected: false
R2 object writes: none
```

## Production Worker bootstrap — PASSED

Dedicated evidence: `docs/CLOUDFLARE_PRODUCTION_WORKER_BOOTSTRAP_PROOF_20260910.md`.

```text
Workflow: Cloudflare Production Worker bootstrap
Run number: 2
Run ID: 34478408523
Head SHA: ddc8646ab2e1a9b887c94a0542a13dbc2e49af2d
Result: success
Worker: legendmural-cloudflare-production
Worker version ID: 5d05b26d-4179-4ab0-a7b3-35cb990de854
failClosedFlagsProven: true
Production application secret names present: none
R2 public exposure detected: false
```

The five-minute schedule is present, but reconciliation remains a no-op while `V3_INVOICE_RECONCILIATION_ENABLED=false` and `ORDER_EMAILS_ENABLED=false`.

## Wrangler Production alias cleanup — CLOSED

PR #237 removed the unsupported nested `env.production.alias`, retained the canonical top-level PDFKit alias, and added regression coverage. The Production dry-run completed without the previous unsupported nested-alias warning. No Production redeploy was performed for this repository-only cleanup.

## Section C public DNS inventory — PASSED / Netlify account routing proof — PASSED / complete DNS zone still OPEN

Dedicated public DNS evidence: `docs/CLOUDFLARE_DNS_INVENTORY_PROOF_20260910.md`.
Dedicated Netlify routing evidence: `docs/CLOUDFLARE_NETLIFY_ACCOUNT_ROUTING_PROOF_20260910.md`.

Latest successful public DNS proof:

```text
Workflow: Cloudflare DNS read-only inventory
Run number: 6
Run ID: 34486539162
Head SHA: 8a285a7ab3edcb06386610a0b686eb7335cdf0a2
Observed: 2026-09-10T14:04:01.209Z
Result: success
Mutation performed: false
Credentials used: false
```

Key public state:

```text
Authoritative NS: dns1/2/3/4.p01.nsone.net (TTL 3600)
SOA contact: domains+netlify.netlify.com
Apex CNAME: none
Apex A: Netlify/provider-controlled answers, TTL 120
Apex AAAA: none
www CNAME: none
www A: same provider-controlled answers, TTL 120
www AAAA: none
MX: 0 legendmural-com.mail.protection.outlook.com. (TTL 3600)
SPF: v=spf1 include:secureserver.net -all (TTL 3600)
DMARC: v=DMARC1; p=none; (TTL 3600)
Microsoft selector1/selector2 DKIM candidates: NXDOMAIN
Resend standard DKIM/send candidates: NXDOMAIN
CT sources crt.sh + Cert Spotter: both HTTP 200; only apex + www found
https://legendmural.com/: HTTP 404, server Netlify
https://www.legendmural.com/: HTTP 404, server Netlify
Cloudflare public serving evidence: false
```

Netlify account/routing state:

```text
Netlify site: legendmural
Current Production deploy state: ready
Current Production storefront commit: 95a57e8f05a0af547efa0dfc4d044b8a96de7fe3
Routing proof workflow: Netlify account routing read-only proof
Expanded proof run: #3
Run ID: 34492049415
Head SHA: 098a0b944e973587ab5b56038392673d208d121f
Mutation performed: false
Provider credentials used by probe: false
Requests: GET only
```

The expanded proof tested five serving forms — apex, `www`, default `legendmural.netlify.app`, `main--legendmural.netlify.app` and the immutable Production deploy permalink — against five static paths: `/`, `/index.html`, `/shop.html`, `/robots.txt` and `/sitemap.xml`. All 25 requests returned HTTP 404 with Netlify serving evidence.

This proves that the observed failure is not limited to the custom-domain DNS/attachment layer. The immutable current deploy itself does not currently serve these expected static storefront resources. The exact internal reason for that Netlify deploy behavior remains unproven and no Production repair has been attempted.

The source tree at the active Production commit contains `index.html`, its Vite configuration includes root HTML entries in the `dist` build, and `netlify.toml` publishes `dist`. The account also reports the deploy as ready. That contradiction is why a working rollback target must be separately proven before cutover.

The public 404 state existed before these proofs and was not caused by the migration inventory. Because the current authoritative zone is Netlify/NS1-backed, the eventual Cloudflare cutover may require a **nameserver-level DNS-hosting transition** rather than a simple A/CNAME swap. Therefore do not prepare or execute a nameserver change until the full Netlify zone is captured read-only and all mail/service records are accounted for.

## Section B / C status

### Proven / closed

- Cloudflare account access for controlled GitHub Actions proofs;
- separate functioning preview Worker;
- private preview R2 and actual R2 runtime semantics;
- preview static serving and hardened API routing;
- all six intended API routes;
- PayPal Sandbox create/capture/webhook path;
- isolated Neon paid persistence and duplicate idempotency;
- actual Worker PDFKit runtime in preview proof;
- preview checkout restored fail-closed;
- Production account inventory;
- private Production R2 bucket existence;
- distinct Production Worker existence;
- Production Worker remote fail-closed flags;
- Production R2 binding on the Worker;
- zero Production application secrets currently present;
- Stage C decision that zero application secrets are required while active features remain OFF;
- clean Wrangler Production dry-run after nested alias cleanup;
- no Production R2 object has been written;
- public Section C DNS/HTTPS snapshot including NS, apex, `www`, MX, SPF, DMARC, candidate DKIM/Resend names and TTLs;
- two-source public certificate-transparency check;
- current public serving path confirmed as Netlify rather than Cloudflare;
- exact Netlify site/domain attachment identified account-level;
- current Netlify Production deploy metadata and storefront commit identified;
- default, branch and immutable Netlify serving forms probed externally GET-only;
- 25/25 expanded Netlify static probes observed as HTTP 404;
- current immutable Netlify Production deploy identified as not yet a proven working rollback target;
- no DNS/custom-domain cutover performed.

### Still open before cutover

- capture the complete read-only **Netlify DNS-zone record list** so non-publicly-enumerable records cannot be lost during a nameserver transition;
- establish a **working, independently verified rollback target** before any Cloudflare domain cutover;
- determine the Netlify static-serving 404 root cause if Netlify is to remain the rollback runtime, or prepare another explicitly approved rollback route;
- after the complete zone and rollback facts are recorded, prepare the exact Cloudflare DNS/nameserver + Worker custom-domain cutover and rollback plan;
- obtain separate explicit owner approval for the actual domain/runtime cutover;
- after routing, verify canonical HTTPS/static assets and the zero-secret GET-only API matrix before considering any later feature activation.

## Exact next step

**Capture the complete Netlify DNS zone read-only and close the rollback-target blocker.**

Do not change any Netlify DNS record, site domain, nameserver, deploy, Cloudflare zone/custom domain, Production secret or live feature flag during this step.

The connected Netlify tool does not expose full DNS-zone record enumeration. Therefore the next evidence must come from a read-only Netlify DNS zone view/export or equivalent account-level record listing. Record at minimum every visible record's name/host, type, target/value and TTL where exposed, including mail/service verification records and any subdomains not discoverable publicly.

In parallel, do not call the current immutable deploy a rollback target until a static URL is proven HTTP-successful. Any Netlify repair/redeploy would be a separate Production-changing action and requires explicit owner approval before execution.

After the full zone and a working rollback path are proven and committed through a task branch/PR, prepare the exact Stage C cutover/rollback plan. No DNS mutation is authorized by inventory work.

## What must not be changed without a new exact approval

- `legendmural.com` DNS/nameservers/custom-domain routing;
- Netlify Production or Netlify domain attachments;
- PayPal Live;
- Resend Production activation;
- Production Worker redeployment;
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
3. Read `docs/CLOUDFLARE_DNS_INVENTORY_PROOF_20260910.md`.
4. Read `docs/CLOUDFLARE_NETLIFY_ACCOUNT_ROUTING_PROOF_20260910.md`.
5. Read `docs/CLOUDFLARE_STAGE_C_ZERO_SECRET_DECISION_20260910.md`.
6. Read `docs/CLOUDFLARE_PRODUCTION_WORKER_BOOTSTRAP_PROOF_20260910.md`.
7. Read `docs/CLOUDFLARE_PRODUCTION_R2_PROVISION_PROOF_20260910.md`.
8. Read `docs/CLOUDFLARE_ENVIRONMENT_AND_SECRET_MAP.md`.
9. Read `docs/CLOUDFLARE_CUTOVER_AND_ROLLBACK_CHECKLIST.md`.
10. Fresh-check current `main` and open migration PRs.
11. Execute only the complete Netlify DNS-zone capture and rollback-target proof; do not mutate Production.

## Continuation rule

GitHub is the source of truth. If newer `main` changes contradict this handoff, newer repository state wins and this document must be updated before continuing.