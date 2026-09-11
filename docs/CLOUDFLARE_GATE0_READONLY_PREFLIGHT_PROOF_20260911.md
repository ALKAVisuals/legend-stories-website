# LegendMural — Cloudflare Gate 0 read-only preflight proof

**Date:** 2026-09-11  
**Repository:** `ALKAVisuals/legend-stories-website`  
**PR:** #245  
**Proofed PR head:** `23d08fbb7550f71f662f1e2a408ebaeab7871848`  
**Workflow:** `Cloudflare Production read-only inventory`  
**Run ID:** `34595472854`  
**Inventory job ID:** `103250140985`

## Scope

This proof is intentionally read-only. The workflow uses authenticated Cloudflare API **GET** requests plus public DNS-over-HTTPS **GET** requests only. It performs no zone creation, DNS mutation, nameserver change, Worker deployment, Custom Domain creation, secret write, R2 object write, PayPal change, Netlify change or Neon mutation.

The policy test passed before account access and explicitly rejects POST, PUT, PATCH, DELETE, Wrangler deploy, R2 bucket creation and secret writes.

## Gate 0 result

### Current public DNS delegation / DNSSEC

```text
Authoritative NS:
- dns1.p01.nsone.net
- dns2.p01.nsone.net
- dns3.p01.nsone.net
- dns4.p01.nsone.net

DS records present at public resolver: false
DS record count: 0
```

This reconfirms the current Netlify/NS1-backed delegation and proves that no DS record is presently published for `legendmural.com`. There is therefore no existing registrar-level DS record that must be removed before the future nameserver switch. DNSSEC can be enabled separately in Cloudflare only after the new zone is stable, if desired and explicitly approved.

### Cloudflare zone

```text
Zone: legendmural.com
Exists in intended Cloudflare account: false
Status: not applicable
Paused: not applicable
Assigned Cloudflare nameservers: none
```

This proves that `legendmural.com` has **not yet been onboarded as a Cloudflare zone** in the intended account. Therefore the first approved Production write in the cutover must be to create/add the `legendmural.com` full-setup zone. The eight frozen mail/service records must then be recreated in Cloudflare before authoritative nameserver delegation changes.

### Production Worker

```text
Worker: legendmural-cloudflare-production
Exists: true
Fail-closed flags proven: true
Application secret names present: none
Worker Custom Domains: none
R2 binding: V3_INVOICE_PDFS -> legendmural-v3-invoice-pdfs-prod
```

Remote observed fail-closed values:

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

The Production Worker remains suitable for hosting-only Stage C and is not currently attached to any custom hostname.

### Production R2

```text
Bucket: legendmural-v3-invoice-pdfs-prod
Exists: true
r2.dev public access: false
Enabled custom domains: none
Public exposure detected: false
```

Production R2 remains private.

## Interpretation for the cutover

The read-only preflight resolves the previously open Gate 0 questions:

1. public authoritative DNS is still the captured Netlify/NS1 set;
2. no public DS record is present;
3. `legendmural.com` is **absent** from the intended Cloudflare account;
4. the Production Worker already exists and remains fail-closed;
5. there are no Production Worker Custom Domains yet;
6. no Stage C application secrets are present;
7. Production R2 remains private.

The next Production mutation bundle, which still requires explicit owner approval before execution, is therefore:

1. add/create `legendmural.com` as a Cloudflare full-setup zone;
2. record the Cloudflare-assigned authoritative nameservers;
3. recreate the frozen eight mail/service records exactly;
4. verify those records in Cloudflare account state;
5. change authoritative nameservers to Cloudflare only after the DNS contract is complete;
6. wait for the zone to become Active;
7. attach `legendmural.com` and `www.legendmural.com` to `legendmural-cloudflare-production` as Worker Custom Domains;
8. run the non-mutating post-cutover verification matrix.

PayPal Live, checkout opening, Resend activation, V3 activation, Production R2 writes and Neon Production mutation are explicitly outside this authorization boundary.

## Safety conclusion

Gate 0 passed. No Production state was changed. The exact first provider write required for the migration is now known: **Cloudflare zone creation/onboarding for `legendmural.com`**, followed by DNS preservation before any nameserver switch.
