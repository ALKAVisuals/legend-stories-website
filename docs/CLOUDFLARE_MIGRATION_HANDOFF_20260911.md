# LegendMural Cloudflare migration — current handoff

**Last updated:** 2026-09-11  
**Repository:** `ALKAVisuals/legend-stories-website`  
**Scope:** public LegendMural storefront migration from Netlify/NS1-backed DNS + Netlify hosting to Cloudflare DNS + the existing Production Worker  
**Starting `main` for this handoff update:** `e6d9564f122215bbeb7253601122e6ae039c63a2`

> **This file supersedes `docs/CLOUDFLARE_MIGRATION_HANDOFF_20260909.md` for all new Cloudflare-migration chats.** GitHub is the source of truth. Always fresh-check `main` before any new action.

## Current status — cutover is live, DNS propagation is still stabilizing

The Cloudflare Production hosting cutover has progressed through zone creation, DNS preservation, registrar nameserver switch, zone activation and Worker Custom Domain attachment.

### Completed

- PR #245 (Gate 0 read-only preflight) is merged.
  - merge commit: `7eaf0d4d9aca3f84ce9667fbaf406e6722637dab`
- PR #246 (guarded Production zone bootstrap) is merged.
  - PR head: `427258087edd60ec4c421019bf7966fb8fa9a9c3`
  - merge commit: `e6d9564f122215bbeb7253601122e6ae039c63a2`
- The manual Production zone-bootstrap workflow was run successfully after the Cloudflare API token gained the required `Zone -> Zone -> Edit` and `Zone -> DNS -> Edit` permissions.
- Cloudflare full zone exists:
  - zone: `legendmural.com`
  - zone ID: `a23d780ad02e39b33dfd5877e389b7f1`
  - Cloudflare dashboard status: **Active**
- The frozen mail/service DNS contract was created and verified **8/8 exactly** before registrar delegation was changed.
- Registrar: GoDaddy.
- Authoritative nameservers were changed at GoDaddy from the previous Netlify/NS1 delegation to exactly:
  - `crystal.ns.cloudflare.com`
  - `dean.ns.cloudflare.com`
- No registrar DS record was present before the switch.
- Both Production Worker Custom Domains are attached to `legendmural-cloudflare-production`:
  - `legendmural.com`
  - `www.legendmural.com`
- The Worker `workers.dev` URL remains disabled.
- `www.legendmural.com` is designed to redirect with HTTP 301 to the apex `https://legendmural.com` while preserving path/query.
- The owner has already observed the storefront loading again on `https://legendmural.com/shop.html` with page styling/assets visible.

### Still in progress

Public DNS propagation is not yet fully stable across all resolvers/caches. During manual verification the owner saw the site work, but later `robots.txt` / `sitemap.xml` requests intermittently returned browser-level `DNS_PROBE_FINISHED_NXDOMAIN`.

Treat this as a propagation/stability checkpoint unless fresh evidence shows an actual DNS-contract problem. Do **not** keep changing DNS while propagation is still converging.

Cloudflare notes nameserver propagation can take up to 24 hours.

## Current Production target

```text
Worker: legendmural-cloudflare-production
Known bootstrap Worker version: 5d05b26d-4179-4ab0-a7b3-35cb990de854
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

## Required fail-closed Production contract

The hosting cutover must remain fail-closed until the later PayPal Live phase is separately approved.

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

Gate 0 previously proved this exact contract. Phase 4 must re-prove the externally observable behavior after the routing cutover. Do not infer success merely from the homepage loading.

## Preserved mail/service DNS contract

These eight records were recreated in Cloudflare and verified before the nameserver switch:

1. `resend._domainkey.mail.legendmural.com` TXT — captured Resend DKIM public key.
2. `send.mail.legendmural.com` MX -> `feedback-smtp.eu-west-1.amazonses.com`, priority `10`.
3. `send.mail.legendmural.com` TXT -> `v=spf1 include:amazonses.com ~all`.
4. `_dmarc.legendmural.com` TXT -> `v=DMARC1; p=none;`.
5. apex TXT -> `v=spf1 include:secureserver.net -all`.
6. `autodiscover.legendmural.com` CNAME -> `autodiscover.outlook.com`.
7. `email.legendmural.com` CNAME -> `email.secureserver.net`.
8. apex MX -> `legendmural-com.mail.protection.outlook.com`, priority `0`.

Source proof: `docs/NETLIFY_DNS_ZONE_EXPORT_PROOF_20260911.md`.

Important distinction: ordinary mailbox routing is not hosted by Netlify. Netlify/NS1 previously hosted DNS only. The actual mail destination remains the same; Cloudflare is now authoritative DNS. Production order-email sending through the storefront remains intentionally OFF (`ORDER_EMAILS_ENABLED=false`) until a later separately approved activation phase.

## Exact next action — Phase 4 read-only post-cutover verification

Do **not** mutate Cloudflare, GoDaddy, Netlify, PayPal, Resend, Neon or R2 merely because some resolvers are still propagating.

Once public DNS is stable enough to test reliably, run the full non-mutating verification matrix below.

Required checks:

1. `https://legendmural.com/` -> expected storefront HTML, HTTP 200.
2. `https://legendmural.com/index.html` -> HTTP 200.
3. `https://legendmural.com/shop.html` -> HTTP 200.
4. Representative product page -> HTTP 200.
5. Representative static image/media -> HTTP 200.
6. `https://legendmural.com/robots.txt` -> HTTP 200.
7. `https://legendmural.com/sitemap.xml` -> HTTP 200.
8. `https://www.legendmural.com/...` -> HTTP 301 to same path/query on `https://legendmural.com/...`.
9. Valid HTTPS certificate for apex and `www`.
10. Public authoritative NS resolves to exactly the Cloudflare pair above.
11. All eight preserved mail/service records resolve correctly from public DNS.
12. Unknown `/api/*` remains hardened 404.
13. The six known GET-only API routes match the Stage C fail-closed matrix.
14. Security / no-store / CORS behavior matches the existing contract.
15. Checkout remains paused after the routing change.

Expected GET-only Stage C matrix:

```text
GET /api/paypal/checkout            -> 503 CHECKOUT_PAUSED
GET /api/paypal/capture             -> 503 PAYPAL_CAPTURE_SERVICE_NOT_CONFIGURED
GET /api/paypal/webhook             -> 503 PAYPAL_WEBHOOK_SERVICE_NOT_CONFIGURED
GET /api/order-status               -> 503 ORDER_STATUS_SERVICE_NOT_CONFIGURED
GET /api/invoice-download           -> 405 METHOD_NOT_ALLOWED
GET /api/internal/dashboard-invoice -> 405 METHOD_NOT_ALLOWED
```

The tracked `sitemap.xml` does exist on current `main`; an NXDOMAIN seen while opening it is a DNS-resolution problem, not proof that the sitemap file is missing.

## What to record after Phase 4 is green

Create a task branch + PR and record:

- exact timestamp/timezone;
- exact storefront `main` SHA;
- Production Worker version/deployment ID;
- Cloudflare zone ID;
- public authoritative nameservers;
- apex + `www` Custom Domain state;
- all storefront/static probe results;
- redirect result;
- HTTPS result;
- public mail/service DNS verification;
- API fail-closed matrix;
- checkout-paused proof.

Never record secret values.

Only after this evidence is green should the **Cloudflare hosting migration** be called complete.

## Next main phase after hosting is proven stable

The next main phase is **PayPal Live**, and it requires separate exact owner authorization.

Sequence:

1. configure PayPal Production credentials only in Cloudflare secret storage;
2. configure the PayPal Production webhook to the Cloudflare Production endpoint;
3. prove create-order -> PayPal -> capture -> webhook -> Neon order-state flow;
4. perform one small real self-payment;
5. verify amount, PayPal order/capture, webhook verification, Neon paid state and idempotency;
6. only after all evidence is green, request separate owner approval to open customer checkout.

Resend/order-email activation and V3/R2 invoice-storage activation remain separate later phases.

Netlify decommission is **last**, after Cloudflare hosting and the required payment flow are proven stable and only with separate explicit approval.

## Non-negotiable boundaries

Without a new exact authorization, do not:

- change GoDaddy nameservers again;
- change DNS records simply to chase propagation;
- delete or redesign the eight mail/service records;
- deploy/reconfigure the Production Worker;
- enable PayPal Live;
- open customer checkout;
- enable Production order-email sending;
- activate V3 Profile 1, invoice reconciliation, invoice storage or dashboard invoice API;
- write Production R2 objects;
- mutate Production Neon data;
- decommission Netlify;
- touch Technisch Bouwadvies;
- modify the LegendMural dashboard hosting/design.

## Canonical supporting documents

Read in this order when continuing the migration:

1. `docs/READ_ME_FIRST.md`
2. **this file** — `docs/CLOUDFLARE_MIGRATION_HANDOFF_20260911.md`
3. `docs/CLOUDFLARE_PRODUCTION_CUTOVER_PLAN_20260911.md`
4. `docs/CLOUDFLARE_GATE0_READONLY_PREFLIGHT_PROOF_20260911.md`
5. `docs/CLOUDFLARE_CUTOVER_AND_ROLLBACK_CHECKLIST.md`
6. `docs/NETLIFY_DNS_ZONE_EXPORT_PROOF_20260911.md`
7. `docs/CLOUDFLARE_STAGE_C_ZERO_SECRET_DECISION_20260910.md`

The older `docs/CLOUDFLARE_MIGRATION_HANDOFF_20260909.md` is historical and no longer the continuation authority once this file is merged.

## Next-chat instruction

A new Cloudflare migration chat should **not reconstruct progress from old chat history**. It should read `docs/READ_ME_FIRST.md`, then this file, fresh-check `main`, and continue with the exact Phase 4 verification step above.
