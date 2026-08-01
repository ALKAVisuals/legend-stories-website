# Sprint 1 — Completion Record

Sprint 1 is complete when the same deterministic quality gate protects both pull requests and the merged `main` branch.

## Completed foundations

- repository and SEO/link audit tooling;
- deterministic multi-page production build validation;
- classic runtime JavaScript copied into the production output;
- pure pricing and shipping boundaries with unit tests;
- CSS ownership rules and duplicate-selector reporting;
- batch-aware product-data generation proof of concept;
- media inventory, budgets and preservation policy;
- GitHub Actions artifacts for generated audit reports.

## Continuous verification

The `Quality checks` workflow runs `npm ci` and `npm run quality` for:

- every pull request targeting `main`;
- every push to `main` after merge;
- manual workflow dispatches.

A green pull-request run proves the proposed change. A green post-merge run proves the exact commit stored on `main`.

## Explicit Sprint 2 scope

The following are migrations built on top of Sprint 1, not unfinished Sprint 1 foundation work:

- replacing live product pages with generated product pages after parity testing;
- connecting the pure commerce modules to the live cart and checkout UI;
- consolidating legacy CSS with visual-regression evidence;
- creating and deploying optimized media derivatives;
- resolving placeholder links and the documented `portfolio.html` baseline exception;
- production-domain, Netlify and live Lighthouse configuration.
