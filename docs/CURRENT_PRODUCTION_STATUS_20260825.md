# LegendMural current production status

Updated: 25 August 2026, late evening

This document is the current operational handoff for the LegendMural production track. It complements `docs/PRODUCTION_GO_NO_GO_CHECKLIST.md`; it does not replace the formal release gates.

## Current reviewed baseline

- Repository: `ALKAVisuals/legend-stories-website`
- Production host: Netlify
- Public origin: `https://legendmural.com`
- Payment provider for launch: PayPal Live
- Database: Neon Postgres
- Current `main`: `649deded0eaa53e5d10967397e16de3b11bbcd3b` (PR #132, documentation-only handoff update).
- Last runtime-code-changing baseline before that docs-only merge: `93cd30fae5208d2d853bd6dbe7116b69adadd3d0` (PR #131).
- GitHub Pages is being used only as a temporary visual/static preview before publishing newer work to Netlify Production.
- Latest reviewed GitHub Pages preview commit: `ff87f6e46ab7085e6185493c252c9e2cc82077d0`; its build and deploy both completed successfully.
- Workflow rule: do not publish newer website changes to Netlify Production until the owner has visually approved them in the GitHub Pages preview.

## Completed repository work

- PR #118 — Netlify Resend secret-scan false-positive handling for `RESEND_REPLY_TO` without disabling secret scanning globally.
- PR #120 — checkout address-validation hard timeout/fallback so the frontend cannot wait forever for the Google Places callback.
- PR #121 — browser regression coverage for address-validation timeout, single callback handling and ignored late callbacks.
- PR #122 — safe PayPal bootstrap diagnostics without logging secrets or customer payloads.
- PayPal Live production configuration was activated by the owner: official Live API base, Live client credentials, Live webhook identity and `PAYPAL_ALLOW_LIVE=true` in Production. The PayPal hosted checkout page has previously been reached successfully.
- Neon production checkout bootstrap has previously been proven far enough for PayPal Live checkout creation to proceed.
- PR #123 — checkout country-dropdown contrast fix.
- PR #124 — premium post-payment success experience with truthful server-driven payment states.
- PR #125 — premium cancelled-payment experience; cart remains retained and no false paid claim is made.
- PR #126 — production-build readiness validation for the post-checkout pages.
- PR #127 — Netlify Forms integration for the homepage contact form, including honeypot protection and accessible submission feedback.
- PR #128 — production-status handoff document.
- PR #129 — light-mode footer contrast hardening; dark mode deliberately unchanged.
- PR #130 — homepage contact email source updated directly to `info@legendmural.com`.
- PR #131 — obsolete runtime replacement of the legacy contact email removed; contract tests updated accordingly.
- PR #132 — this production handoff refreshed with the latest runtime observations and next-chat tasks; documentation only.

## GitHub Pages preview status

Preview URL:

`https://alkavisuals.github.io/legend-stories-website/`

The temporary GitHub Pages preview is working and visually reflects the newer repository state without publishing those changes to Netlify Production. Pages-specific URL rewriting exists only for the preview subpath and must not be treated as production routing. The preview workflow handles the fixed footer stylesheet and contact-form script paths correctly.

GitHub Pages is visual/static only. Do not validate PayPal Live, Neon or Netlify Functions through this preview.

The owner visually confirmed that the light-mode footer contrast now looks correct in the GitHub Pages preview.

## Contact identity status

Official LegendMural site email:

`info@legendmural.com`

The homepage source contains this address directly. The old `hello@legendstories.nl` fallback has been removed from the active contact flow.

This confirms website identity only. Mailbox receiving/forwarding for `info@legendmural.com` is still not proven.

## New requested website changes — not implemented yet

### 1. Missing social links

Add these supplied official links where appropriate in the LegendMural social area:

- YouTube: `https://youtube.com/@legendstories_official?si=UhNqTXzb6XWWHFFX`
- Facebook: `https://www.facebook.com/share/197TDKP6RC/?mibextid=wwXIfr`

Do not invent replacement handles or URLs for other social platforms.

### 2. About Us requires a complete rebuild

The current About Us/team section is rejected by the owner and must be rebuilt from the ground up rather than incrementally polished.

Problems identified:

- weak narrative around `The people` / `Three people. One wall at a time.`;
- placeholder-like emoji team portraits;
- overly casual/shallow role copy;
- no coherent story explaining why LegendMural exists, what it creates, what it stands for and who is behind it;
- presentation does not match the premium LegendMural brand.

The next session should first define the narrative architecture before writing/styling the final section. A likely structure is origin/idea -> mission -> product/quality/design philosophy -> people/team, but this should be deliberately designed rather than copied blindly.

### 3. Withdraw-a-purchase flow needs real end-to-end validation

The owner attempted to test the withdrawal form with fake order data. Fake data is not valid proof because the flow should identify a real order.

Later, with a controlled real order, verify:

1. a real paid order exists in the authoritative store;
2. correct Order ID + matching order email is accepted;
3. the withdrawal notice is durably recorded;
4. no unintended automatic refund occurs;
5. customer-facing success/error states are correct;
6. withdrawal acknowledgement email behavior is verified;
7. incorrect Order ID/email combinations are rejected safely.

Do not weaken order verification merely to make fake test data pass.

## CRITICAL REOPENED BLOCKER — checkout behavior observed on production

The earlier address-validation hang was fixed and regression-tested in repository code, but on 25 August 2026 the owner observed problematic behavior again on the currently served `legendmural.com` checkout using mobile Safari.

Observed behavior:

- after entering shipping details and pressing Continue to Payment, the button showed `VALIDATING ADDRESS...`;
- checkout appeared to remain in that state;
- it subsequently navigated to an unexpected/random sticker product page instead of a logical PayPal/checkout continuation;
- no successful order-confirmation page was shown;
- no order-confirmation email was received.

Treat this as an open production blocker until reproduced and explained.

Do **not** assume that PR #120/#121 failed. Possible causes include a runtime regression, navigation bug, stale Netlify production deployment, environment difference or another checkout path. First establish exactly which runtime-code commit is currently published on Netlify and reproduce the mobile production flow before changing code.

### Related mobile address-field UX defect

On mobile Safari, while typing the street, after entering the first characters (example: `sc` for Schansweg), the street field visually jumps/loses its stable typing state and a warning/validation icon appears. The user can click the field again and continue typing, but the interaction is not acceptable.

Investigate:

- whether the input actually loses focus;
- whether autocomplete/Google Places re-renders or moves the field;
- whether validation starts too early;
- whether validation/error UI changes layout while typing;
- whether this behavior contributes to the later checkout/navigation failure.

Desired result: stable mobile input with no unexpected focus/layout jump while typing.

## Payment truth boundary

LegendMural is **not fully selling-ready**.

A controlled real PayPal Live transaction is still required, but only after the reopened checkout/address blocker is resolved and the current production version is understood.

For the eventual controlled Live order verify:

1. checkout reaches PayPal Live correctly;
2. real payment completes;
3. return to LegendMural succeeds;
4. `capture-paypal-order` succeeds;
5. Live PayPal webhook receives `PAYMENT.CAPTURE.COMPLETED` and returns HTTP 200;
6. Neon order becomes `paid`;
7. `/api/order-status` reflects `paid`;
8. PayPal business account shows the money received;
9. only after those checks may the transaction be treated as technically confirmed.

A PayPal page opening by itself is not sufficient proof.

## Post-checkout UX status

- Success-page redesign exists in repository.
- Cancelled-page redesign exists in repository.
- Payment states remain server-authoritative; only verified `paid` receives the confirmed presentation.
- Production-build validation for these pages is green in repository checks.
- The owner did not reach the expected confirmation page during the newly observed checkout failure, so runtime navigation into the post-checkout flow remains unproven on the currently served production version.

## Contact form and email status

### Netlify Forms

- Form detection was enabled by the owner in Netlify.
- PR #127 added the Netlify `contact` form definition, honeypot protection and frontend submit handling.
- Visible/source LegendMural contact identity is `info@legendmural.com`.
- A production deploy containing the newer frontend commits and one real submission are still required to prove current Netlify Forms production behavior.

### `info@legendmural.com`

- Intended official LegendMural support/customer-operations address.
- A prior test message was sent on 25 August 2026.
- No incoming copy was observed in the connected Gmail inbox at that time.
- Mailbox/forwarding/receiving capability is therefore still unproven.

### Resend / transactional mail

- Existing Resend code covers withdrawal acknowledgement delivery.
- A branded LegendMural paid-order confirmation email is still not implemented/verified as a completed production feature.
- No confirmation email was received during the owner's failed checkout attempt, but because no verified paid order/confirmation state was reached, that does not by itself prove an email-delivery defect.
- Final `RESEND_FROM` / `RESEND_REPLY_TO`, sending-domain verification, mailbox receiving and contact-form notification delivery remain deferred for explicit follow-up.

## Security boundaries

- Never commit or share `PAYPAL_CLIENT_SECRET`, Neon database passwords/connection strings or Resend API keys.
- Do not ask the owner to paste those secrets into chat.
- Do not log full environment objects or customer payloads.
- Do not globally disable Netlify secret scanning.
- Do not clear the cart or show a paid confirmation unless the server verifies the order as paid.
- Keep GitHub Pages preview static/visual; do not expose/test PayPal Live or Neon there.
- Keep Deploy Preview separate from Production; Preview payment configuration must not accidentally use Live credentials.

## Required workflow for the next chat

Work strictly step by step. After every completed step report:

1. what was changed or checked;
2. the result;
3. what was deliberately not changed;
4. how the result was verified;
5. what the next single step will be.

Do not bundle multiple risky production changes into one step.

## Recommended next-task order

Do not immediately deploy or run a real payment. Start by establishing the runtime baseline.

1. Confirm the exact runtime-code commit currently published by Netlify Production and compare it with current `main` (`649deded...`, with runtime code equivalent to `93cd30f...`).
2. Reproduce/analyse the mobile checkout address behavior and unexpected product-page navigation without speculative code changes.
3. Fix the checkout/mobile address blocker and add regression coverage.
4. Validate the fix in GitHub/appropriate safe preview or test path first.
5. Rebuild the About Us section from a newly agreed narrative architecture.
6. Add the supplied YouTube and Facebook links and verify social navigation.
7. Obtain owner visual approval of all new frontend work in GitHub preview.
8. Only then publish the approved `main` to Netlify Production.
9. Perform production smoke checks, including Netlify Forms.
10. Perform one controlled real PayPal Live order and verify capture/webhook/Neon/order-status/PayPal receipt end-to-end.
11. Use that real order to test the withdrawal flow safely.
12. Resume mailbox/Resend/order-confirmation email work as a separate track.
13. Update the formal go/no-go checklist only after runtime evidence exists.

Do not mark LegendMural fully launch-ready while the reopened checkout blocker or controlled Live transaction remains unresolved.
