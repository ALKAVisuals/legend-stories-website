# LegendMural Cloudflare Phase 4 post-cutover proof

**Evidence checkpoint:** 2026-09-11T15:37:00+02:00  
**Repository:** `ALKAVisuals/legend-stories-website`  
**Starting `main`:** `d4221dd8d38327e71e2c6f9e5b8aeac2cf845aca`  
**Scope:** read-only post-cutover verification only; no Production mutation was performed while collecting this evidence.

## Production target

```text
Worker: legendmural-cloudflare-production
Known/current cutover Worker version: 5d05b26d-4179-4ab0-a7b3-35cb990de854
workers.dev: disabled
preview_urls: disabled
Cloudflare zone: legendmural.com
Cloudflare zone ID: a23d780ad02e39b33dfd5877e389b7f1
Production R2: legendmural-v3-invoice-pdfs-prod
Authoritative nameservers:
- crystal.ns.cloudflare.com
- dean.ns.cloudflare.com
Custom Domains:
- legendmural.com
- www.legendmural.com
```

No Production Worker deploy/config mutation occurred during the DNS/custom-domain cutover. The visible Worker version in Cloudflare remained the same known Production bootstrap version.

## DNS / delegation verification

Cloudflare dashboard state was reviewed after the cutover and showed:

- DNS Setup: **Full**;
- exactly 10 DNS records in the zone;
- the frozen eight mail/service records;
- `legendmural.com` -> Worker `legendmural-cloudflare-production`, proxied;
- `www.legendmural.com` -> Worker `legendmural-cloudflare-production`, proxied;
- no old Netlify apex/www hosting records remained in the active Cloudflare zone.

Google Public DNS was used as an external resolver after propagation:

```text
legendmural.com NS
- crystal.ns.cloudflare.com
- dean.ns.cloudflare.com
Status: NOERROR
Observed NS TTL: 21600
```

The apex also resolved publicly through Cloudflare:

```text
legendmural.com A
- 172.67.128.53
- 104.21.0.189
Status: NOERROR
Observed A TTL: 300
```

The earlier intermittent browser `DNS_PROBE_FINISHED_NXDOMAIN` condition disappeared as propagation/caches converged. No corrective DNS mutation was required.

## Preserved mail/service DNS — public proof 8/8

All eight frozen records were queried through Google Public DNS and matched the migration contract exactly:

1. `legendmural.com` MX -> priority `0`, `legendmural-com.mail.protection.outlook.com`, TTL `3600` — PASS.
2. `send.mail.legendmural.com` MX -> priority `10`, `feedback-smtp.eu-west-1.amazonses.com`, TTL `3600` — PASS.
3. `send.mail.legendmural.com` TXT -> `v=spf1 include:amazonses.com ~all`, TTL `3600` — PASS.
4. `_dmarc.legendmural.com` TXT -> `v=DMARC1; p=none;`, TTL `3600` — PASS.
5. `legendmural.com` TXT -> `v=spf1 include:secureserver.net -all`, TTL `3600` — PASS.
6. `autodiscover.legendmural.com` CNAME -> `autodiscover.outlook.com`, TTL `3600` — PASS.
7. `email.legendmural.com` CNAME -> `email.secureserver.net`, TTL `3600` — PASS.
8. `resend._domainkey.mail.legendmural.com` TXT -> the exact captured public Resend DKIM key, TTL `3600` — PASS.

No mail policy was redesigned during the migration. Ordinary mailbox routing remains external to Netlify/Cloudflare hosting; Cloudflare is authoritative DNS only. Production order-email sending remains intentionally disabled.

## Storefront / static delivery proof

The owner manually verified the live Cloudflare-hosted storefront in a normal browser after propagation:

- `https://legendmural.com/` — storefront reachable after cutover.
- `https://legendmural.com/shop.html` — rendered with normal styling and product assets.
- `https://legendmural.com/robots.txt` — reachable and returned the tracked robots contract.
- `https://legendmural.com/sitemap.xml` — reachable and rendered valid XML containing the LegendMural page inventory.
- `https://legendmural.com/combat-grind-cycle.html` — representative product page rendered successfully with styling, product information and the representative product image.
- The representative product image/static asset on that page loaded successfully.

The sitemap browser message stating that the XML has no style information is normal XML rendering and is not an error.

## Canonical host / HTTPS proof

Both Worker Custom Domains are attached to the same Production Worker.

The owner opened a `www.legendmural.com` URL and observed the browser canonicalize to the apex `legendmural.com`, preserving the requested path. The tracked Production Worker implementation returns HTTP `301` for `www.legendmural.com` and rewrites only the host/protocol while preserving path/query.

Both apex and `www` were used through `https://` without browser certificate warnings during live verification. Cloudflare manages the certificates for the Worker Custom Domains.

## Fail-closed API proof

Unknown API routing remained hardened:

```text
GET /api/does-not-exist
-> API_ROUTE_NOT_FOUND
```

The complete expected Stage C GET-only matrix was manually verified through the live apex domain:

```text
GET /api/paypal/checkout
-> 503 CHECKOUT_PAUSED

GET /api/paypal/capture
-> PAYPAL_CAPTURE_SERVICE_NOT_CONFIGURED

GET /api/paypal/webhook
-> PAYPAL_WEBHOOK_SERVICE_NOT_CONFIGURED

GET /api/order-status
-> ORDER_STATUS_SERVICE_NOT_CONFIGURED

GET /api/invoice-download
-> METHOD_NOT_ALLOWED / Only POST is allowed.

GET /api/internal/dashboard-invoice
-> METHOD_NOT_ALLOWED / Only POST is allowed.
```

This proves that the hosting/routing cutover did not accidentally activate PayPal Live, customer checkout or the protected V3 invoice API.

## Checkout response-header proof

Chrome DevTools Network inspection of the live `GET /api/paypal/checkout` request showed:

```text
Status: 503 Service Unavailable
Cache-Control: no-store
Content-Security-Policy: default-src 'none'; frame-ancestors 'none'
Content-Type: application/json; charset=utf-8
Referrer-Policy: no-referrer
Retry-After: 300
Server: cloudflare
X-Content-Type-Options: nosniff
```

No permissive `Access-Control-Allow-Origin: *` response header was visible on this fail-closed browser navigation. The endpoint remained non-cacheable and hardened after the cutover.

## Phase 4 conclusion

The post-cutover evidence is green for the hosting migration:

- Cloudflare authoritative delegation: PASS.
- Zone + Worker Custom Domains: PASS.
- Storefront/static delivery: PASS.
- robots.txt + sitemap.xml: PASS.
- representative product page + asset: PASS.
- apex/`www` HTTPS use: PASS.
- canonical `www` -> apex behavior: PASS.
- preserved public mail/service DNS: **8/8 PASS**.
- unknown API hardening: PASS.
- Stage C known API fail-closed matrix: **6/6 PASS**.
- checkout remains paused: PASS.
- no-store/security response headers: PASS.

Therefore the **Cloudflare hosting/DNS migration is considered complete** at this checkpoint. This conclusion applies only to hosting/DNS and the fail-closed Stage C runtime. It does not mean LegendMural customer commerce is live.

## Safety state after hosting completion

The following remain intentionally OFF and are not authorized by this proof:

```text
LEGENDMURAL_CHECKOUT_PAUSED=true
PAYPAL_ALLOW_LIVE=false
ORDER_EMAILS_ENABLED=false
V3_PROFILE1_ORDER_CREATION_ENABLED=false
V3_INVOICE_RECONCILIATION_ENABLED=false
V3_INVOICE_STORAGE_ENABLED=false
V3_DASHBOARD_INVOICE_API_ENABLED=false
```

Do not add Production PayPal/Resend/Neon application secrets merely because hosting is now complete.

## Exact next main phase

The next main phase is **PayPal Live**, but it requires a separate explicit owner authorization before any Production credential, webhook or checkout mutation.

Sequence after that separate approval:

1. configure PayPal Production credentials only in Cloudflare secret storage;
2. configure the PayPal Production webhook to the Cloudflare Production endpoint;
3. prove create-order -> approval -> capture -> webhook -> Neon/order-state flow;
4. perform one small real self-payment;
5. verify amount, PayPal order/capture, webhook verification, Neon paid state and idempotency;
6. request separate explicit owner approval before opening customer checkout.

Resend/order-email activation and V3/R2 invoice-storage activation remain later, separate phases. Netlify decommission remains last and also requires separate explicit approval.

## Mutation record

Evidence collection and this documentation update performed **no** Cloudflare, GoDaddy, DNS, Worker, PayPal, Resend, Neon, R2, Netlify, dashboard or Technisch Bouwadvies Production mutation.
