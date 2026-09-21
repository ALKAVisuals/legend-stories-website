# LegendMural — current runtime / V3 handoff

**Updated:** 2026-09-21  
**Repository:** `ALKAVisuals/legend-stories-website`  
**Latest synchronized main before this proof update:** `15191d4a93ea6580c12887971f4238220954afb4`  
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

## Exact next engineering step

Fix customer-email media without changing payment truth:

1. define a stable email-safe product-image source in the immutable invoice/order delivery data;
2. render the real product thumbnail for ordinary products;
3. retain a deliberate fallback only when no legitimate product image exists;
4. make the LegendMural header logo reliable in major mail clients, preferably without depending on a fragile hot-linked asset path;
5. add renderer/notifier contract tests for logo + product thumbnail + fallback behavior;
6. prove the HTML render locally/test-only first;
7. do **not** create another real-money payment merely to test images unless separately approved.

Relevant files include:

```text
server/notifications/v3-customer-invoice-email.mjs
server/notifications/resend-paid-order-notifier.mjs
server/commerce/p3-controlled-test-item.mjs
data/products/catalog.json
media/LOGO/lm-logo-transparant.png
```

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
