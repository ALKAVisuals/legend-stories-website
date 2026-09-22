# LegendMural — current runtime / V3 handoff

**Updated:** 2026-09-21  
**Repository:** `ALKAVisuals/legend-stories-website`  
**Latest synchronized main:** `46c7f830909fa8ec56305626630c130dac1ba518`  
**Purpose:** compact source of truth for the current Cloudflare / PayPal / V3 checkout and invoice-delivery state.

> Read this before older Cloudflare, P3 or V3 status files. Older dated handoffs remain historical evidence but do not override this checkpoint.

## Current repository target

Current `wrangler.jsonc` Production target:

```text
LEGENDMURAL_CHECKOUT_PAUSED=false
P3_TEST_CHECKOUT_ENABLED=false
PAYPAL_ALLOW_LIVE=true
ORDER_EMAILS_ENABLED=true
V3_PROFILE1_ORDER_CREATION_ENABLED=true
V3_INVOICE_RECONCILIATION_ENABLED=true
V3_INVOICE_STORAGE_ENABLED=true
V3_DASHBOARD_INVOICE_API_ENABLED=false
```

The repository therefore targets normal live V3 checkout, with the temporary P3 one-cent window disabled.

## Proven V3 / payment work completed

- Guarded Cloudflare V3 Production activation completed successfully on 2026-09-18 from merge commit `ac87812c38c6eb8d165df9d3349dcf9af90cb06c`.
- Production target includes PayPal Live, Neon durable orders, order emails, Profile-1 order creation, invoice reconciliation and private R2 invoice storage.
- Approved invoice configuration is implemented:
  - order numbering `LM-ORD-YYYY-NNNNNN`;
  - invoice numbering `LM-INV-YYYY-NNNNNN`;
  - seller identity: Alka Group / LegendMural;
  - 21% VAT-inclusive calculation;
  - shipping identity used as launch billing identity.
- Temporary controlled P3 browser/recovery tooling was added for the one-cent V3 Production proof.
- Recovery was hardened so an already-completed PayPal order can be reconciled with provider GET evidence without issuing a second capture request.
- The P3 test item was made Profile-1 invoice compatible.
- PR #288 changed the repository Production target back to `P3_TEST_CHECKOUT_ENABLED=false`.
- Main Quality and Accessibility workflows for PR #288 completed successfully.

## Live Production P3 state — RESOLVED

The temporary P3/V3 one-cent Production window was explicitly disabled on 2026-09-21 using GitHub Actions run `35602463867`, pinned to exact approved storefront `main` commit `15191d4a93ea6580c12887971f4238220954afb4`.

The successful run proves:

```text
WINDOW_ACTION=disable
P3_TEST_CHECKOUT_ENABLED=false
ORDER_EMAILS_ENABLED=true
V3_PROFILE1_ORDER_CREATION_ENABLED=true
V3_INVOICE_RECONCILIATION_ENABLED=true
V3_INVOICE_STORAGE_ENABLED=true
```

Wrangler deployed `legendmural-cloudflare-production` successfully with `P3_TEST_CHECKOUT_ENABLED=false`.

The final live checkout guard also passed:

```text
ordinary checkout is active after P3 disable
HTTP 400 EMPTY_CART
no PayPal order created by the proof
```

Therefore the temporary controlled P3 window is now proven OFF in the live Production Worker, while normal V3 checkout is proven active.

## Controlled €0.01 V3 proof result

The controlled payment reached the V3 paid/invoice communication path and a customer confirmation/invoice email was received. The test established that the core payment-to-email chain can complete.

The latest customer-email screenshot exposed two visual/media defects that are not payment defects:

1. **Header logo is externally referenced and failed to render in the receiving mail client.**
   - Current renderer uses `https://legendmural.com/media/LOGO/lm-logo-transparant.png`.
   - The file exists in the repository, but the email depends on the receiver fetching an external image.

2. **Product artwork is not implemented in the V3 customer email.**
   - `renderItemRows(...)` currently hardcodes an `LM` placeholder block.
   - It does not render the purchased product image.
   - The controlled P3 test item itself intentionally has `image: ''`, so it cannot prove real-product thumbnail rendering.

## Customer email media fix — MERGED AND DEPLOYED

Storefront PR #291 implemented the customer-email media repair exposed by the controlled V3 proof and was merged to `main` as `812edde5cbebf0014c1d0cfe45bfb4a7105621a3`.

Implemented and merged from final PR head `9faba7f8a10d218e912c1ed4ab2030dc1f813dd7`:

- V3 customer email renderer advanced to version 3;
- canonical LegendMural logo is embedded as a CID attachment from byte-identical repository PNG data;
- ordinary product rows render the actual immutable snapshot `line.image` as CID product artwork;
- the initial deployed implementation asked Resend to fetch the repository-style `/media/stikkers/*` source URL; the synthetic proof below showed that path is not a reliable deployed Static Asset URL;
- missing/invalid product images keep the deliberate `LM` fallback tile;
- existing PDF attachment and V3 email idempotency key are preserved;
- unapproved external image origins fail closed before provider delivery;
- regression coverage locks the embedded logo bytes to `media/LOGO/lm-logo-transparant.png`.

Full PR CI is green:

```text
Quality checks: SUCCESS
Accessibility and purchase-flow audit: SUCCESS
Cloudflare migration compatibility: SUCCESS
Mobile checkout WebKit regression: SUCCESS
```

No payment, Resend send, Neon/R2 data mutation or dashboard change occurred in the implementation proof. The code was subsequently deployed to Cloudflare Production as recorded below.

Resend's supported CID attachment mechanism is used so the receiving mail client no longer has to hot-link the logo or product artwork itself.

## Failed guarded deploy attempt — no Production mutation

Owner-approved GitHub Actions run `35605332116` attempted to deploy current `main` `309ecd34b9dc9f5146b7b98ca8594780b85e5d21`, but failed safely before the dry-run/deploy steps.

The failure was in the read-only preflight verifier:

```text
Production Worker guarded flag LEGENDMURAL_CHECKOUT_PAUSED does not match the expected preflight value.
```

Cause: the guarded workflow still used the original launch-era `preflight` contract, which expects checkout paused and V3 disabled. Production is already correctly in the post-launch active state, so that historical preflight is no longer valid for routine guarded redeploys.

Important safety result:

- exact commit/confirmation gate passed;
- credentials gate passed;
- repository tests passed;
- storefront build passed;
- read-only Cloudflare verification detected the state mismatch;
- dry-run was skipped;
- real deploy was skipped;
- postdeploy proof was skipped;
- no PayPal order/payment/email/Neon/R2 mutation occurred.

PR #293 repaired this workflow and was merged to `main` as `734454c28e28d557969428996507188a2dc85c88`. Routine guarded Production redeploys now verify the already-active state before mutation while the historical launch `preflight` mode remains available for auditability.

## Successful guarded Production deploy

Owner-approved GitHub Actions run `35606356303` successfully deployed exact `main` `e37a9edb61c56d353207166c4d1b46c9b8a9d47c` to `legendmural-cloudflare-production`.

The run proved all safety gates and deployment stages:

```text
exact commit / owner confirmation: PASS
repository contract tests: PASS
storefront build: PASS
active-state Production predeploy verification: PASS
Wrangler dry-run: PASS
Cloudflare Production deploy: PASS
postdeploy guarded-state verification: PASS
public checkout OPTIONS proof: PASS
```

Verified live state after deployment:

```text
LEGENDMURAL_CHECKOUT_PAUSED=false
P3_TEST_CHECKOUT_ENABLED=false
ORDER_EMAILS_ENABLED=true
V3_PROFILE1_ORDER_CREATION_ENABLED=true
V3_INVOICE_RECONCILIATION_ENABLED=true
V3_INVOICE_STORAGE_ENABLED=true
V3_DASHBOARD_INVOICE_API_ENABLED=false
V3_INVOICE_PDFS -> legendmural-v3-invoice-pdfs-prod
```

The public checkout route returned the expected safe CORS/OPTIONS proof and **no PayPal order was created**.

Renderer v3 and the CID logo/product-image email implementation from PR #291 were therefore live in the Production Worker, but this deployment alone did not prove provider-side retrieval of the product image.

## Synthetic non-payment email proof — product source path failure isolated

After explicit owner approval, one synthetic transactional email was submitted to Resend for visual verification without creating a PayPal order, payment, Neon order or invoice.

Resend email ID:

`01a0c43b-7acf-7088-ba3b-521a3af4fdc3`

Observed provider state:

```text
status: failed
message_id: null
processed inline attachments: 1
processed attachment: legendmural-logo.png (25,948 bytes)
product attachment: not processed
```

This isolates the remaining defect to the product-image remote attachment source. The embedded CID logo itself was accepted by Resend. The product image source used a repository-style `https://legendmural.com/media/stikkers/*` URL which is not guaranteed to exist as that same stable path in the Vite/Cloudflare Static Assets build.

No recipient delivery occurred for this failed proof.

## Stable email product asset repair — MERGED AND DEPLOYED

Storefront PR #296 contains this repair and was merged to `main` as `e96c3489ada7f4522dbd164584e1ae180c76ff24`. The final merged PR head was `3b07c697da495bf3c4722314f36a0ccc9653ea74`.

Full CI on that implementation head was green:

```text
Quality checks: SUCCESS
Accessibility and purchase-flow audit: SUCCESS
Cloudflare migration compatibility: SUCCESS
Netlify preview compatibility: SUCCESS
Mobile checkout WebKit regression: SUCCESS
```

The current repair branch adds a deterministic build-time Static Asset namespace:

```text
snapshot line.image:
media/stikkers/...

deployed email source:
https://legendmural.com/email-products/stikkers/...
```

The repair:

- derives the public email asset from the immutable stored snapshot `line.image`;
- copies every catalog product image into `dist/email-products/**` during the normal production build;
- preserves the source path hierarchy so snapshot image identity remains deterministic;
- validates every copied asset against its source file before build completion;
- restricts Resend remote CID sources to the dedicated `/email-products/*` namespace only;
- rejects the old `/media/stikkers/*` remote attachment URLs in notifier validation;
- keeps the brand logo as byte-identical embedded base64 CID data;
- does not change PayPal, order truth, invoice truth, Neon, R2 or checkout behavior.

## Successful stable email-product Production deploy

Owner-approved GitHub Actions run `35716871532` successfully deployed exact storefront `main` `86f8903eba5587cb1526ecfe8b606900b73a5f15` to `legendmural-cloudflare-production`.

The run proved:

```text
exact owner confirmation / commit pin: PASS
guarded contract tests: PASS
storefront build: PASS
111 stable email product assets copied: PASS
111 stable email product assets validated: PASS
active-state Production predeploy verification: PASS
Wrangler dry-run: PASS
Cloudflare Production deploy: PASS
postdeploy guarded-state verification: PASS
public checkout OPTIONS proof: PASS
```

Cloudflare read 456 built Static Asset files. During the Production deploy it uploaded 20 new or modified files while 398 were already present. The Worker and triggers deployed successfully.

Verified runtime state after deploy still includes:

```text
P3_TEST_CHECKOUT_ENABLED=false
ORDER_EMAILS_ENABLED=true
V3_PROFILE1_ORDER_CREATION_ENABLED=true
V3_INVOICE_RECONCILIATION_ENABLED=true
V3_INVOICE_STORAGE_ENABLED=true
V3_DASHBOARD_INVOICE_API_ENABLED=false
V3_INVOICE_PDFS -> legendmural-v3-invoice-pdfs-prod
```

The safe checkout proof used only `OPTIONS` and created no PayPal order.

The dedicated `dist/email-products/**` namespace is therefore included in the successfully deployed Static Assets build. A provider-side fetch / actual recipient render is still a separate proof and must not be inferred from the deploy alone.

## Successful synthetic non-payment email delivery proof

After explicit owner approval, exactly one synthetic transactional email was sent using the live stable `/email-products/**` product source.

Resend email ID:

`01a0c8b8-1df2-7769-b432-ac72cacd9164`

Provider result:

```text
status: delivered
message_id: present
processed inline attachments: 2
legendmural-logo.png: 25,948 bytes
legendmural-product-1.png: 528,353 bytes
```

This proves that Resend successfully fetched the deployed product image from the dedicated `/email-products/**` Static Asset namespace, processed both CID attachments, and delivered the message to the test recipient.

No PayPal order, payment, Neon order, invoice, R2 write or customer order was created by this proof.

The receiving mailbox was then checked by the owner, who confirmed that the delivered email renders correctly. This closes the recipient-side visual verification for the CID logo and product artwork.

## Email-media incident status — CLOSED

The full non-payment proof is now complete:

```text
stable /email-products/** build path: PASS
Cloudflare Production deploy: PASS
Resend product fetch: PASS
CID logo processing: PASS
CID product processing: PASS
provider delivery: PASS
recipient-side visual rendering: PASS
```

No further email-media engineering is required for this incident.

## Exact next engineering step

> Merge the current documentation-only PR that records the successful Production deploy, delivered synthetic proof and recipient-side visual confirmation. Do not perform another email send, PayPal order or Production deploy for this closed incident.

## Public Google Knowledge Graph key cleanup — MERGED AND DEPLOYED

Storefront PR #300 removed the unused browser-visible Google Knowledge Graph API key and its dead client-side sticker-fact feature.

Merged Production code:

`46c7f830909fa8ec56305626630c130dac1ba518`

Owner-approved guarded Cloudflare Production run:

`35724593502`

The deployment completed successfully and proved:

```text
exact approved main commit: PASS
guarded contract tests: PASS
storefront production build: PASS
Cloudflare active-state predeploy verification: PASS
Wrangler dry-run: PASS
2 changed Static Assets uploaded: PASS
legendmural-cloudflare-production deploy: PASS
postdeploy guarded-state verification: PASS
ordinary public checkout route active: PASS
PayPal order created by verification: no
```

The deployed storefront therefore no longer includes the removed Knowledge Graph key/fetch path in the current built code.

Historical exposure remains a separate credential-management concern: because the old key existed in public repository history, it should be revoked/rotated or explicitly restricted in Google Cloud if it is still active. No Google Cloud credential mutation was performed by this repository change.

## Exact next engineering step

> Confirm the historical Google Knowledge Graph key is revoked, rotated or safely restricted in Google Cloud if it still exists. No storefront code change is required for that credential action. After that, continue the launch-hardening checklist with the next prioritized site item.

## Dashboard state

`V3_DASHBOARD_INVOICE_API_ENABLED=false` remains the repository Production target. Do not infer that dashboard invoice/PDF end-to-end access is active merely because V3 invoice issuance/storage is active.

The dashboard repository was synchronized through dashboard PR #77. For payment/V3 runtime truth, this storefront status remains authoritative; dashboard-specific UI/publication state remains in the dashboard repository.

## Older launch/legal gates

Older public-site legal/product-rights/GPSR gate documents remain separate from this technical checkpoint. They are not silently closed by the successful payment/V3 proof.

## Continuity rule

After every meaningful payment/V3/Production step:

1. fresh-check `main` and open PRs;
2. update this current handoff (or replace it with a newer dated current-status file);
3. record exact completed work, exact runtime proof, remaining risk and exactly one next action;
4. never rely on old chat history when GitHub evidence exists;
5. never expose secrets/customer payloads in docs.
