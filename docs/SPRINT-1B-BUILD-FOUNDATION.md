# Sprint 1B — Safe Build Foundation

## Scope

This sprint strengthens the existing Vite build without introducing hosting-specific behavior.

## Changes

- production builds now run a deterministic output validator;
- classic runtime scripts are copied explicitly to `dist/js/` because the current HTML loads them without `type="module"`;
- the validator checks that the expected multi-page output exists;
- every built HTML page must contain a title, meta description and H1;
- local `href` and `src` references are checked against the built `dist/` output;
- the build fails when a generated page references a missing local file;
- known pre-existing exceptions must be listed explicitly in `config/build-validation-baseline.json`.

## Current baseline exception

`index.html` still references `portfolio.html`, which does not exist. The repository audit continues to report this issue. The build validator temporarily allows only this exact reference so new missing references still fail CI. The exception must be removed when the link receives a real destination.

## Deliberately deferred

The following remain deferred until the final domain and Netlify project exist:

- canonical origin rewriting;
- generated production sitemap URLs;
- Netlify redirects, headers and caching configuration;
- production Lighthouse and response-header checks.

## Commands

```bash
npm run audit
npm run build
```

The `build` command runs Vite, copies the classic JavaScript runtime files and validates the complete output.
