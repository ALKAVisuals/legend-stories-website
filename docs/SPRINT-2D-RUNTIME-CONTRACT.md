# Sprint 2D — Browser Runtime Contract

## Goal

Stabilize and measure the current classic JavaScript runtime before converting `app.js`, `componentry.js` and `skipper.js` to modules across 118 pages.

## Confirmed runtime defect repaired

The `app.js` initialization array contained dozens of product record objects after the real initialization functions. The runtime loop attempted to call every entry, so each product object generated a caught `TypeError` on every page that loaded `app.js`.

The repair:

- removes all product objects from the initializer;
- keeps only 16 named initialization functions;
- preserves the current initialization order;
- corrects the product routes for `The Truth Seeker` and `Mamba Mindset`;
- removes checkout debug logging from the production runtime.

No cart calculation, product price, checkout rule or visual behavior was intentionally changed.

## Permanent runtime audit

`npm run audit:runtime` now scans the complete browser-runtime contract.

### Hard failures

The quality gate fails for:

- invalid JavaScript syntax in files under `js/`;
- missing local script files referenced by a site page;
- duplicate local script references on one page;
- static `.html` routes in browser JavaScript that do not exist;
- malformed or non-function entries in the `app.js` initializer;
- production checkout debug logging;
- inline or dynamically generated handlers that require an unresolved `window.*` global.

Browser-provided globals such as `window.location` are explicitly distinguished from application globals.

### Migration baseline

The audit reports, but does not yet fail for:

- classic script references still using the compatibility copy step;
- executable inline scripts;
- inline event handlers;
- differences in local script order between pages.

These are migration metrics, not hidden exceptions. Their counts are included in `reports/runtime-audit.json` and `reports/runtime-audit.md` on every quality run.

## Tests

The Node test suite covers:

- classic, module and non-executable script parsing;
- inline handler extraction without counting HTML strings inside scripts;
- global export and handler dependency discovery;
- static HTML route extraction;
- valid initializer lists;
- rejection of product records inside the initializer.

## Why scripts are not converted to modules in this sprint

The current pages contain hundreds of inline handlers and depend on browser globals such as `window.legendApp`. Converting script tags to `type="module"` before removing those dependencies could change execution order and break cart, navigation, overlays, effects or checkout behavior.

Sprint 2D creates the enforceable contract needed for an incremental migration. The next runtime sprint can move one responsibility at a time behind tested module boundaries while tracking the baseline toward zero classic references and zero inline handlers.

## Definition of done

- the confirmed initializer defect is removed from source;
- GitHub Actions permissions are read-only;
- runtime audit reports zero hard errors;
- all runtime parser tests pass;
- product inventory and Batch 3 parity remain green;
- dependency audit remains at zero findings;
- the Vite production build and output validation pass;
- the pull request is squash-merged only after the latest quality run succeeds.
