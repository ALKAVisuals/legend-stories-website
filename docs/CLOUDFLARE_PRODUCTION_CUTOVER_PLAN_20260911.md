# LegendMural — exact Cloudflare Production cutover plan

**Date:** 2026-09-11  
**Repository:** `ALKAVisuals/legend-stories-website`  
**Planning base:** `a717c436c5bc767d0959c9597dff8bdb7ae3a050`  
**Scope:** hosting/DNS cutover only. Checkout, PayPal Live, email and all V3 activation remain OFF during this stage.

## Decision

LegendMural will move from Netlify/NS1-backed authoritative DNS and Netlify hosting to Cloudflare DNS plus the existing fail-closed Production Worker.

No additional Netlify or GitHub Pages fallback will be created. This is an intentional pre-live tradeoff. The site is not officially live, checkout remains paused during the hosting migration, the Cloudflare preview/runtime has already been proven, and the complete current DNS zone is preserved in GitHub evidence.

The Production Worker is the application origin. Cloudflare therefore recommends **Worker Custom Domains**, not classic Worker Routes. A Custom Domain requires an **active Cloudflare zone** and Cloudflare creates the Worker DNS record and certificate automatically.

Authoritative references:

- https://developers.cloudflare.com/workers/configuration/routing/custom-domains/
- https://developers.cloudflare.com/workers/configuration/routing/routes/
- https://developers.cloudflare.com/dns/zone-setups/full-setup/setup/
- https://developers.cloudflare.com/fundamentals/manage-domains/add-site/

## Fixed runtime target

```text
Worker: legendmural-cloudflare-production
Known bootstrap Worker version: 5d05b26d-4179-4ab0-a7b3-35cb990de854
workers.dev: disabled
preview_urls: disabled
Production R2: legendmural-v3-invoice-pdfs-prod
Production application secrets: zero for Stage C
```

Required fail-closed values before and throughout cutover:

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

The repository Worker already contains canonical-host handling: requests for `www.legendmural.com` are redirected with HTTP 301 to `https://legendmural.com`, preserving path/query. Therefore the intended final routing is to attach **both** `legendmural.com` and `www.legendmural.com` to the same Production Worker as Custom Domains. The Worker itself provides the `www` -> apex canonical redirect.

## DNS contract that must survive unchanged

The old Netlify zone contains 10 managed records. The two `NETLIFY` hosting records are migration-specific and will be replaced. The following **eight mail/service records must be recreated exactly** in Cloudflare before authoritative nameservers change:

1. `resend._domainkey.mail.legendmural.com` TXT — existing Resend DKIM public-key value from the captured Netlify CSV;
2. `send.mail.legendmural.com` MX -> `feedback-smtp.eu-west-1.amazonses.com`, priority `10`;
3. `send.mail.legendmural.com` TXT -> `v=spf1 include:amazonses.com ~all`;
4. `_dmarc.legendmural.com` TXT -> `v=DMARC1; p=none;`;
5. apex TXT -> `v=spf1 include:secureserver.net -all`;
6. `autodiscover.legendmural.com` CNAME -> `autodiscover.outlook.com`;
7. `email.legendmural.com` CNAME -> `email.secureserver.net`;
8. apex MX -> `legendmural-com.mail.protection.outlook.com`, priority `0`.

Use TTL `3600` to preserve the captured zone contract where Cloudflare supports the explicit TTL. Mail/service CNAMEs must remain **DNS only**, not proxied. Do not alter SPF, DMARC, DKIM, MX or mail-provider policy as part of this migration.

Source evidence: `docs/NETLIFY_DNS_ZONE_EXPORT_PROOF_20260911.md`.

## Exact execution sequence

### Gate 0 — fresh read-only preflight

Immediately before any provider write:

1. Fresh-check storefront `main` and record the exact SHA.
2. Read-only verify the Production Worker still exists and record its current version/deployment ID.
3. Read-only verify all eight fail-closed values above.
4. Confirm Production application secret names remain intentionally absent for Stage C.
5. Confirm Production R2 remains private and has no public custom domain/r2.dev exposure.
6. Read-only query whether a Cloudflare zone named `legendmural.com` already exists in the intended Cloudflare account.
7. Check the current public authoritative NS delegation and whether a registrar-level DNSSEC/DS record exists. If an old DS record exists, DNSSEC must be disabled/removed before changing authoritative nameservers and can be re-enabled in Cloudflare only after the zone is stable.
8. Confirm the complete eight-record mail/service contract against the captured CSV proof.

If any of these checks contradict the handoff, stop. Do not mutate Production.

### Gate 1 — exact owner authorization

Before the first external write, request one explicit authorization that names the exact allowed actions:

- create or reuse the Cloudflare `legendmural.com` full-setup zone;
- recreate the eight preserved mail/service records;
- optionally create temporary DNS-only hosting continuity records while the zone is pending;
- change the domain's authoritative nameservers at the registrar to the exact Cloudflare-assigned nameservers;
- attach `legendmural.com` and `www.legendmural.com` to `legendmural-cloudflare-production` as Custom Domains after the zone becomes Active;
- remove only temporary hosting continuity records that conflict with the Worker Custom Domains;
- perform non-mutating post-cutover probes.

This authorization does **not** authorize PayPal Live, checkout opening, Resend activation, V3 activation, Production R2 writes, Neon data mutation or Technisch Bouwadvies changes.

### Phase 1 — prepare Cloudflare DNS before changing public delegation

1. If the zone does not already exist, add `legendmural.com` to Cloudflare using a **full/primary DNS setup**.
2. Record the exact Cloudflare zone ID and the exact pair of Cloudflare-assigned authoritative nameservers. Do not expose credentials.
3. Recreate all eight preserved mail/service records exactly before nameserver change.
4. Verify the eight records inside Cloudflare account state.
5. Do not enable Worker Custom Domains yet if the zone is still Pending; Cloudflare requires the zone to be Active first.

Cloudflare explicitly requires DNS records to be reviewed and completed before nameserver delegation is changed.

#### Optional temporary hosting continuity records

Because a pending Cloudflare zone answers DNS but cannot proxy traffic, temporary DNS-only hosting records may be used only to avoid an NXDOMAIN interval while activation is pending. If used, point apex and `www` to the existing Netlify hostname and clearly mark them as temporary. The current Netlify deployment is already known to return 404, so these records are not a rollback mechanism; their only purpose is DNS continuity and avoidance of negative caching.

If temporary CNAMEs are used, they **must be removed immediately before creating the corresponding Worker Custom Domain**, because Cloudflare does not allow creating a Worker Custom Domain on a hostname that already has a CNAME record.

### Phase 2 — authoritative nameserver switch

1. At the registrar, replace the current Netlify/NS1 nameservers with **only** the exact pair assigned by Cloudflare.
2. If an old registrar DS record was present, ensure it was removed/disabled before the switch.
3. Do not change any other domain, especially Technisch Bouwadvies.
4. Monitor public NS resolution until the parent/delegation and Cloudflare dashboard both report the zone as **Active**.
5. During propagation, verify MX/TXT/CNAME service records still resolve from multiple resolvers. Stop if the mail/service contract diverges.

Cloudflare notes that nameserver propagation can take up to 24 hours. The zone cannot proxy Worker traffic while it is still Pending.

### Phase 3 — attach the existing Production Worker

Only after the zone is Active:

1. Remove any temporary apex CNAME used solely for pending-zone continuity.
2. Attach `legendmural.com` to `legendmural-cloudflare-production` as a **Custom Domain**.
3. Remove any temporary `www` CNAME used solely for pending-zone continuity.
4. Attach `www.legendmural.com` to the same Worker as a **Custom Domain**.
5. Let Cloudflare create the Worker DNS records and certificates; do not create competing manual CNAMEs for those hostnames.
6. Confirm the existing Production Worker remains fail-closed. Do not enable checkout or add PayPal/Resend/Neon application secrets during this hosting step.

The reason for using two Custom Domains is exact-host matching: a Custom Domain on the apex does not automatically cover `www`. The existing Worker then returns the canonical 301 for `www`.

### Phase 4 — immediate non-mutating verification

After both Custom Domains are attached, require all of the following before calling hosting cutover successful:

1. `https://legendmural.com/` -> expected storefront HTML, HTTP 200;
2. `https://legendmural.com/index.html` -> HTTP 200;
3. `https://legendmural.com/shop.html` -> HTTP 200;
4. representative product page -> HTTP 200;
5. representative static image/media -> HTTP 200;
6. `https://legendmural.com/robots.txt` -> HTTP 200;
7. `https://legendmural.com/sitemap.xml` -> HTTP 200;
8. `https://www.legendmural.com/...` -> HTTP 301 to the same path/query on `https://legendmural.com/...`;
9. HTTPS certificate valid for apex and `www`;
10. public NS now matches the Cloudflare-assigned pair;
11. all eight preserved mail/service records still resolve correctly;
12. unknown `/api/*` remains hardened 404;
13. the six known API routes match the Stage C GET-only fail-closed matrix;
14. security/no-store/CORS headers match the existing contract;
15. `LEGENDMURAL_CHECKOUT_PAUSED=true` remains proven after routing change.

Expected GET-only Stage C API matrix:

```text
GET /api/paypal/checkout            -> 503 CHECKOUT_PAUSED
GET /api/paypal/capture             -> 503 PAYPAL_CAPTURE_SERVICE_NOT_CONFIGURED
GET /api/paypal/webhook             -> 503 PAYPAL_WEBHOOK_SERVICE_NOT_CONFIGURED
GET /api/order-status               -> 503 ORDER_STATUS_SERVICE_NOT_CONFIGURED
GET /api/invoice-download           -> 405 METHOD_NOT_ALLOWED
GET /api/internal/dashboard-invoice -> 405 METHOD_NOT_ALLOWED
```

Record the exact timestamp, storefront SHA, Worker version/deployment ID, zone ID, nameservers, Custom Domain state and probe results in GitHub. Never record secret values.

## Recovery during Stage C

There is intentionally no third-provider static rollback host. Recovery therefore depends on where a failure occurs:

- **Worker code/config failure:** restore/activate the previously proven Worker version or deploy the last known-good `main` state while keeping all live flags OFF.
- **Custom Domain attachment failure:** keep/fix Cloudflare DNS and reattach the known-good Production Worker; checkout stays paused.
- **DNS record mistake:** restore the exact record from the captured 10-record Netlify zone evidence.
- **nameserver/delegation failure:** correct the registrar delegation to the exact Cloudflare-assigned nameservers. If Cloudflare onboarding cannot be recovered in the migration window, the emergency fallback is to restore the prior Netlify/NS1 authoritative nameservers together with the captured old DNS-zone contract. The old Netlify storefront itself is not a proven working serving target and must not be described as one.
- **mail/service regression:** restore the exact affected MX/TXT/CNAME value from the captured zone before doing any unrelated cleanup.

Do not activate PayPal Live as a workaround for a hosting failure.

## After hosting is proven stable — next main phase

The next main phase is **PayPal Live**, not additional hosting work.

Sequence:

1. configure PayPal Production credentials only in Cloudflare secret storage;
2. configure the PayPal Production webhook to the Cloudflare Production endpoint;
3. prove create-order -> PayPal -> capture -> webhook -> Neon order-state flow;
4. perform one small real self-payment;
5. verify amount, PayPal order/capture, webhook verification, Neon paid state and idempotency;
6. only after that evidence is green, request separate explicit owner approval to open customer checkout.

Resend/order-email activation and V3/R2 invoice-storage activation remain separate later phases and must not be bundled into PayPal Live unless separately approved.

## Netlify exit

Do not spend additional migration effort repairing the unexplained Netlify 404 unless a new requirement appears. Keep the existing LegendMural Netlify project untouched during the Cloudflare hosting cutover. After Cloudflare hosting and the required payment flow are proven stable, plan a separate explicit Netlify decommission step so LegendMural no longer consumes unnecessary Netlify credits/costs.
