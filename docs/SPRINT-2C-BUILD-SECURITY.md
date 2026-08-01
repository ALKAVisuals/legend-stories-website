# Sprint 2C — Build Security and Configuration Modernization

## Goal

Remove known dependency vulnerabilities and deprecated configuration paths without changing the live storefront, product catalog, cart behavior, styling or media.

## Dependency findings before remediation

The machine-readable npm audit identified three findings:

- `postcss`: high severity, direct dependency;
- `vite`: high severity, direct dependency;
- `esbuild`: moderate severity, transitive through Vite.

## Remediation

- Vite upgraded from the Vite 5 line to stable `6.4.3`;
- PostCSS upgraded to `8.5.23`;
- the generated npm lockfile was committed so GitHub Actions uses the exact validated dependency tree;
- the resulting dependency audit reports zero vulnerabilities;
- the quality gate blocks all future high and critical npm findings;
- moderate, low and informational findings remain visible in the uploaded audit report for planned maintenance.

The project deliberately did not follow npm's suggested jump to a prerelease/large-major Vite target. The selected Vite 6 release is the smallest stable version outside the affected range and passed the complete LegendMural quality gate.

## Native ESM configuration

- `vite.config.js` was replaced by `vite.config.mjs`;
- `postcss.config.js` was replaced by `postcss.config.mjs`;
- both files now use explicit native ESM;
- the previous Vite CJS and PostCSS module-format warnings are removed.

## Validation

The upgraded dependency tree passed:

- clean `npm ci` installation from the committed lockfile;
- dependency audit with zero findings;
- repository, CSS and media audits;
- inventory validation for 111 product pages;
- complete Batch 3 catalog parity for 20 products;
- all unit tests;
- Vite 6 production build;
- output validation for 118 HTML pages and 243 generated files.

## Explicitly deferred

Vite still reports that the legacy classic scripts (`js/app.js`, `js/componentry.js` and `js/skipper.js`) are not bundleable without `type="module"`. They are currently copied intentionally into `dist/js/` by the compatibility build step.

Those scripts depend on browser globals and inline page behavior. Changing them to modules across 118 pages without a dedicated runtime migration could break cart, menu, animation and overlay behavior. Their migration belongs in a separate Sprint 2 runtime task with focused tests and parity validation.

## Definition of done

- committed lockfile matches `package.json`;
- `npm ci` succeeds without modifying the lockfile;
- dependency report contains zero high and zero critical findings;
- complete quality gate is green;
- workflow permissions remain read-only;
- no live storefront behavior is changed.
