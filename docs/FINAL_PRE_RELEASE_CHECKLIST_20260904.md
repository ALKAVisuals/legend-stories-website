# LegendMural — Final website pre-release checklist

**Date:** 4 September 2026  
**Repository:** `ALKAVisuals/legend-stories-website`  
**Scope:** public storefront / launch-readiness only  
**Starting storefront `main`:** `735cbf8641f0808836dc4d14115cb159011d8b71`  
**Production host:** Netlify  
**Canonical public origin:** `https://legendmural.com`

> This checklist separates what is already proven before Production, what remains an owner/legal/product gate, what source cleanup is still worth doing before release, and what can only be proven after an explicitly authorized Netlify Production cutover.

No Netlify Production deployment, PayPal Live activation, Production email activation, V3 Production migration, Profile 1 activation or real live payment/email proof is authorized by this document.

---

## 1. Pre-release evidence already proven

### Storefront build and catalogue

- [x] The repository has a production build command: `npm run build`.
- [x] Netlify is configured to build the storefront and publish `dist`.
- [x] Netlify uses Node 22.
- [x] Netlify Functions are configured from `netlify/functions`.
- [x] The central product catalogue contains 111 products.
- [x] The authoritative catalogue variants are Compact 30 cm and Statement 45 cm, measured along the longest side.
- [x] Product-page generation and validation run centrally; the 111 product pages are not maintained manually.
- [x] Product IDs use the `LM-2026-xxxxx` identity model.
- [x] Product pages expose manufacturer/product identity centrally after Blocker D part 2A.

### Commercial rules

- [x] Authoritative consumer prices are Compact €35 incl. VAT and Statement €45 incl. VAT.
- [x] `LEGEND10` is the current 10% discount rule.
- [x] Shipping logic uses NL €4.95, EU €9.95 and US €9.95 tracked.
- [x] Free shipping starts at €69 after discount.
- [x] The production build rejects the obsolete fixed `2–4 day` delivery promise.
- [x] The production build rejects the obsolete `Free shipping over €50` wording.
- [x] The production build rejects the obsolete `30 day return window` wording.
- [x] The Shipping page does not market a fixed delivery ETA and instead states the applicable 30-day legal fallback.

### Checkout and browser flow

- [x] Checkout totals are calculated through the central commerce runtime.
- [x] Browser-modified prices do not define the trusted server amount.
- [x] The public checkout transition control remains `Continue to payment` before hosted PayPal.
- [x] The browser stores only functional cart/checkout state required for the flow.
- [x] Hosted checkout endpoints are deployment-generated rather than hard-coded to a development host.
- [x] Netlify preview compatibility validates `/api/paypal/checkout`, `/api/order-status` and `/api/paypal/capture` runtime wiring.
- [x] The order-return page loads the deployment-generated runtime checkout configuration correctly.
- [x] Mobile WebKit checkout regression coverage is present and green on the final-domain PR baseline.

### Legal/public information baseline

- [x] Company Information identifies Alka Group, KvK, VAT number, Dutch registered/return address, telephone and email.
- [x] Terms of Sale identify the seller, product/pricing basis, PayPal payment model, delivery, statutory rights and complaints route.
- [x] Returns explains the 14-day statutory withdrawal right for standard catalogue purchases.
- [x] Returns provides the return address, refund timing and personalised-goods distinction.
- [x] A dedicated online withdrawal function exists at `withdraw.html`.
- [x] Privacy identifies Alka Group as controller and documents checkout/order/contact/withdrawal data categories.
- [x] Privacy documents PayPal, Netlify, Neon, Resend, Google Fonts and jsDelivr roles relevant to the tracked storefront.
- [x] Privacy documents functional local/session storage and current retention rules.
- [x] No advertising pixels or behavioural analytics trackers were found in the tracked baseline.

### Accessibility and technical quality

- [x] Static accessibility/purchase-flow audit exists and passed on the final-domain PR baseline.
- [x] Quality gate exists and passed on the final-domain PR baseline.
- [x] Mobile iPhone/WebKit regression exists and passed on the final-domain PR baseline.
- [x] Netlify preview compatibility exists and passed on the final-domain PR baseline.
- [x] Post-checkout build readiness exists and passed on the final-domain PR baseline.
- [x] Managed product-page validation and the full unit-test/build suite passed on the final-domain PR baseline.

### Final-domain / SEO source and build

- [x] Tracked public canonical URLs use `https://legendmural.com`.
- [x] Tracked Open Graph URLs and absolute social image URLs use `https://legendmural.com`.
- [x] The homepage canonical and Open Graph URL use the HTTPS apex `https://legendmural.com/`.
- [x] All 111 central product catalogue canonicals use the final domain.
- [x] `sitemap.xml` uses the final domain and apex homepage URL.
- [x] `robots.txt` points to `https://legendmural.com/sitemap.xml`.
- [x] `tests/final-domain-metadata-contract.test.mjs` protects the tracked-source domain contract.
- [x] The Vite production-origin validator rejects legacy GitHub Pages origins in built HTML/XML/TXT/JSON output.

---

## 2. Pre-release source cleanup still open

### Tracked-source commercial-copy debt

The final audit found that the **tracked HTML source** still contains legacy launch copy even though the production Vite build currently rewrites and validates it before `dist` is published.

`shop.html` source still contains legacy examples such as:

- `Free shipping over €50`;
- `Standard delivery in 2 to 4 working days across Europe`;
- `30 day return window`.

`index.html` source still contains legacy examples such as:

- `€49 sticker` / `€49,95` marketing prices;
- `2 to 4 days` delivery copy;
- homepage product-card attributes using legacy `statement-50x50` / `50 × 50 cm` values.

Current runtime/build safety:

- `scripts/vite-launch-commercial-copy-plugin.mjs` rewrites the obsolete customer-facing commercial copy in the production build and validates that the known old claims are absent from `dist`;
- `js/commerce/product-variants.mjs` preserves explicit legacy aliases so `statement-50x50` canonicalizes to `statement-45` and `compact-50x30` canonicalizes to `compact-30` before a cart line is created;
- the existing Quality/commerce/browser tests were green on the final-domain PR baseline.

**Assessment:** this is not currently evidence of a broken production checkout, but it is unnecessary source divergence and build-time patch debt. The tracked source should be normalized before the final Production release so the repository itself reflects the same commercial truth as the built site. Keep the legacy variant aliases for backward compatibility, but do not keep publishing legacy data attributes in homepage source.

Status: **OPEN — next executable website cleanup.**

---

## 3. Parked owner/legal/product gates — not closed by code

### Blocker C — Dutch consumer advance-payment gate

- [ ] The owner intends PayPal-only checkout with 100% payment at order placement.
- [x] Targeted legal research was completed and documented.
- [ ] A specific Dutch consumer-law basis/opinion supporting the unchanged mandatory 100%-upfront model for Dutch consumers has **not** been obtained.

Do not reinterpret this as approval for split payments or another provider. Those directions were explicitly rejected by the owner. The current issue is a launch/legal gate, not a request to redesign payment architecture.

### Blocker D part 2B — material/product-safety completion

- [x] Online manufacturer/product identity is implemented.
- [ ] Exact vinyl/media is not yet confirmed.
- [ ] Exact ink family is not yet confirmed.
- [ ] Laminate/coating status is not yet confirmed.
- [ ] Final consumer packaging/physical marking method is not yet confirmed.
- [ ] Final material-supported use/safety wording and physical traceability marking are therefore not complete.

Owner decision on 4 September 2026: defer this part for now and continue with non-dependent website work. Do not invent warnings or claim this gate is closed.

### Blocker E — commercial rights/IP owner gate

- [ ] Owner must separately confirm the required commercial rights/permissions for all designs, portraits, names, trademarks and other protected material intended for commercial sale.

Repository tests cannot prove this gate.

### Production authorization

- [ ] Owner has not authorized the final Netlify Production deployment in this website track.
- [ ] PayPal Live is not authorized by this checklist.
- [ ] V3 Production migrations/Profile 1/live invoice-email proof are not authorized by this checklist.

---

## 4. Checks that can only be completed after authorized Netlify Production cutover

These items must not be marked complete from preview/build evidence alone.

### Domain and transport

- [ ] `https://legendmural.com/` resolves to the intended Netlify Production site.
- [ ] TLS/HTTPS certificate is valid on the apex domain.
- [ ] `http://legendmural.com/*` redirects to HTTPS apex.
- [ ] `http://www.legendmural.com/*` redirects to HTTPS apex.
- [ ] `https://www.legendmural.com/*` redirects to HTTPS apex.
- [ ] the Netlify subdomain redirects to the canonical apex as configured.

### Live public metadata

- [ ] Live homepage response exposes canonical `https://legendmural.com/`.
- [ ] Representative live shop, legal and product pages expose final-domain canonical/Open Graph metadata.
- [ ] `https://legendmural.com/sitemap.xml` is publicly reachable and contains the final-domain URLs.
- [ ] `https://legendmural.com/robots.txt` is publicly reachable and points to the final sitemap.
- [ ] Representative Open Graph image URLs load from the public final origin.

### Live storefront smoke test

- [ ] Homepage, collection pages, shop and representative product pages load without missing critical assets.
- [ ] Mobile navigation works on the actual Production origin.
- [ ] Cart add/update/remove works on the actual Production origin.
- [ ] Compact 30 cm and Statement 45 cm display and cart identity remain correct.
- [ ] `LEGEND10`, NL/EU/US shipping and €69-after-discount free-shipping behavior are correct live.
- [ ] Terms/Privacy/Shipping/Returns/Company/Withdrawal routes are reachable live.
- [ ] Homepage contact form is tested against the actual Production environment.

### Payment/order live proof — gated

Do **not** execute these merely because the site is deployed. They require the appropriate legal/owner/V3 release gates and explicit approval.

- [ ] Hosted PayPal checkout opens from the Production domain with the expected authoritative total.
- [ ] PayPal cancel returns to the correct Production route/state.
- [ ] Approved payment returns to the correct Production success route.
- [ ] Server-side order-status/capture state is correct after the approved flow.
- [ ] A real paid-order proof is completed only under the separately authorized shared V3 release plan.
- [ ] Production invoice/email delivery proof is owned by the V3 track and is not a website-only acceptance test.

---

## 5. Release decision matrix

| Area | Before Production evidence | Remaining action |
|---|---|---|
| Storefront/build | Strong / green | Normalize tracked legacy source copy/attributes |
| Catalogue/pricing/shipping | Strong / green build+runtime evidence | Live smoke test after cutover |
| Legal information pages | Strong baseline | Blocker C external legal gate remains |
| Privacy/AVG | Strong baseline | Final live route/content check |
| Returns/withdrawal | Strong baseline | Final live route/function check |
| GPSR | Part 2A complete | Part 2B deferred; resume before treating GPSR as closed |
| IP/commercial rights | Not provable in repo | Owner confirmation required |
| Final-domain SEO | Source/build ready | Live DNS/metadata proof after cutover |
| Netlify Production | Not yet executed | Explicit owner approval required |
| Live PayPal/V3 proof | Not executed | Separate gated release proof |

---

## 6. Exact next website step

> **Normalize the tracked `index.html` and `shop.html` source so it no longer depends on build-time rewrites for obsolete price/shipping/returns/delivery copy, and replace legacy homepage 50-cm variant data attributes with the canonical 30/45-cm variant identity. Keep the runtime legacy aliases only for backwards compatibility. Add/extend source-level regression coverage, rerun the normal website CI, and do not deploy Production.**

After that cleanup, return to this checklist. If no further source-level issues are found, remaining steps are owner/legal/product gates followed by an explicitly authorized Production cutover and the live-only checks above.
