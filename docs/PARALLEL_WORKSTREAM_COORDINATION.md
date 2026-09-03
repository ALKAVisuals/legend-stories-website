# LegendMural — Parallel Website / V3 Workstream Coordination

**Last updated:** 2026-09-03  
**Repository:** `ALKAVisuals/legend-stories-website`  
**Purpose:** prevent the public website / launch-readiness chat and the separate V3 Commerce / Orders / Invoices chat from modifying overlapping responsibilities in the shared storefront repository.

> **MANDATORY:** every chat that changes this repository must read `docs/READ_ME_FIRST.md`, the current public-site handoff and this file before creating a branch or changing code.

## 1. Legitimate parallel workstreams

### Public website / launch-readiness

Owns primarily:

- storefront UI/UX and responsive/mobile refinement;
- homepage, shop and product-page presentation;
- general public content;
- Privacy / Terms / Shipping / Returns;
- AVG/privacy launch-readiness;
- GPSR/product-safety presentation;
- SEO and canonical/Open Graph/final-domain metadata;
- other customer-facing launch work that does not alter V3 commerce/invoice/delivery internals.

### V3 Commerce / Orders / Invoices

The separate V3 chat owns:

- order/invoice lifecycle and immutable invoice snapshot logic;
- V3 invoice delivery reads;
- Neon invoice/notification persistence used by V3;
- claim-token and lease ownership;
- PDF artifact metadata;
- V3 PDF renderer and customer invoice email delivery;
- Profile-0/Profile-1 routing;
- V3 delivery orchestration;
- retry/reconciliation semantics;
- V3 production cutover only when separately approved.

The canonical V3 handoff lives in `ALKAVisuals/legendmural-dashboard`.

## 2. V3-reserved paths and responsibilities

The public website workstream must **not modify these paths or their V3 responsibilities without explicit cross-track coordination**:

```text
server/invoices/**
server/notifications/**
server/adapters/neon-order-notification-store.mjs
server/adapters/neon-paid-order-finalizer.mjs
server/netlify/paid-order-notification-runtime.mjs
server/api/capture-paypal-order.mjs
server/payments/paypal-webhook-reconciliation.mjs
```

Also reserved to V3:

- V3 order/invoice/notification migrations;
- immutable invoice snapshot schema/validation;
- official order/invoice identity allocation;
- paid-order finalization semantics;
- V3 PDF/email delivery semantics;
- notification claim-token, lease and artifact metadata;
- Profile-0/Profile-1 routing;
- V3 retry/replay behavior.

This boundary is responsibility-based, not only filename-based. If a website change would alter one of these behaviors through another file, stop and coordinate first.

## 3. Stop-and-coordinate rule

If public website work appears to require a V3-reserved file or behavior:

1. do not modify it;
2. identify the exact file/path and dependency;
3. re-check the current V3 handoff in `legendmural-dashboard`;
4. coordinate with the owner/V3 workstream before proceeding.

Likewise, the V3 workstream should not redesign unrelated public website/legal/SEO presentation while executing a V3 backend step.

## 4. Shared GitHub rules

Because both workstreams share this repository:

1. fresh-check `main` immediately before every new branch;
2. use a dedicated feature branch for each workstream;
3. keep each PR limited to one workstream;
4. immediately before merge, re-check whether `main` moved;
5. if `main` moved, compare/rebase/update and rerun relevant tests/CI before merge;
6. never merge or revive an old V3 PR merely because it remains open;
7. never assume a previously recorded SHA is still current;
8. every completed step must report starting `main`, branch/PR, changed files and whether `main` moved during the work.

## 5. Coordination checkpoint

At the time this contract was added:

```text
storefront main: c39776393f962e904a2601298b523eedbf324bb2
PR #164: V3 Slice A MERGED
PR #165: public website launch-readiness handoff MERGED
V3 next area: Gate-3 Slice B
public website next area: Privacy / AVG Blocker B
```

This is only a checkpoint. **Always fresh-check current `main` before work.**

## 6. Production safety

Neither workstream may, without explicit owner approval for that exact action:

- deploy/publish Netlify Production;
- enable PayPal Live;
- enable Production email sending;
- apply V3 production migrations;
- activate V3 Profile 1;
- issue live V3 invoices;
- perform a real production payment/email proof.

GitHub branch/PR/merge work is not authorization for those production actions.

## 7. Conflict priority

If instructions conflict:

1. newest GitHub repository state;
2. this coordination contract for cross-workstream boundaries;
3. the current handoff for the active workstream;
4. old chat history last.

When uncertain whether a change belongs to the website or V3 workstream, fail closed: **stop and coordinate instead of modifying shared commerce code.**
