# Cloudflare Resend readiness — 15 September 2026

## Purpose

Prepare the existing LegendMural Resend notification path for Cloudflare Production without enabling customer email delivery yet.

## Repository contract

Production non-secret bindings are pinned to:

- `RESEND_FROM=LegendMural <orders@mail.legendmural.com>`
- `RESEND_REPLY_TO=info@legendmural.com`
- `ORDER_NOTIFICATION_TO=info@legendmural.com`
- `ORDER_EMAILS_ENABLED=false`

`RESEND_API_KEY` must remain a Cloudflare Secret and must never be committed to GitHub.

## Current external facts

- Resend sending domain `mail.legendmural.com` is verified.
- Sending is enabled for that domain.
- Cloudflare Production did not contain a `RESEND_API_KEY` secret at the read-only inventory performed on 15 September 2026.

## Verification path

After this configuration is merged and only after explicit owner approval for the exact Production change:

1. create or select a Resend sending-only key restricted to `mail.legendmural.com`;
2. store it directly as Cloudflare Production secret `RESEND_API_KEY` without exposing the value in GitHub or chat;
3. deploy the exact approved storefront `main` commit while `ORDER_EMAILS_ENABLED=false` remains unchanged;
4. run the manual `Cloudflare Production Resend readiness` workflow with confirmation phrase `VERIFY_RESEND_READINESS_READ_ONLY`;
5. require it to prove the exact non-secret bindings and only the presence of the `RESEND_API_KEY` secret name;
6. do not send a real email until a separate explicit owner approval is given for the controlled email test.

No checkout enablement, PayPal mutation, DNS mutation, email send, V3 activation, R2 write or Netlify change is authorized by this document.
