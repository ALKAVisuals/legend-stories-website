# LegendMural current production status

Updated: 25 August 2026

This document is the current operational handoff for the LegendMural production track. It complements `docs/PRODUCTION_GO_NO_GO_CHECKLIST.md`; it does not replace the formal release gates.

## Current reviewed baseline

- Repository: `ALKAVisuals/legend-stories-website`
- Production host: Netlify
- Public origin: `https://legendmural.com`
- Payment provider for launch: PayPal Live
- Database: Neon Postgres
- Current `main` includes PRs #118 through #127 described below.

## Completed since the earlier production checklist review

- PR #118 — Netlify Resend secret-scan false-positive handling for `RESEND_REPLY_TO` without disabling secret scanning globally.
- PR #120 — checkout address validation hard timeout/fallback so checkout cannot hang indefinitely.
- PR #121 — browser regression coverage for the address-validation timeout and late callback handling.
- PR #122 — safe PayPal bootstrap diagnostics without logging secrets or customer payloads.
- PayPal Live production configuration has been activated by the owner: official Live API base, Live client credentials, Live webhook identity and `PAYPAL_ALLOW_LIVE=true` in Production. The PayPal hosted checkout page has been reached successfully.
- Neon production checkout bootstrap has been proven far enough for PayPal Live checkout creation to proceed.
- PR #123 — checkout country dropdown contrast fix.
- PR #124 — premium post-payment success experience with truthful server-driven payment states.
- PR #125 — premium cancelled-payment experience; cart remains retained and no false paid claim is made.
- PR #126 — production-build readiness validation for the post-checkout pages.
- PR #127 — Netlify Forms integration for the homepage contact form, including honeypot protection and accessible submission feedback.

## Important payment truth boundary

LegendMural is **not yet declared fully selling-ready**.

The following still requires one controlled real PayPal Live order using a separate buyer payment method:

1. complete the real payment;
2. return to LegendMural successfully;
3. verify `capture-paypal-order` succeeds;
4. verify the Live PayPal webhook receives the completed capture and returns HTTP 200;
5. verify the Neon order becomes `paid`;
6. verify `/api/order-status` reflects `paid`;
7. verify the PayPal business account shows the money received;
8. only after those checks may fulfilment be treated as released.

A browser redirect to PayPal or a successful PayPal page load is not sufficient proof of a completed production transaction.

## Post-checkout UX status

- Success page redesign: complete in repository.
- Cancelled page redesign: complete in repository.
- Payment states remain server-authoritative; only verified `paid` receives the confirmed presentation.
- Production-build validation for these pages is green.
- A final human visual check on the currently deployed production pages is still recommended before the controlled Live order.

## Contact form and email status — intentionally deferred

### Netlify Forms

- Form detection was enabled by the owner in Netlify.
- PR #127 added a Netlify `contact` form definition, honeypot protection and frontend submit handling.
- The visible LegendMural contact identity is `info@legendmural.com`.
- A fresh production deploy and one real test submission are still required to prove the form appears in Netlify Forms and that submissions are stored correctly.

### `info@legendmural.com`

- This is the intended official LegendMural support/customer-operations address.
- A test message was sent to `info@legendmural.com` on 25 August 2026.
- No incoming copy was observed in the currently connected Gmail inbox.
- Therefore mailbox/forwarding/receiving capability is **not yet proven**.
- Do not treat `info@legendmural.com` as a verified receiving mailbox until a new test message is actually received.

### Resend / transactional mail

- Existing Resend code currently covers withdrawal acknowledgement delivery.
- A branded LegendMural order-confirmation email after a verified paid order is **not yet implemented**.
- The final production `RESEND_FROM` / `RESEND_REPLY_TO` values should not be considered revalidated for the new LegendMural mailbox identity until `info@legendmural.com` receiving works and the sending domain configuration is rechecked.
- Contact-form email notifications and the mailbox/Resend cleanup are intentionally postponed and may be resumed later from this section.

## Security boundaries that remain in force

- Never commit or share `PAYPAL_CLIENT_SECRET`, Neon database passwords/connection strings or Resend API keys.
- Do not log full environment objects or customer payloads.
- Do not globally disable Netlify secret scanning.
- Do not clear the cart or show a paid confirmation unless the server verifies the order as paid.
- Deploy Preview remains separate from Production; PayPal Preview should remain Sandbox-separated from Live Production.

## Next active production task

The email/contact mailbox work is intentionally paused.

The next active track is:

1. deploy the current `main` to Netlify if the latest merged commits are not yet Published;
2. perform a quick visual smoke check of `order-success.html` and `order-cancelled.html` on production;
3. perform one controlled real PayPal Live order;
4. verify capture, webhook, Neon `paid`, order status and PayPal receipt end-to-end;
5. update the formal go/no-go checklist and launch completion record only after that runtime evidence exists.

Do not mark LegendMural fully launch-ready before the controlled Live transaction is proven end-to-end.
