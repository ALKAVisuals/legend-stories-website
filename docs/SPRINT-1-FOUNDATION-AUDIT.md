# Sprint 1 — Foundation Audit

Baseline branch: `audit/phase-0-baseline`

This audit extends Phase 0 with a concrete technical-debt map and implementation order. It is intentionally documentation-only: no storefront code, layout, cart behavior or deployment configuration is changed in this sprint.

## Executive conclusion

LegendMural has a fast static foundation, but the codebase has grown through repeated page-level additions and visual patches. The current architecture is still usable, but it is approaching the point where every new product, effect or checkout change creates disproportionate maintenance risk.

The main long-term risks are:

1. product pages are represented by many separate root-level HTML files;
2. shared storefront markup is repeated across pages;
3. CSS responsibilities overlap between Tailwind and multiple custom style layers;
4. `js/app.js` combines application state, cart, shipping, discounts, checkout, DOM rendering and unrelated UI behavior;
5. large unversioned media assets dominate repository size and page-weight risk;
6. business-critical pricing and shipping rules live only in browser JavaScript;
7. SEO and deployment details are maintained manually;
8. there is no automated build, link or regression gate before changes reach `main`.

## Current architecture

### Build

- Vite 5 builds every root-level `.html` file as an independent entry.
- Terser minification is enabled.
- Sourcemaps are disabled.
- There is no current test, lint, validation or audit script in `package.json`.

### Presentation

- Tailwind CSS is used heavily in page markup.
- A second custom utility/component layer exists in `css/components.css`.
- Additional visual systems are loaded as separate files, including Axis, Skipper, matrix and metal-effect styles.
- The homepage includes substantial page-specific inline JavaScript for Swiper and visual state.

### Application behavior

`js/app.js` currently owns all of the following concerns:

- global mutable state;
- localStorage persistence;
- cart rendering;
- cart quantity and total calculations;
- country selection;
- shipping zones and free-shipping thresholds;
- discount state;
- checkout UI;
- mobile navigation;
- sliders, testimonials, filters and scroll behavior;
- global browser API exposure through `window.legendApp`.

This is a classic “god file”: a change in one area can accidentally affect unrelated behavior.

## Technical-debt map

### TD-01 — Repeated HTML storefront shell

**Severity:** Critical  
**Impact:** Maintainability, accessibility, SEO consistency, defect risk

Headers, footers, cart drawers, navigation and likely product layouts are repeated across many HTML files. A single shared change can require edits across a large catalog.

**Target state:** build-time templates or reusable partials generate static HTML from shared components.

**Do not do:** migrate immediately to React solely to solve includes. Static generation is sufficient at this stage.

### TD-02 — Product data embedded in pages

**Severity:** Critical  
**Impact:** Catalog scale, pricing consistency, SEO, content operations

Product names, prices, images, category metadata and descriptions appear to be maintained inside individual pages and event handlers.

**Target state:** one validated product-data source with generated collection and product pages.

Recommended first schema:

```json
{
  "slug": "music-truth-seeker",
  "name": "The Truth Seeker",
  "category": "music",
  "price": 49.95,
  "currency": "EUR",
  "images": [],
  "description": "",
  "seo": {
    "title": "",
    "description": ""
  }
}
```

### TD-03 — CSS ownership is unclear

**Severity:** High  
**Impact:** Visual regressions, payload, development speed

`components.css` duplicates Tailwind-like typography and utility classes. It also contains repeated rules such as duplicate `.btn-lg` and `.btn-sm` definitions. The homepage loads many effect and upgrade stylesheets simultaneously.

**Target state:**

- Tailwind owns layout, spacing and simple utilities;
- `tokens.css` owns brand variables;
- component CSS owns semantic reusable components only;
- effect CSS is isolated and opt-in;
- no “upgrade” or patch stylesheet remains without a defined owner.

### TD-04 — Monolithic application JavaScript

**Severity:** Critical  
**Impact:** Cart reliability, checkout safety, testability

`js/app.js` mixes business rules with DOM manipulation and visual interactions. Shipping zones and discount state are client-side and directly mutable.

**Target modules:**

```text
js/
├── core/
│   ├── storage.js
│   └── events.js
├── commerce/
│   ├── cart-store.js
│   ├── pricing.js
│   ├── shipping.js
│   └── checkout.js
├── ui/
│   ├── cart-drawer.js
│   ├── mobile-menu.js
│   ├── filters.js
│   └── sliders.js
└── app.js
```

`app.js` should become a small composition entrypoint.

### TD-05 — Business rules are trusted from the browser

**Severity:** Critical before real payments  
**Impact:** Revenue, fraud, incorrect order totals

Prices, discounts and shipping totals calculated in browser JavaScript cannot be considered authoritative for a real checkout.

**Target state:** the payment or commerce backend recalculates and validates all totals. The browser may display estimates only.

### TD-06 — Media repository and delivery risk

**Severity:** High  
**Impact:** Git performance, Netlify builds, LCP, mobile data

Repository metadata reports approximately 383 MB. Video heroes and large PNG murals are likely the main drivers.

**Target state:**

- separate source/print assets from web delivery assets;
- inventory every referenced media file;
- detect unused files;
- define maximum dimensions and byte budgets;
- generate AVIF/WebP variants;
- use responsive images;
- preserve source originals outside the deployed web tree where appropriate.

### TD-07 — Inline page scripts and event handlers

**Severity:** High  
**Impact:** CSP compatibility, reuse, debugging

The homepage contains a large inline Swiper configuration with repeated slide-state code. Markup also includes inline `onclick` handlers for cart upsells.

**Target state:** external modules and `data-*` attributes with delegated event listeners.

### TD-08 — Placeholder and incomplete navigation

**Severity:** High for conversion  
**Impact:** Trust, user journey, legal readiness

Footer links such as Shipping, Returns, FAQ and Privacy currently use `href="#"`. The contact form visibly has no confirmed submission integration in the audited markup.

**Target state:** real destination pages and a tested form submission path before launch.

### TD-09 — Manual SEO origin and sitemap

**Severity:** High before launch  
**Impact:** Indexing, duplicate URLs, social previews

Canonical, Open Graph, robots and sitemap references currently point to the legacy GitHub Pages origin.

**Target state:** build-generated URLs from one configured production origin. This belongs in the deployment foundation phase, not the current documentation-only sprint.

### TD-10 — No automated quality gate

**Severity:** High  
**Impact:** Regression frequency, confidence, release safety

There is no automated evidence that all pages build, local links resolve, required metadata exists or critical scripts parse.

**Minimum gate:**

1. `npm ci`
2. `npm run build`
3. HTML validation or structural checks
4. internal link and asset reference check
5. duplicate canonical/title check
6. JavaScript syntax/lint check
7. deploy preview before merge

### TD-11 — Direct-to-main workflow history

**Severity:** High process risk  
**Impact:** Rollback and review safety

The repository had no pull-request history before the Phase 0 audit, while recent feature and fix commits landed directly on `main`.

**Target state:** protected `main`, focused branches, draft PRs, build checks and explicit approval.

## Proposed execution order

### Sprint 1A — Repository observability

Documentation and non-invasive tooling only:

- add a repeatable repository inventory script;
- report file counts and largest assets;
- add an internal-link and missing-asset checker;
- add a metadata consistency report;
- add a single `npm run audit` command;
- do not change visuals or commerce behavior.

### Sprint 1B — Safe build foundation

- add reproducible Netlify configuration when hosting is introduced;
- generate canonical, robots and sitemap output;
- add build validation;
- introduce deploy previews;
- protect `main`.

### Sprint 1C — JavaScript boundaries

Refactor without changing user-visible behavior:

1. extract pure pricing and shipping functions;
2. add unit tests for totals and thresholds;
3. extract cart persistence;
4. separate cart state from rendering;
5. move page-specific effects out of global app logic.

### Sprint 1D — CSS ownership

- map selectors to actual usage;
- remove exact duplicates;
- decide Tailwind versus semantic component ownership;
- consolidate patch styles only after visual regression comparison;
- preserve the current design during refactor.

### Sprint 1E — Product generation proof of concept

- select two representative product pages;
- model them as structured data;
- generate both pages from one template;
- compare rendered output and SEO metadata;
- only scale after parity is proven.

### Sprint 1F — Media pipeline

- inventory and classify media;
- establish web image/video budgets;
- optimize one category and compare quality/performance;
- automate derivative generation;
- do not delete source assets until references and backups are verified.

## Initial acceptance criteria

The foundation is ready for feature development when:

- `main` cannot be modified without a reviewed PR;
- one command validates the entire static site;
- no broken internal links or missing assets remain;
- product, price and shipping logic have explicit owners;
- cart calculations are testable without the DOM;
- shared layout changes require one source edit;
- a product page can be generated from validated data;
- web media has defined byte and dimension budgets;
- production SEO URLs are generated from one origin.

## Explicit non-goals

- no framework migration in Sprint 1;
- no visual redesign during architecture refactors;
- no checkout provider selection until totals and product data are centralized;
- no destructive media deletion without a verified inventory;
- no merge to `main` without review and successful validation.
