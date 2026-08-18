# LegendMural transactional email readiness

Last reviewed: 18 August 2026.

Status: **provider selected, production sending disabled**.

## Provider decision

LegendMural will use **Resend (Plus Five Five, Inc.)** for the statutory withdrawal acknowledgement flow already wired into the server runtime.

The current runtime creates the Resend notifier only when both server-side environment values are present:

- `RESEND_API_KEY`
- `RESEND_FROM`

If either value is absent, no Resend notifier is created. This is intentional and must remain the default until the production email gate is explicitly completed.

## Why Resend is retained

The repository already contains a tested provider adapter and failure-isolation contract for Resend. Replacing the provider now would add launch risk without solving a current product requirement.

Current Resend documentation states that:

- a domain must be verified before sending to arbitrary recipients;
- SPF and DKIM records are used for domain verification;
- Resend recommends using a sending subdomain to isolate sending reputation;
- after a domain is verified, mail can be sent from addresses on that verified domain;
- Resend's primary processing operations and customer-data storage are in the United States;
- Resend's Data Processing Addendum incorporates EU Standard Contractual Clauses for applicable EEA-to-US transfers;
- Resend publishes a current subprocessor list.

The production privacy notice identifies Resend and the transfer position before any production customer data is sent through it.

## Data sent for a withdrawal acknowledgement

The current adapter sends only the message content needed for the statutory acknowledgement:

- customer-provided confirmation email address;
- consumer name;
- Order ID;
- withdrawal declaration;
- confirmation code;
- server-side received timestamp.

No full PayPal webhook payload, payment credential, card/bank credential or arbitrary support free text is added to the message.

## Production activation checklist

Production sending remains **NO-GO** until all of the following are completed and recorded:

1. Choose the exact LegendMural sending domain or subdomain.
2. Add that domain in the Resend account.
3. Add the exact DNS records supplied by Resend and obtain verified status.
4. Approve the exact production `from` identity.
5. Approve a reply/customer-operations address that is actually monitored.
6. Review/accept the current Resend DPA and current subprocessor list for the production account.
7. Create a production API key with only the permissions required for sending.
8. Store the API key only as a Netlify production server-side secret; never commit it.
9. Set `RESEND_FROM` only after the verified domain exactly matches the domain used by the from address.
10. Run a controlled non-production withdrawal acknowledgement to an owned test address.
11. Verify the received message contains the consumer name, Order ID, confirmation address, declaration, confirmation code and receipt date/time.
12. Prove a simulated provider failure does not erase or reverse the durable withdrawal record.
13. Document how operations detects delivery failure and resends an acknowledgement without exposing secrets or customer message payloads in logs.
14. Only after the above checks pass may production `RESEND_API_KEY` and `RESEND_FROM` be intentionally configured.

## Explicit non-actions

This readiness decision does **not**:

- create or expose an API key;
- add DNS records;
- verify a domain in Resend;
- choose an unconfirmed customer-facing mailbox;
- change Netlify production environment variables;
- send a production email;
- activate PayPal Live;
- apply Neon production migrations.

## Provider references reviewed

Primary Resend sources reviewed on 18 August 2026:

- Resend documentation: Managing Domains / domain verification.
- Resend documentation: sender/from-address behaviour after domain verification.
- Resend GDPR information: US data storage and SCC transfer basis.
- Resend Data Processing Addendum.
- Resend published subprocessor list.
