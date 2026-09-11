# LegendMural Cloudflare migration — current handoff

**Last updated:** 2026-09-11  
**Repository:** `ALKAVisuals/legend-stories-website`  
**Scope:** public LegendMural storefront migration from Netlify/NS1-backed DNS + Netlify hosting to Cloudflare DNS + the existing Production Worker  
**Phase 4 evidence base `main`:** `d4221dd8d38327e71e2c6f9e5b8aeac2cf845aca`

> **This file is the canonical continuation document for all new Cloudflare-migration chats.** GitHub is the source of truth. Always fresh-check `main` before any new action.

## Current status — Cloudflare hosting/DNS migration complete

The Netlify -> Cloudflare hosting/DNS migration has completed the planned cutover and post-cutover verification stages.

Canonical post-cutover evidence:

- `docs/CLOUDFLARE_PHASE4_POST_CUTOVER_PROOF_20260911.md`

The proof records the completed delegation, Worker Custom Domains, storefront/static delivery, public 8/8 mail/service DNS verification, fail-closed API matrix, checkout-paused behavior and response-header checks.

### Completed migration checkpoints

- PR #245 — Gate 0 read-only preflight — merged.
- PR #246 — guarded Production zone bootstrap — merged.
- Cloudflare full zone created and Active.
- Frozen eight mail/service DNS records recreated and verified before delegation change.
- GoDaddy authoritative nameservers changed from Netlify/NS1 to Cloudflare.
- Both Worker Custom Domains attached to `legendmural-cloudflare-production`.
- DNS propagation stabilized sufficiently for external public verification.
- Google Public DNS returns the exact Cloudflare authoritative nameservers.
- All eight preserved mail/service records were publicly verified exactly.
- Storefront, shop, robots.txt, sitemap.xml, representative product page and representative image/static delivery were verified live.
- `www.legendmural.com` canonicalizes to the apex as designed.
- Unknown `/api/*` remains hardened.
- Full six-route Stage C GET-only fail-closed matrix passed live.
- Checkout remains paused after the routing change.
- Live checkout response remains non-cacheable and carries the expected security headers.

## Current Production target

```text
Worker: legendmural-cloudflare-production
Known/current cutover Worker version: 5d05b26d-4179-4ab0-a7b3-35cb990de854
workers.dev: disabled
preview_urls: disabled
Production R2: legendmural-v3-invoice-pdfs-prod
Cloudflare zone ID: a23d780ad02e39b33dfd5877e389b7f1
Authoritative nameservers:
- crystal.ns.cloudflare.com
- dean.ns.cloudflare.com
Custom Domains:
- legendmural.com
- www.legendmural.com
```

Cloudflare DNS currently contains the eight preserved service/mail records plus the two Worker Custom Domain records for apex and `www`. No old Netlify apex/www hosting record should be reintroduced.

## Required fail-closed Production contract

Hosting is complete, but customer commerce is **not** live. The following remain intentionally OFF until separately approved later phases:

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

Do not interpret the completed hosting migration as authorization to alter these values.

## Preserved mail/service DNS contract — 8/8 publicly proven

The following were queried through Google Public DNS after the cutover and matched the migration contract:

1. `resend._domainkey.mail.legendmural.com` TXT — exact captured public Resend DKIM key, TTL 3600.
2. `send.mail.legendmural.com` MX -> `feedback-smtp.eu-west-1.amazonses.com`, priority 10, TTL 3600.
3. `send.mail.legendmural.com` TXT -> `v=spf1 include:amazonses.com ~all`, TTL 3600.
4. `_dmarc.legendmural.com` TXT -> `v=DMARC1; p=none;`, TTL 3600.
5. apex TXT -> `v=spf1 include:secureserver.net -all`, TTL 3600.
6. `autodiscover.legendmural.com` CNAME -> `autodiscover.outlook.com`, TTL 3600.
7. `email.legendmural.com` CNAME -> `email.secureserver.net`, TTL 3600.
8. apex MX -> `legendmural-com.mail.protection.outlook.com`, priority 0, TTL 3600.

Important distinction: ordinary mailbox routing is not hosted by Netlify or by the storefront Worker. Cloudflare is now authoritative DNS; the actual mail destinations remain unchanged. Production order-email sending through the storefront is still intentionally OFF.

## Phase 4 live verification result

The detailed evidence is in `docs/CLOUDFLARE_PHASE4_POST_CUTOVER_PROOF_20260911.md`.

Summary:

```text
Cloudflare authoritative delegation          PASS
Apex Worker Custom Domain                   PASS
www Worker Custom Domain                    PASS
Storefront/static delivery                  PASS
robots.txt                                  PASS
sitemap.xml                                 PASS
Representative product page                 PASS
Representative product image/static asset   PASS
Apex/www HTTPS use                          PASS
www -> apex canonical behavior              PASS
Public mail/service DNS                     8/8 PASS
Unknown /api/* hardening                    PASS
Known GET-only API matrix                    6/6 PASS
Checkout paused                             PASS
No-store/security response headers          PASS
```

The Cloudflare hosting/DNS migration can therefore be treated as **100% complete**. This completion statement is limited to hosting/DNS and the deliberately fail-closed Stage C runtime.

## Exact next action — guarded PayPal Live activation, awaiting Stage P1 approval

The exact continuation plan is now:

- `docs/CLOUDFLARE_PAYPAL_LIVE_ACTIVATION_PLAN_20260911.md`

Do **not** perform any PayPal Production mutation merely because hosting is complete.

Read-only audit has established that the Cloudflare Production payment runtime needs the prepared Production `NEON_DATABASE_URL`, `PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET` and `PAYPAL_WEBHOOK_ID`, plus the canonical Live API/checkout URL/origin configuration. The old Netlify Production context still contains these prepared values, but its `PAYPAL_ALLOW_LIVE=true` flag must **not** be copied blindly into Cloudflare.

The next authorized unit must be **Stage P1 only**, after explicit owner approval:

1. transfer the prepared Production Neon + PayPal secrets into Cloudflare secret storage without exposing values;
2. configure the canonical Production checkout success/cancel/origin values and `PAYPAL_API_BASE=https://api-m.paypal.com`;
3. keep `LEGENDMURAL_CHECKOUT_PAUSED=true`;
4. keep `PAYPAL_ALLOW_LIVE=false` during P1;
5. keep `ORDER_EMAILS_ENABLED=false` and every V3 activation flag false;
6. do not create an order, charge, webhook mutation, Neon row, R2 object or email in P1;
7. verify only presence/configuration and that checkout remains fail-closed.

After P1 evidence is green, Stage P2 (`PAYPAL_ALLOW_LIVE=true` while checkout remains paused) and Stage P3 (one tightly controlled real self-payment with a brief create-order window) each require their own separate explicit approval. Customer checkout remains a later independent gate even after a successful self-payment.

Resend/order-email activation and V3/R2 invoice-storage activation remain separate later phases and must not be bundled into PayPal Live unless separately approved.

## Netlify exit

Do not decommission the LegendMural Netlify project yet. Netlify decommission remains a final, separately authorized cleanup step after Cloudflare hosting and the required payment flow are proven stable.

Technisch Bouwadvies remains on Netlify and is out of scope.

## Non-negotiable boundaries

Without a new exact authorization, do not:

- change GoDaddy nameservers;
- change or redesign the eight mail/service records;
- alter Worker Custom Domains;
- deploy/reconfigure the Production Worker;
- enable PayPal Live;
- add PayPal Production/Neon secrets to Cloudflare;
- create/change the PayPal Production webhook;
- open customer checkout;
- enable Production order-email sending;
- activate V3 Profile 1, invoice reconciliation, invoice storage or dashboard invoice API;
- write Production R2 objects;
- mutate Production Neon data;
- decommission Netlify;
- touch Technisch Bouwadvies;
- modify the LegendMural dashboard hosting/design.

## Canonical supporting documents

Read in this order when continuing:

1. `docs/READ_ME_FIRST.md`
2. **this file** — `docs/CLOUDFLARE_MIGRATION_HANDOFF_20260911.md`
3. `docs/CLOUDFLARE_PHASE4_POST_CUTOVER_PROOF_20260911.md`
4. `docs/CLOUDFLARE_PAYPAL_LIVE_ACTIVATION_PLAN_20260911.md`
5. `docs/CLOUDFLARE_ENVIRONMENT_AND_SECRET_MAP.md`
6. `docs/CLOUDFLARE_PRODUCTION_CUTOVER_PLAN_20260911.md`
7. `docs/CLOUDFLARE_GATE0_READONLY_PREFLIGHT_PROOF_20260911.md`
8. `docs/CLOUDFLARE_CUTOVER_AND_ROLLBACK_CHECKLIST.md`
9. `docs/NETLIFY_DNS_ZONE_EXPORT_PROOF_20260911.md`
10. `docs/CLOUDFLARE_STAGE_C_ZERO_SECRET_DECISION_20260910.md`

The older `docs/CLOUDFLARE_MIGRATION_HANDOFF_20260909.md` is historical only.

## Next-chat instruction

A new chat must **not** reconstruct this migration from screenshots or old chat history. It should:

1. read `docs/READ_ME_FIRST.md`;
2. read this file;
3. read `docs/CLOUDFLARE_PHASE4_POST_CUTOVER_PROOF_20260911.md`;
4. read `docs/CLOUDFLARE_PAYPAL_LIVE_ACTIVATION_PLAN_20260911.md`;
5. fresh-check current `main` and open PRs;
6. recognize that Cloudflare hosting/DNS migration is complete;
7. make no Production mutation unless the owner explicitly authorizes the exact next PayPal activation stage.