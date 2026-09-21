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

## Customer email media fix — MERGED, NOT YET DEPLOYED

Storefront PR #291 implemented the customer-email media repair exposed by the controlled V3 proof and was merged to `main` as `812edde5cbebf0014c1d0cfe45bfb4a7105621a3`.

Implemented and merged from final PR head `9faba7f8a10d218e912c1ed4ab2030dc1f813dd7`:

- V3 customer email renderer advanced to version 3;
- canonical LegendMural logo is embedded as a CID attachment from byte-identical repository PNG data;
- ordinary product rows render the actual immutable snapshot `line.image` as CID product artwork;
- only approved `https://legendmural.com/media/stikkers/*` or `/media/browser-products/*` sources may be fetched by Resend;
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

No Production deploy, payment, Resend send, Neon/R2 mutation or dashboard change occurred in this implementation proof.

Resend's supported CID attachment mechanism is used so the receiving mail client no longer has to hot-link the logo or product artwork itself.

## Exact next engineering step

> PR #291 is merged. The next action is a separate owner-approved Cloudflare Production deployment of current `main` so renderer v3/CID images become live. Do not deploy or create another real-money test without a new explicit Production approval.

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
