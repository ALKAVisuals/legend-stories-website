# LegendMural — Netlify DNS zone export proof

**Date:** 2026-09-11  
**Scope:** complete account-level DNS record export for `legendmural.com` before any Cloudflare nameserver/domain cutover  
**Source:** Netlify DNS UI CSV export supplied by the owner  
**Source filename:** `legendmural.com (DNS Records).csv`  
**Source SHA-256:** `1681495c3e2a0adf932a20c2f4af7d3dc40bcbfde13cf9ad9f130fa45c75e493`  
**Source byte length:** `918`  
**Mutation performed:** none

## Result

The Netlify account-level export contains exactly **10 DNS records**. This closes the prior gap where public DNS/CT checks could not enumerate the full managed zone.

All exported records use TTL `3600`.

| # | Name | Type | Value / target | Cutover handling |
|---|---|---|---|---|
| 1 | `legendmural.com` | `NETLIFY` | `legendmural.netlify.app` | Netlify hosting record; replaced only during an explicitly approved Cloudflare cutover. |
| 2 | `www.legendmural.com` | `NETLIFY` | `legendmural.netlify.app` | Netlify hosting record; replaced only during an explicitly approved Cloudflare cutover. |
| 3 | `resend._domainkey.mail.legendmural.com` | `TXT` | `p=MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQDXDHlGTc8VvimOh+Hq90jW6Ur6xmT0YEtjtXdNrehBMq+COeZS/2YbiAQu8TbszeQYr9HU8VWp6LuFx1Z/kEAgVlGx/YdxBtlUHb7tzCf0uz1rXqhxcS87gvND4KmfplQtvI2cLcA9aM/tY3k3DYHg/XGRw0lm/qj1kLcvYUUekwIDAQAB` | Preserve exactly; public DKIM key, not an application secret. |
| 4 | `send.mail.legendmural.com` | `MX` | `feedback-smtp.eu-west-1.amazonses.com` | Preserve with priority `10`; authoritative AWS SES custom-MAIL-FROM documentation defines this exact `feedback-smtp.<region>.amazonses.com` pattern as priority `10`. |
| 5 | `send.mail.legendmural.com` | `TXT` | `v=spf1 include:amazonses.com ~all` | Preserve exactly. |
| 6 | `_dmarc.legendmural.com` | `TXT` | `v=DMARC1; p=none;` | Preserve exactly. |
| 7 | `legendmural.com` | `TXT` | `v=spf1 include:secureserver.net -all` | Preserve exactly. |
| 8 | `autodiscover.legendmural.com` | `CNAME` | `autodiscover.outlook.com` | Preserve exactly. |
| 9 | `email.legendmural.com` | `CNAME` | `email.secureserver.net` | Preserve exactly. |
| 10 | `legendmural.com` | `MX` | `legendmural-com.mail.protection.outlook.com` | Preserve with priority `0`; public DNS proof already captured apex priority `0`. |

## Important correction to the public-only inventory

The earlier public inventory queried common Resend candidate names such as `resend._domainkey.legendmural.com` and `send.legendmural.com`. Those names were absent publicly, which was correctly recorded at the time.

The account export proves that the actual email-service records are instead one label deeper under `mail.legendmural.com`:

- `resend._domainkey.mail.legendmural.com`;
- `send.mail.legendmural.com` MX;
- `send.mail.legendmural.com` SPF TXT.

Therefore Resend/Amazon SES-related DNS is present and must be preserved during any DNS-hosting migration. The earlier public proof was not wrong; it was incomplete because DNS names are not enumerable from public DNS.

## Migration classification

### Hosting records to replace only during approved cutover

1. apex `NETLIFY` -> `legendmural.netlify.app`;
2. `www` `NETLIFY` -> `legendmural.netlify.app`.

### Mail/service records to preserve

The other eight exported records must be reproduced unchanged in the destination DNS zone before any nameserver switch. Do **not** combine the Cloudflare hosting migration with email-policy cleanup or provider migration.

## MX-priority verification

The supplied Netlify CSV schema contains only `name`, `ttl`, `type`, and `value`; it does not carry a separate MX-priority column.

The two required preferences are nevertheless now known without modifying DNS:

- apex `legendmural-com.mail.protection.outlook.com` -> priority `0`, captured by the earlier public DNS proof;
- `send.mail.legendmural.com` -> `feedback-smtp.eu-west-1.amazonses.com` with priority `10`, confirmed from Amazon SES's authoritative Custom MAIL FROM documentation. AWS specifies the format `10 feedback-smtp.<region>.amazonses.com` and states that `10` is the MX preference value to enter separately when the DNS provider has a priority field.

Authoritative provider reference: `https://docs.aws.amazon.com/ses/latest/dg/mail-from.html`.

## Section C conclusion

The **complete Netlify-managed record list and required MX priorities are now captured**. The DNS-inventory blocker is closed.

The remaining pre-cutover blocker is a **working, independently verified rollback serving target**. The currently published Netlify Production deploy cannot satisfy that requirement because its immutable deploy URL returns HTTP 404 on all previously tested storefront/static paths.

No DNS record, nameserver, Netlify domain attachment, Netlify deploy, Cloudflare route/custom domain, Production Worker, secret, PayPal, Resend, Neon or R2 state was changed while producing this proof.
