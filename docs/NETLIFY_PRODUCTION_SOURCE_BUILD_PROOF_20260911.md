# Netlify Production source build proof — 2026-09-11

## Purpose

Prove, without touching Netlify Production or any external hosting configuration, whether the exact source commit behind the currently reported Netlify Production deploy can still produce and serve the expected static storefront artifact.

This proof does **not** repair or redeploy Netlify. It isolates source/build correctness from the existing Netlify 404 state.

## Pinned source

```text
Repository: ALKAVisuals/legend-stories-website
Netlify Production source commit: 95a57e8f05a0af547efa0dfc4d044b8a96de7fe3
Node major required by pinned netlify.toml: 22
Publish directory: dist
```

The pinned `netlify.toml` declares `npm run build && node scripts/generate-commerce-runtime-config.mjs`, publishes `dist`, and uses Node 22. The runtime-config generation consumes only the three public same-origin endpoint paths used by the historical Netlify configuration; no application/provider secret is required for this static proof.

## GitHub proof run

```text
Workflow: Netlify Production source build proof
Run ID: 34590681486
PR: #242
Proof branch head for this run: 959936be524ed3f9257fd729cc3213e687355d7b
Policy job ID: 103235024089
Build job ID: 103235087481
Result: success
Repository permission: contents: read
Provider credentials used: false
Provider/runtime mutation performed: false
```

The policy gate passed before the build job and forbids provider credentials, provider deploy commands, external mutation methods, Git ref writes, and non-localhost HTTP probes.

## Clean build result

The build job checked out the exact pinned source commit separately from the proof controls and ran under Node `22.23.2` / npm `10.9.8`:

```text
npm ci
npm run build
node scripts/generate-commerce-runtime-config.mjs
```

The build completed successfully. The pinned repository's own build validator reported:

```text
Build validation passed for 127 HTML pages and 293 output files.
```

The independent verifier then recorded:

```text
Publish directory: dist
File count: 293
Total bytes: 78,951,418
```

Required rollback/static files were present and non-empty:

| File | Bytes | SHA-256 |
|---|---:|---|
| `index.html` | 88,547 | `b9be756a4b7e7849cdedccef022f24cf934474469ac031e132dd10b423b78f69` |
| `shop.html` | 200,152 | `fabe68d3836ba95b08f0bf3230d48f7898b8248638e95fc79952ae3ac08fdf8f` |
| `robots.txt` | 68 | `7d58dea45a79ab075d95f798688c45c7536655a737afacdcd776cf0392d9ac26` |
| `sitemap.xml` | 10,278 | `c2f4d6618e38e58dbbaa68e04ef0414dff1d2925434174593f04416523385f69` |
| `js/commerce/runtime-config.mjs` | 278 | `e1b1b137eef5d8a05826abcf2663f6ccc774f216b482457bb957928f4b745b2e` |

The generated commerce runtime config contained the expected same-origin paths:

- `/api/paypal/checkout`
- `/api/order-status`
- `/api/paypal/capture`

No absolute external application origin was introduced by this generated public config.

## Local serving proof

The generated `dist` was served only on GitHub's local CI runner using Vite preview at `127.0.0.1:4173`.

All required probes succeeded:

```text
/            -> 200
/index.html  -> 200
/shop.html   -> 200
/robots.txt  -> 200
/sitemap.xml -> 200
```

This proves that the exact historical Production source commit still produces a static artifact that can be served successfully when built cleanly outside Netlify Production.

## Compact proof artifact

```text
Artifact name: netlify-production-source-build-proof
Artifact ID: 10195505491
Artifact ZIP bytes: 981
Artifact SHA-256: b88801cc04da860b2906020e78185d6f4e0aec181e4bc6fee9b93c511ca36e5d
Retention: 7 days
```

The compact artifact contains the JSON manifest with source SHA/file hashes/tree metrics and the local Vite preview log. The evidence needed for continuation is also recorded in this document so the migration does not depend on artifact retention.

## Interpretation

The existing Netlify 404 cannot be reproduced from the pinned source/build contract alone:

- the exact source commit still builds;
- `dist/index.html` and the other required static files exist;
- the built output serves HTTP 200 locally;
- the existing Netlify immutable deploy permalink still returns 404 according to the earlier read-only account-routing proof.

Therefore the current evidence rules out a missing/invalid source artifact as the simple explanation for the 404. It does **not** prove the internal Netlify cause, and no Netlify setting or Production deploy should be changed merely to diagnose it without separate approval.

## Rollback status after this proof

The source artifact is now proven **buildable and locally serveable**, but there is still no independently reachable rollback URL. The existing immutable Netlify Production deploy remains unusable as rollback because it returns 404.

The next action must be to prepare one independently testable rollback serving target from the proven artifact/source **without changing the current public domain**. Creating or publishing such an external hosting target is a separate external mutation and requires explicit owner approval for the exact action before execution.

Until that target is HTTP-successful and recorded, the Cloudflare Production domain/nameserver cutover remains blocked.
