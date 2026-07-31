# LegendMural — Phase 0 Baseline Audit

**Audit date:** 2026-08-01  
**Repository:** `ALKAVisuals/legend-stories-website`  
**Baseline branch:** `audit/phase-0-baseline`  
**Baseline commit:** `dbd46aac23a538f919bb45a1cd35f008b16afaea`

## Purpose

Phase 0 establishes a reproducible technical baseline before product code is changed. The goal is to identify the highest-risk issues, define what must be measured, and prevent future improvements from being judged only by appearance.

No storefront code, design, product data, cart behavior, or deployment configuration is changed in this phase.

## Executive baseline

| Area | Status | Baseline observation |
|---|---|---|
| Repository workflow | High risk | Recent work is committed directly to `main`; no pull requests are currently present. |
| Repository size | High risk | GitHub reports a repository size of approximately 383 MB, unusually large for a static storefront. |
| Architecture | Medium/high risk | Vite treats every root-level HTML file as an independent entry. This is fast at runtime but increasingly expensive to maintain as the catalog grows. |
| SEO origin | Critical | Canonical, Open Graph, robots and sitemap URLs still reference the legacy GitHub Pages origin. |
| Netlify configuration | High risk | No versioned `netlify.toml` is present at the repository root. Production behavior is therefore not fully reproducible from Git. |
| Media performance | High risk | Category pages use full-screen autoplay MP4 video backgrounds; the homepage uses a large PNG hero asset and visual effects. |
| CSS maintainability | Medium/high risk | The homepage loads many overlapping custom CSS layers in addition to the built Tailwind bundle. |
| Trust and conversion | Verification required | Homepage claims such as `1K+ Sold`, `4.9 on Trustpilot`, and `Best seller` need a verifiable source before launch. |
| Documentation | Medium risk | README content no longer matches the current repository, port, hosting choice, or page structure. |
| Automated quality checks | Not established | The current package scripts expose development, build and preview only; no lint, validation, broken-link or performance checks are defined. |

## Verified repository facts

### Stack

- Vite 5 multi-page build
- Tailwind CSS 3.4
- Vanilla JavaScript
- Static HTML product and collection pages
- Terser production minification
- Netlify hosting is the intended production target

### Current build model

`vite.config.js` scans the repository root and adds every `.html` file as a Rollup entry. This avoids client-side framework overhead, but it also means shared markup and SEO metadata can drift between many independently maintained pages.

### Current SEO state

The homepage, `robots.txt`, and `sitemap.xml` still reference:

```text
https://alkavisuals.github.io/legend-stories-website
```

This must be corrected before the official domain is indexed. A single production origin should drive canonical URLs, Open Graph URLs, robots and sitemap generation.

### Current media risk

The latest baseline commit adjusts full-screen autoplay video heroes on four collection pages:

- `combat-legends.html`
- `music-legends.html`
- `sport-legends.html`
- `wisdom-legends.html`

The videos use `preload="metadata"`, which is better than eagerly preloading the full file, but full-screen MP4 backgrounds still require mobile performance, data usage, accessibility and reduced-motion testing.

### Current source-control workflow

No pull requests were found for this repository at the time of the audit. The current baseline branch is the first step toward a consistent workflow:

1. branch from current `main`;
2. make a focused change;
3. validate the build and affected user path;
4. open a pull request;
5. review the Netlify deploy preview;
6. merge only after explicit approval.

## Required measurements

The following measurements must be captured against the real production or Netlify deploy-preview URL. They cannot be reliably inferred from repository source alone.

### Performance baseline

Capture mobile and desktop Lighthouse results for:

1. Homepage
2. One collection page with autoplay video
3. One representative product page
4. Shop page
5. Cart interaction or checkout handoff

Record at minimum:

- Performance score
- Accessibility score
- Best Practices score
- SEO score
- Largest Contentful Paint
- Interaction to Next Paint
- Cumulative Layout Shift
- Total Blocking Time
- transferred page weight
- image bytes
- video bytes
- JavaScript bytes
- CSS bytes

### Functional baseline

Test the complete customer path on iPhone-sized mobile, Android-sized mobile and desktop:

1. Land on homepage
2. Open mobile navigation
3. Browse a category
4. Open a product
5. Select size or variant
6. Change quantity
7. Add to cart
8. Reopen and edit cart
9. Continue to checkout or the configured order handoff
10. Return using browser back/forward navigation

Record console errors, broken links, missing media, focus traps, layout overflow and dead controls.

### SEO baseline

Verify:

- one unique title per indexable page;
- one meta description per indexable page;
- one canonical URL per page;
- correct Open Graph image and URL;
- valid sitemap containing only canonical indexable pages;
- valid robots reference to the production sitemap;
- no legacy GitHub Pages URLs in production output;
- product, breadcrumb and organization structured data status;
- 404 response and page behavior;
- custom-domain and HTTPS redirect behavior.

## Phase 0 exit criteria

Phase 0 is complete when:

- [x] A protected working branch exists.
- [x] The current baseline commit is recorded.
- [x] Repository, architecture, SEO, media and workflow risks are documented.
- [ ] The official production or deploy-preview URL is identified.
- [ ] Mobile and desktop Lighthouse reports are captured for the five key paths.
- [ ] The complete purchase path is tested on mobile and desktop.
- [ ] Broken links and browser-console errors are recorded.
- [ ] The largest media assets and unused assets are inventoried.
- [ ] A prioritized implementation backlog is approved.

## Proposed implementation order after measurement

### P0 — Release blockers

1. Replace the legacy GitHub Pages production origin.
2. Version Netlify build, redirect, cache and security configuration.
3. Generate sitemap and robots output from one production site URL.
4. Remove or substantiate unverified trust claims.
5. Fix any broken purchase-path behavior or console errors.

### P1 — Performance and maintainability

1. Inventory and optimize large PNG and MP4 assets.
2. Add responsive image delivery and explicit dimensions.
3. Provide reduced-motion and lower-cost mobile hero behavior.
4. Consolidate overlapping CSS layers.
5. Add automated build, link and metadata validation.

### P2 — Scalable storefront architecture

1. Centralize product data.
2. Generate product pages from a shared template.
3. Centralize header, footer, cart and SEO components.
4. Generate sitemap and metadata automatically.
5. Introduce an appropriate CMS or commerce backend only when operational requirements justify it.

## Constraints and audit limitations

The GitHub connector provides repository inspection and write access, but it does not provide a browser runtime, Netlify deploy logs, a local checkout, or Lighthouse execution in this chat. Therefore this document does not invent numeric performance scores or claim that the production build was run.

The next measurement step requires the real Netlify production URL or deploy-preview URL. Once available, the baseline can be completed with observed results rather than estimates.
