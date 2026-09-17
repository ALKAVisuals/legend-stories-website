# Production checkout handoff

Last verified: 2026-09-17
Repository: `ALKAVisuals/legend-stories-website`

## Goal
Bring the Cloudflare Production checkout fully live with:
- PayPal Live payment
- Neon order persistence
- customer order confirmation
- internal order notification
- contact form
- invoice number + immutable invoice snapshot + PDF + private R2 storage + invoice email

The owner asked to defer legal/compliance work for now. This does not mean that legal/compliance is complete.

## Code baseline
The application code baseline before this documentation-only handoff commit is:
`dbab20d7563e769f1bf09a5bb6c5da10e36e17da`

That commit is the merge of PR #271, `Enable live checkout order flow`.

## Current state
PR #271 is merged.

The source configuration is prepared for standard live checkout:
- `CHECKOUT_FORCE_PAUSED=false`
- `PAYPAL_ENV=live`
- `ORDER_EMAILS_ENABLED=true`
- `CONTACT_FORM_ENABLED=true`
- PayPal create/capture is the normal payment path.
- Neon Production is the authoritative order store.
- customer accounts remain disabled.
- customer-facing chat remains disabled.
- P3 and V3 activation flags remain disabled.

No Production deploy or real payment was performed as part of this work. The previously deployed Production worker is therefore expected to remain unchanged until an explicitly approved deploy.

## Completed in code
- PayPal create/capture flow prepared for Live.
- Successful order creation returns persisted `orderNumber`.
- Capture finalization carries captured amount, currency, provider, payer email and capture timestamp.
- Neon is authoritative order storage; there is no local Production fallback.
- Customer order confirmation and internal order notification path enabled.
- Contact endpoint enabled independently from customer chat.
- Guarded Production workflow updated for active standard checkout launch.
- Production verifier expects checkout active, PayPal Live, Neon order store, order email and contact form enabled.

## Invoice blocker
`cloudflare/v3-paid-finalization-config.mjs` is fail-closed and is currently not ready for activation:
- invoice year is `2025`; validation requires the current UTC year (`2026`)
- sample number is still `LS2025-0001`
- `seller.addressLine1` is empty and required
- final validation also requires `PAYPAL_MERCHANT_ID` in the runtime environment

Known seller data currently in config:
- legal name: `ALKA Projects B.V.`
- trade name: `Legends Art`
- postal code: `9408GH`
- city: `Assen`
- country: `NL`
- KvK: `01102137`
- VAT ID: `NL819184217B01`
- VAT rate: `900` bps
- sequence code: `PROFILE1-NL-LEGENDS`
- prefix: `LS`
- padding: `4`

Do not invent the seller street address or merchant ID.
Before changing the invoice year/sequence, inspect the existing invoice sequence, migrations and persisted state so no duplicate invoice numbers can be produced.

## Exact next steps
1. Inspect the V3 paid-finalization runtime, migrations and tests. Confirm the exact path from successful PayPal capture to invoice finalization.
2. Verify/obtain the seller street address. Do not guess it.
3. Inspect invoice-sequence persistence/database state and decide the correct 2026 sequence baseline without duplicate invoice numbers.
4. Update `cloudflare/v3-paid-finalization-config.mjs` (year/sample/address) and matching tests/config.
5. Verify that `PAYPAL_MERCHANT_ID` exists in Cloudflare Production using read-only/preflight tooling. Never print secret values.
6. Wire/enable invoice finalization only after idempotency is proven:
   - invoice number assigned exactly once
   - immutable invoice snapshot persisted
   - PDF generated exactly once or safely retried
   - PDF stored in private `legend-stories-invoices` R2 bucket
   - invoice email sent once
   - capture replay/retry cannot create a duplicate invoice or duplicate email
7. Run all relevant invoice/V3 tests plus the standard checkout test suite and full CI.
8. Re-run the guarded Production preflight against the exact approved `main` SHA.
9. Ask the owner for fresh explicit Production deploy approval.
10. Only after explicit approval, invoke `.github/workflows/cloudflare-production-guarded-update.yml` with:
    - confirmation phrase `DEPLOY_LIVE_CHECKOUT_PAYPAL_NEON_EMAILS`
    - exact approved 40-character `main` commit SHA
11. After deploy, verify `/api/config` returns HTTP 200 and contains:
    - `"checkoutAvailable":true`
    - `"launchMode":"standard"`
    - `"paymentMethod":"paypal"`
    - `"customerAccounts":false`
12. Perform only an explicitly approved payment/order smoke test and verify order, mail, contact and invoice behavior end to end.

## Production deploy safety
Do not deploy Production or trigger the guarded Production workflow without fresh explicit owner approval.
The workflow performs a real Cloudflare Worker deploy after tests, preflight, PayPal validation and `wrangler --dry-run`.
Do not change DNS/custom domains.
Do not expose secret values.
Do not initiate a real payment merely as a smoke test unless explicitly approved.

## Current guarded deploy contract
`.github/workflows/cloudflare-production-guarded-update.yml` already targets the active standard-checkout launch state.

`scripts/verify-cloudflare-production-guarded-update.mjs` currently expects:
- checkout active
- PayPal Live
- Neon order store
- order emails enabled
- contact form enabled
- customer chat/accounts disabled
- P3 disabled
- V3 activation disabled
- invoice bucket binding to private `legend-stories-invoices`
- required secret names present

The deploy workflow is intentionally manual and commit-pinned.

## Definition of done
- live checkout accepts PayPal Live payment
- one completed capture creates/finalizes exactly one Neon order
- order status is retrievable
- customer confirmation sent exactly once
- internal order mail sent exactly once
- contact form works
- invoice number assigned exactly once
- immutable invoice snapshot persisted
- invoice PDF generated and stored privately
- invoice email sent exactly once
- retries/replays do not duplicate order/invoice/email
- postdeploy probe and full CI are green

## Key files
- `.github/workflows/cloudflare-production-guarded-update.yml`
- `scripts/verify-cloudflare-production-guarded-update.mjs`
- `cloudflare/v3-paid-finalization-config.mjs`

## Key history
- PR #269: guarded order-email preflight fix
- PR #271: live checkout order-flow preparation
- code baseline before this handoff commit: `dbab20d7563e769f1bf09a5bb6c5da10e36e17da`
