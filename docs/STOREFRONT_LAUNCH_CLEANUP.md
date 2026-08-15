# Storefront launch cleanup

Status: audit + implementation scope in progress on `agent/storefront-launch-cleanup-v2`.

Baseline: `main` after PR #88 (30/45 cm production sizing) and PR #89 (launch commerce matrix regression coverage).

This phase is deliberately limited to customer-visible storefront launch cleanup. Production Netlify, production Neon, PayPal Live, final legal policy content, and artwork IP review are outside this branch.

## Current launch commerce source of truth

- Compact: **30 cm longest side** — €35 incl. VAT.
- Statement: **45 cm longest side** — €45 incl. VAT.
- Statement is the default variant.
- Original artwork proportions are preserved; the other dimension follows the artwork ratio.
- Canonical variant IDs: `compact-30` and `statement-45`.
- Public discount code: `LEGEND10` — 10%.
- Netherlands shipping: €4.95.
- EU shipping: €9.95.
- United States tracked shipping: €9.95.
- Free shipping: from €69 **after discount** in supported markets.
- Destinations outside NL, EU and US are unavailable at checkout.

Runtime sources:

- `js/commerce/product-variants.mjs`
- `js/commerce/shipping.mjs`
- `tests/commerce-launch-matrix.test.mjs`

Customer-visible HTML must not contradict these values.

## Confirmed blockers on the current main baseline

### 1. Homepage branding and SEO are still legacy

`index.html` still contains:

- `Legend Stories` in title, meta description, Open Graph metadata and accessibility copy;
- `og:site_name` set to `Legend Stories`;
- canonical, `og:url` and social image URLs pointing to the legacy GitHub Pages host;
- copyright copy that still names `Legend Stories`.

Branding can be changed to `LegendMural`. Canonical/domain URLs must not be guessed; they remain blocked until the definitive public production domain is confirmed.

### 2. Unverified social proof / testimonial claims

The homepage still presents customer-facing claims including:

- `1K+ Sold`;
- `4.9★ On Trustpilot`;
- `Best seller — The Truth Seeker`;
- named testimonial cards with ratings, delivery claims and quoted customer experiences.

These claims must be removed unless there is verifiable evidence that they are genuine and accurate.

### 3. Homepage shop-preview price and variant data are stale

The homepage shop-preview currently contains cards that visibly show `€49,95` while their cart data uses a €45 price. More importantly, those cards still use legacy production identity such as:

- `data-variant-id="statement-50x50"`;
- `data-size-label="50 × 50 cm"`;
- `data-longest-side-cm="50"`.

The cart upsell contains the same stale Statement identity and visible `€49,95` value.

The current launch identity is `statement-45`, 45 cm longest side, €45. This is a concrete post-#88 storefront inconsistency and must be corrected before launch.

Legacy aliases in runtime may preserve old stored-cart compatibility, but new customer-facing markup must emit canonical 30/45 cm variant identity.

### 4. Shipping copy contradicts the launch commerce contract

The cart currently states `Free shipping on orders over €50`, while the authoritative runtime and launch-matrix tests use free shipping from **€69 after discount**.

The homepage value proposition also states `2 to 4 working days. Ships across Europe.` This does not accurately describe the active market configuration because the United States is also enabled with tracked shipping. Delivery-time claims must only remain if the operational fulfillment promise is verified.

### 5. Contact and social identity still contain legacy / placeholder data

The homepage currently contains:

- `hello@legendstories.nl`;
- TikTok and Instagram handle `@legendstories_official`;
- WhatsApp placeholder number `+31 6 12345678`.

Placeholder contact data must not ship. Legacy brand contact/social identities must either be verified as intentionally retained or replaced by the confirmed LegendMural identities.

### 6. Payment badges overstate the launch payment surface

The homepage footer currently advertises:

- iDEAL;
- Visa;
- Mastercard;
- PayPal.

The launch checkout runtime is PayPal-only. Payment badges must describe what customers can actually select in the storefront; unsupported standalone payment-method claims must be removed unless the final PayPal checkout presentation genuinely exposes them in a way that makes the wording accurate.

### 7. Shared product template still contains legacy brand identity

`templates/product-page.html` is already correct for 30/45 cm sizing, but still contains `Legend Stories` in shared customer-facing metadata/accessibility copy.

`scripts/product-page-generation.mjs` and central product/catalog metadata also still emit `Legend Stories` in titles/structured data/descriptions. Product canonicals still use the GitHub Pages host.

Because all 111 product pages are generator-managed and the live validator requires byte-identical generated output, template/generator changes must be followed by a complete managed-page regeneration. Do not hand-edit the 111 product pages individually.

### 8. Project status documentation is stale

`docs/PROJECT_STATUS.md` on current `main` still describes:

- the Stripe cleanup as waiting for merge, although PR #87 is already merged;
- Compact/Statement as 50 × 30 / 50 × 50 cm, although PR #88 changed launch production sizing to 30 / 45 cm longest side;
- the launch commerce matrix as outstanding, although PR #89 added this regression coverage.

This status file should be refreshed in a dedicated coherent update; stale project documentation must not be treated as commerce source of truth over the runtime/tests.

## Items that still require direct re-check before implementation completion

- footer help/legal routes and whether each route actually exists;
- collection/shop/about page price and variant markup;
- current-brand strings and old social handles outside homepage/generated product pages;
- remaining legacy `statement-50x50` / `compact-50x30` markup used for new storefront actions rather than backwards compatibility;
- other shipping/delivery-time claims across customer-facing pages;
- other payment badges or provider claims outside the homepage.

## Implementation rules

1. **Runtime/tests win over stale copy.** Do not modify the 30/45 cm commerce contract in this cleanup.
2. **Branding:** customer-facing current brand is `LegendMural`; historical documentation may retain historical names when context requires it.
3. **Prices:** customer-visible prices must match the canonical variant price (€35 / €45).
4. **Variant identity:** new markup uses `compact-30` / `statement-45`; legacy aliases are retained only for backwards compatibility where already implemented.
5. **Shipping:** copy must match `shipping.mjs`, including the €69 post-discount threshold and supported markets.
6. **Trust claims:** no invented replacement claims. Remove unsupported social proof rather than replacing it with different unsupported numbers.
7. **Contact details:** do not publish placeholder phone/WhatsApp data. Only verified business contact details are allowed.
8. **Payment claims:** only display payment methods actually available through the launch checkout.
9. **Domain/SEO:** do not invent a canonical production domain. Replace GitHub Pages URLs only after the definitive public domain is confirmed.
10. **Generated pages:** update shared template/generator/catalog sources, then regenerate and validate all 111 managed product pages.
11. **Legal:** route/label cleanup can be scoped here, but final privacy/returns/refunds/terms content belongs to the separate legal phase using current official NL/EU sources.

## Required validation before this phase can be called complete

- repository-wide audit for old current-brand strings and legacy GitHub Pages URLs;
- repository-wide audit for stale visible `€49,95` product pricing;
- repository-wide audit for legacy 50 × 30 / 50 × 50 storefront markup that should now be 30 / 45 cm;
- repository-wide audit for incorrect free-shipping, delivery-time and payment-method claims;
- `validate:managed-product-pages:live` green after any shared product-page changes;
- unit tests / Quality green;
- Accessibility/purchase-flow green;
- Netlify compatibility green;
- production build green;
- manual Deploy Preview review of homepage, shop, collection, product, cart and checkout surfaces.

## Explicitly outside scope

- production Neon or migrations;
- production Netlify environment variables;
- PayPal Live app, credentials, webhook or enablement;
- final legal policy text;
- refunds/reversal financial state machine;
- artwork IP/portrait/trademark legal review;
- framework rewrite or broad redesign.
