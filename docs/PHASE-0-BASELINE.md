# LegendMural — Phase 0 Baseline Audit

Baseline commit: `dbd46aac23a538f919bb45a1cd35f008b16afaea`

## Purpose

This document establishes the technical baseline before storefront refactors or feature work begin. Phase 0 measures and documents the current state; it does not redesign the website.

## Confirmed baseline

### Repository and workflow

- Repository: `ALKAVisuals/legend-stories-website`
- Default branch: `main`
- Repository size reported by GitHub: approximately 383 MB
- Recent changes were committed directly to `main`
- No pull-request history existed before this audit
- Phase 0 introduced the first draft-PR workflow on branch `audit/phase-0-baseline`
- GitHub Actions now runs the repository audit and production build for pull requests into `main`

### Build architecture

- Vite 5 multi-page build
- Every root-level `.html` file is automatically treated as a Rollup entry
- Tailwind CSS 3.4
- Vanilla JavaScript
- Terser minification
- No sourcemaps
- Phase 0 adds report-only repository audit tooling

### Storefront architecture

- Large number of independent HTML product pages
- Shared navigation, footer, cart and other shell markup is repeated
- Homepage loads Tailwind plus many custom CSS layers
- Homepage contains page-specific inline JavaScript
- `js/app.js` owns cart, shipping, discounts, checkout and unrelated UI concerns

### SEO baseline

- Canonical URL points to the GitHub Pages origin
- `og:url` points to the GitHub Pages origin
- `og:image` uses the GitHub Pages origin
- `robots.txt` points to a GitHub Pages sitemap
- Root `sitemap.xml` contains GitHub Pages URLs
- Production-origin migration remains pending until hosting and the final domain are configured

### Conversion and trust baseline

- Homepage presents `1K+ Sold`, `4.9 on Trustpilot` and bestseller claims
- These claims require a verified data source before production launch
- Footer contains placeholder links for Shipping, Returns, FAQ and Privacy
- Contact form integration is not yet confirmed
- Prices, discount state and shipping totals currently exist in client-side JavaScript

### Media and performance baseline

- Repository size indicates a heavy media footprint
- Category pages use autoplay video heroes
- Homepage uses a large PNG hero image and multiple visual effects
- Responsive image markup is not consistently visible in the audited pages
- Numeric Lighthouse and Core Web Vitals measurements are deferred until a local or hosted preview is available

## Phase 0 measurement matrix

| Area | Current status | Evidence required before exit |
|---|---|---|
| Build | GitHub Actions configured | Successful PR production build |
| Internal links | Automated report added | Review generated report |
| Missing assets | Automated report added | Review generated report |
| SEO consistency | Automated report added | Review metadata findings |
| Repository media | Automated size inventory added | Review largest-file findings |
| Cart path | Code inspected | Repeatable functional test |
| Checkout path | Browser-owned logic confirmed | Defined backend/payment validation strategy |
| Mobile UX | Markup inspected | Real-device or browser emulation test |
| Lighthouse | Deferred | Mobile and desktop reports on a preview |
| Production headers | Deferred | Hosting-response inspection |

## Automated pull-request checks

The workflow `.github/workflows/quality-checks.yml` runs for pull requests into `main` and can also be started manually.

It performs:

1. repository checkout;
2. Node.js 20 setup;
3. deterministic `npm ci` installation;
4. `npm run audit`;
5. `npm run build`;
6. audit-report artifact upload.

Strict audit mode is intentionally not yet a required check because the current baseline contains known issues. Once those issues are resolved, `npm run audit:strict` can replace report-only mode.

## Phase 0 exit criteria

Phase 0 is complete when:

1. the repository inventory is reproducible;
2. all root HTML entries build successfully;
3. broken links and missing assets are reported;
4. SEO metadata inconsistencies are enumerated;
5. the largest media assets and categories are known;
6. the cart and checkout risks are documented;
7. implementation work is ordered by risk and dependency;
8. all future work proceeds through branches and pull requests;
9. the pull-request quality workflow completes successfully.

## Current priority order

### P0 — Before accepting real orders

- authoritative server/payment-side price validation;
- correct checkout integration;
- legal and support destination pages;
- verified shipping and discount rules;
- remove or substantiate trust claims;
- eliminate broken links and missing assets.

### P1 — Foundation

- repository audit tooling;
- build and metadata checks;
- product-data architecture;
- shared layout generation;
- modular cart and pricing logic;
- media inventory and budgets;
- SEO origin generation;
- protected branch workflow.

### P2 — Optimization

- image derivatives and responsive delivery;
- video optimization;
- CSS consolidation;
- Lighthouse and Core Web Vitals tuning;
- structured data;
- conversion experiments.

## Related document

See `docs/SPRINT-1-FOUNDATION-AUDIT.md` for the technical-debt map and recommended implementation order.
