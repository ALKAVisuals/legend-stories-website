# LegendMural current production status

Updated: 25 August 2026, late evening

This document is the current operational handoff for the LegendMural production track. It complements `docs/PRODUCTION_GO_NO_GO_CHECKLIST.md`; it does not replace the formal release gates.

## Current reviewed baseline

- Repository: `ALKAVisuals/legend-stories-website`
- Production host: Netlify
- Public origin: `https://legendmural.com`
- Payment provider for launch: PayPal Live
- Database: Neon Postgres
- Current reviewed `main`: `93cd30fae5208d2d853bd6dbe7116b69adadd3d0`
- GitHub Pages is being used only as a temporary visual/static preview before publishing newer work to Netlify Production.
- Latest reviewed GitHub Pages preview commit: `ff87f6e46ab7085e6185493c252c9e2cc82077d0`; its build and deploy both completed successfully.
- Important workflow rule: do not publish newer website changes to Netlify Production until the owner has visually approved them in the GitHub Pages preview.

## Completed repository work

- PR #118 — Netlify Resend secret-scan false-positive handling for `RESEND_REPLY_TO` without disabling secret scanning globally.
- PR #120 — checkout address-validation hard timeout/fallback so the frontend cannot wait forever for the Google Places callback.
- PR #121 — browser regression coverage for address-validation timeout, single callback handling and ignored late callbacks.
- PR #122 — safe PayPal bootstrap diagnostics without logging secrets or customer payloads.
- PayPal Live production configuration has been activated by the owner: official Live API base, Live client credentials, Live webhook identity and `PAYPAL_ALLOW_LIVE=true` in Production. The PayPal hosted checkout page has previously been reached successfully.
- Neon production checkout bootstrap has previously been proven far enough for PayPal Live checkout creation to proceed.
- PR #123 — checkout country-dropdown contrast fix.
- PR #124 — premium post-payment success experience with truthful server-driven payment states.
- PR #125 — premium cancelled-payment experience; cart remains retained and no false paid claim is made.
- PR #126 — production-build readiness validation for the post-checkout pages.
- PR #127 — Netlify Forms integration for the homepage contact form, including honeypot protection and accessible submission feedback.
- PR #128 — production-status handoff document.
- PR #129 — light-mode footer contrast hardening. Dark mode was intentionally left unchanged.
- PR #130 — homepage contact email source updated directly to `info@legendmural.com`.
- PR #131 — obsolete runtime replacement of the legacy contact email removed; contract tests updated accordingly.

## GitHub Pages preview status

The temporary GitHub Pages preview is currently working and visually reflects the newer repository state without publishing those changes to Netlify Production.

Preview URL:

`https://alkavisuals.github.io/legend-stories-website/`

Pages-specific URL rewriting exists only for the preview subpath and must not be treated as production routing. The preview workflow currently handles the fixed footer stylesheet and contact-form script paths correctly. The preview is visual/static only; PayPal Live, Neon and Netlify Functions must not be validated through GitHub Pages.

The owner visually confirmed that the light-mode footer contrast now looks correct in the GitHub Pages preview.

## Contact identity status

The official LegendMural site email is:

`info@legendmural.com`

The homepage source now contains that address directly; the old `hello@legendstories.nl` fallback was removed from the active contact flow.

Important distinction: this confirms the website identity, not mailbox delivery. Receiving/forwarding for `info@legendmural.com` is still not proven.

## New requested website changes — not implemented yet

These items were supplied by the owner after the latest preview review and must be carried into the next work session.

### 1. Missing social links

Add the missing official social links where appropriate in the LegendMural site/social area:

- YouTube: `https://youtube.com/@legendstories_official?si=UhNqTXzb6XWWHFFX`
- Facebook: `https://www.facebook.com/share/197TDKP6RC/?mibextid=wwXIfr`

Do not invent replacement handles or URLs for any other social platform.

### 2. About Us requires a complete rebuild

The current About Us / team section is not accepted by the owner and should not be polished incrementally. It needs to be rebuilt from the ground up around a logical LegendMural brand story.

Problems identified in the current version include:

- weak heading/subheading narrative (`The people` / `Three people. One wall at a time.`);
- placeholder-like emoji team portraits;
- overly casual/shallow role copy;
- no coherent story explaining why LegendMural exists, what it creates, what it stands for and who is behind it;
- current presentation does not match the premium LegendMural brand.

The next session should first define the new narrative architecture before writing or styling the final section. A likely structure is origin/idea -> mission -> product/quality/design philosophy -> people/team, but this must be deliberately designed rather than copied blindly.

### 3. Withdraw-a-purchase flow needs real end-to-end validation

The owner attempted to test the withdrawal form with fake order data, but fake data is not a valid proof because the flow should identify a real order.

The withdrawal feature must therefore be tested later using a controlled real order and matching order email. Verify at minimum:

1. a real paid order exists in the authoritative store;
2. correct Order ID + matching order email is accepted;
3. the withdrawal notice is durably recorded by the backend;
4. no unintended automatic refund occurs;
5. the customer-facing success/error state is correct;
6. withdrawal acknowledgement email behavior is verified;
7. incorrect Order ID/email combinations are rejected safely.

Do not weaken order verification merely to make fake test data pass.

## CRITICAL REOPENED BLOCKER — checkout behavior observed on production

The earlier address-validation hang was fixed and regression-tested in repository code, but on 25 August 2026 the owner observed problematic behavior again on the currently served `legendmural.com` checkout using mobile Safari.

Observed behavior:

- after entering shipping details and pressing Continue to Payment, the button showed `VALIDATING ADDRESS...`;
- the checkout appeared to remain in that state;
- it subsequently navigated to an unexpected/random sticker product page instead of a logical PayPal/checkout continuation;
- no successful order-confirmation page was shown;
- no order-confirmation email was received.

This must be treated as an open production blocker until reproduced and explained.

Do **not** assume yet that PR #120/#121 failed. The cause could be a runtime regression, navigation bug, stale production deployment, environment difference or another checkout path. The next session must first establish exactly which commit is currently published on Netlify and reproduce the mobile production flow before changing code.

### Related mobile address-field UX defect

The owner also observed that while typing the street on mobile Safari, after entering the first characters (example: `sc` for Schansweg), the street field visually jumps/loses its stable typing state and a warning/validation icon appears. The user can click the field again and continue typing, but the interaction is not acceptable.

Investigate:

- whether the input actually loses focus;
- whether autocomplete/Google Places re-renders or moves the field;
- whether validation starts too early;
- whether validation/error UI changes layout while the user is typing;
- whether the behavior contributes to the later checkout/navigation failure.

The desired result is a stable mobile input experience with no unexpected focus/layout jump while typing.

## Payment truth boundary

LegendMural is **not declared fully selling-ready**.

A controlled real PayPal Live transaction is still required, but it must only be attempted after the reopened checkout/address blocker above has been resolved and the current production version is understood.

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
- However, the owner did not reach the expected confirmation page during the newly observed checkout failure. Therefore runtime navigation into the post-checkout flow remains unproven on the currently served production version.

## Contact form and email status

### Netlify Forms

- Form detection was enabled by the owner in Netlify.
- PR #127 added the Netlify `contact` form definition, honeypot protection and frontend submit handling.
- The visible/source LegendMural contact identity is now `info@legendmural.com`.
- A fresh production deploy containing the newer commits and one real submission are still required to prove the current form in Netlify Forms production.

### `info@legendmural.com`

- Intended official LegendMural support/customer-operations address.
- A prior test message was sent to it on 25 August 2026.
- No incoming copy was observed in the connected Gmail inbox at that time.
- Therefore mailbox/forwarding/receiving capability is still not proven.

### Resend / transactional mail

- Existing Resend code covers withdrawal acknowledgement delivery.
- A branded LegendMural paid-order confirmation email is still not implemented/verified as a completed production feature.
- No confirmation email was received during the owner's failed checkout attempt, but because no verified paid order/confirmation state was reached, that observation alone does not prove an email-delivery defect.
- Final `RESEND_FROM` / `RESEND_REPLY_TO`, sending-domain verification, mailbox receiving and contact-form notification delivery remain deferred for explicit follow-up.

## Security boundaries that remain in force

- Never commit or share `PAYPAL_CLIENT_SECRET`, Neon database passwords/connection strings or Resend API keys.
- Do not ask the owner to paste those secrets into chat.
- Do not log full environment objects or customer payloads.
- Do not globally disable Netlify secret scanning.
- Do not clear the cart or show a paid confirmation unless the server verifies the order as paid.
- Keep GitHub Pages preview static/visual; do not expose or test PayPal Live or Neon there.
- Keep Deploy Preview separated from Production; Preview payment configuration must not accidentally use Live credentials.

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

1. Confirm the exact commit currently published by Netlify Production and compare it with `main` (`93cd30f...`).
2. Reproduce/analyse the mobile checkout address behavior and unexpected product-page navigation without making speculative code changes.
3. Fix the checkout/mobile address blocker and add regression coverage.
4. Validate the fix in GitHub/appropriate safe preview/test path first.
5. Rebuild the About Us section from a newly agreed narrative architecture.
6. Add the supplied YouTube and Facebook links and verify social navigation.
7. Obtain owner visual approval of all new frontend work in GitHub preview.
8. Only then publish the approved `main` to Netlify Production.
9. Perform production smoke checks, including Netlify Forms.
10. Perform one controlled real PayPal Live order and verify capture/webhook/Neon/order-status/PayPal receipt end-to-end.
11. Use that real order to test the withdrawal flow safely.
12. Resume mailbox/Resend/order-confirmation email work as a separate track.
13. Update the formal go/no-go checklist only after runtime evidence exists.

Do not mark LegendMural fully launch-ready while the reopened checkout blocker or the controlled Live transaction remains unresolved.
