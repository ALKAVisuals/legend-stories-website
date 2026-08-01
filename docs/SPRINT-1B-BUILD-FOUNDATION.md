# Sprint 1B — Safe Build Foundation

## Scope

This sprint strengthens the existing Vite build without introducing hosting-specific behavior.

## Changes

- production builds now run a deterministic output validator;
- the validator checks that the expected multi-page output exists;
- every built HTML page must contain a title, meta description and H1;
- local `href` and `src` references are checked against the built `dist/` output;
- the build fails when a generated page references a missing local file.

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

The `build` command includes `scripts/validate-build.mjs` automatically.
