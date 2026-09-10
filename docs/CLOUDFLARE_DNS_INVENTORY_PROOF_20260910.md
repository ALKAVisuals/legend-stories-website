# LegendMural — Section C public DNS inventory proof

**Date:** 2026-09-10  
**Scope:** public read-only pre-cutover DNS / HTTPS inventory for `legendmural.com`  
**Repository:** `ALKAVisuals/legend-stories-website`  
**Workflow:** `Cloudflare DNS read-only inventory`  
**Run number:** 6  
**Run ID:** `34486539162`  
**Head SHA:** `8a285a7ab3edcb06386610a0b686eb7335cdf0a2`  
**Observed at:** `2026-09-10T14:04:01.209Z`  
**Result:** success

## Safety boundary

This proof used public GET-only observations. It used no Cloudflare or Netlify account credentials and performed no DNS, hosting, Worker, custom-domain, secret, PayPal, Resend, Neon or R2 mutation.

```text
mutationPerformed: false
credentialsUsed: false
```

## Authoritative DNS

The public authoritative nameservers are:

```text
dns1.p01.nsone.net.  TTL 3600
dns2.p01.nsone.net.  TTL 3600
dns3.p01.nsone.net.  TTL 3600
dns4.p01.nsone.net.  TTL 3600
```

SOA:

```text
dns1.p01.nsone.net. domains+netlify.netlify.com. 1787043048 43200 7200 1209600 3600
```

This is public evidence that the zone is currently served through Netlify/NS1-backed authoritative DNS.

## Apex and www

At the exact observation time:

```text
legendmural.com CNAME: none
legendmural.com A: 52.52.192.191  TTL 120
legendmural.com A: 13.52.188.95  TTL 120
legendmural.com AAAA: none

www.legendmural.com CNAME: none
www.legendmural.com A: 52.52.192.191  TTL 120
www.legendmural.com A: 13.52.188.95  TTL 120
www.legendmural.com AAAA: none
```

The A answers are provider-controlled and may rotate; the proof records the exact values seen by this run rather than treating those IPs as permanent migration targets.

Public DNS proves that no apex CNAME answer is exposed. It cannot by itself prove the provider's internal flattening configuration.

## Mail / SPF / DMARC

MX:

```text
0 legendmural-com.mail.protection.outlook.com.  TTL 3600
```

Apex SPF TXT:

```text
v=spf1 include:secureserver.net -all  TTL 3600
```

DMARC:

```text
_dmarc.legendmural.com TXT: v=DMARC1; p=none;  TTL 3600
```

These records are migration-critical and must be preserved exactly unless a separate mail/DNS change is explicitly approved.

## DKIM candidates

Because DKIM selectors cannot be enumerated from public DNS, the proof queried the relevant known candidates for the currently observed Microsoft 365 mail path plus the planned Resend path.

```text
selector1._domainkey.legendmural.com CNAME/TXT: NXDOMAIN
selector2._domainkey.legendmural.com CNAME/TXT: NXDOMAIN
resend._domainkey.legendmural.com CNAME/TXT: NXDOMAIN
```

This proves those candidate selectors were absent at the observation time. It does **not** prove that no other non-enumerable DKIM selector exists in the Netlify zone; the later account-level zone inventory must close that gap.

## Resend candidate records

```text
send.legendmural.com MX: NXDOMAIN
send.legendmural.com TXT: NXDOMAIN
send.legendmural.com CNAME: NXDOMAIN
resend._domainkey.legendmural.com TXT/CNAME: NXDOMAIN
```

No public Resend verification record was found at the standard candidate names queried. Resend Production activation remains outside Stage C and is not authorized by this proof.

## Public subdomain discovery

Both independent certificate-transparency sources succeeded:

```text
crt.sh: HTTP 200
Cert Spotter: HTTP 200
```

Combined names discovered:

```text
legendmural.com
www.legendmural.com
```

No additional publicly certificated LegendMural subdomain was discovered by either source in this run.

Certificate transparency cannot enumerate every DNS record or private/non-TLS subdomain. Full zone truth still requires read-only account-level Netlify DNS inventory.

## Public HTTPS / current-host evidence

At the exact observation time:

```text
https://legendmural.com/      -> HTTP 404, server: Netlify, x-nf-request-id present
https://www.legendmural.com/  -> HTTP 404, server: Netlify, x-nf-request-id present
```

For both origins:

```text
publicNetlifyServingEvidence: true
publicCloudflareServingEvidence: false
```

This proves public requests are currently reaching Netlify rather than the Cloudflare Production Worker.

The HTTP 404 is a **pre-existing observed state**. This inventory did not cause it. Public evidence alone does not prove why Netlify returns 404; the exact internal site/domain attachment must be checked read-only in the Netlify account before a cutover plan is approved.

## Section C result

### Public portion — PASSED

Proven from public DNS/HTTPS:

- authoritative nameservers and SOA;
- apex CNAME/A/AAAA response state;
- `www` CNAME/A/AAAA response state;
- MX;
- apex SPF TXT;
- DMARC;
- relevant Microsoft 365 and Resend DKIM candidate lookups;
- standard Resend verification candidate lookups;
- current observed TTLs;
- two-source public certificate-transparency discovery;
- current public hosting evidence points to Netlify, not Cloudflare.

### Still open — account-level read-only proof

Before any DNS/nameserver/custom-domain mutation, inspect the authorized Netlify account read-only and record:

1. the complete `legendmural.com` DNS zone record list, including records that public discovery cannot enumerate;
2. the exact Netlify site currently holding `legendmural.com` and `www.legendmural.com`, if any;
3. the current Netlify default site URL / rollback URL;
4. the reason visible from account configuration, if determinable read-only, for the currently observed apex and `www` HTTP 404;
5. confirmation that no unrelated domain or Technisch Bouwadvies configuration is part of this zone/cutover.

Do not change any Netlify domain attachment or DNS record while gathering that account-level proof.

## Cutover implication

Because Netlify/NS1-backed nameservers are authoritative today, the later Cloudflare migration may involve a **nameserver-level DNS-hosting transition**, not merely changing one public A/CNAME record. Therefore the complete Netlify zone must be captured and all mail/verification records accounted for before any final routing plan or owner approval for cutover.

No DNS or Production cutover is authorized by this document.
