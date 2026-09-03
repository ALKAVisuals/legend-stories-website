# LegendMural — Parallel Website / V3 Workstream Coordination

**Last updated:** 2026-09-03  
**Repository:** `ALKAVisuals/legend-stories-website`  
**Purpose:** prevent the public-website chat and the separate V3 Commerce / Orders / Invoices chat from modifying the same technical responsibility or invalidating each other's reviewed work.

> **MANDATORY:** every chat that changes this repository must read `docs/READ_ME_FIRST.md`, the current production-status handoff, and this file before creating a branch or changing code.

## 1. Two legitimate parallel workstreams

Two chats may work in this repository at the same time only when their scope remains non-overlapping.

### A. Public website / launch-readiness workstream

This workstream owns primarily customer-facing website work such as:

- storefront UI/UX and responsive/mobile refinement;
- homepage, shop and product-page presentation;
- general customer-facing content;
- Privacy / Terms / Shipping / Returns content;
- AVG/privacy launch-readiness;
- GPSR/product-safety presentation;
- SEO and canonical/Open Graph metadata;
- `legendmural.com` final-domain metadata;
- other launch-readiness work that does not change V3 commerce/invoice/delivery internals.

### B. V3 Commerce / Orders / Invoices workstream

The separate V3 chat owns the V3 backend and delivery chain, including:

- order/invoice lifecycle and immutable invoice snapshot logic;
- V3 invoice delivery reads;
- Neon invoice/notification persistence used by V3;
- claim-token and lease ownership;
- PDF artifact metadata;
- V3 PDF renderer and customer invoice email renderer;
- V3 Resend invoice delivery;
- Profile-0/Profile-1 routing;
- V3 delivery orchestration;
- retry/reconciliation design and implementation;
- V3 production cutover only when separately approved.

The canonical V3 execution handoff lives in `ALKAVisuals/legendmural-dashboard`, starting with:

```text
docs/READ_ME_FIRST.md
docs/CHAT_ROUTING.md
docs/CURRENT_STATUS.md
docs/V3_READ_ME_FIRST.md
```

## 2. V3-reserved paths and responsibilities

The public-website workstream must **not modify these paths or their V3 responsibilities without explicit coordination**:

```text
server/invoices/**
server/notifications/**
server/adapters/neon-order-notification-store.mjs
server/adapters/neon-paid-order-finalizer.mjs
server/netlify/paid-order-notification-runtime.mjs
server/notifications/paid-order-notifications.mjs
server/api/capture-paypal-order.mjs
server/payments/paypal-webhook-reconciliation.mjs
```

Also reserved to the V3 workstream:

- V3 order/invoice/notification database migrations;
- immutable invoice snapshot schema/validation;
- paid-order finalization and official order/invoice identity allocation;
- V3 notification claim-token, lease and artifact-metadata behavior;
- V3 invoice PDF bytes/versioning;
- V3 customer invoice email/Resend behavior;
- Profile-0/Profile-1 routing;
- V3 retry/replay semantics.

This list is responsibility-based, not merely filename-based. If a website change would alter any of these behaviors through another file, stop and coordinate first.

## 3. Stop-and-coordinate rule

If public website work appears to require a V3-reserved file or behavior:

1. **Do not modify it.**
2. Record the exact file/path and reason the website task appears to depend on it.
3. Re-check the current V3 handoff in `legendmural-dashboard`.
4. Ask the owner to coordinate the change with the V3 workstream before proceeding.

Likewise, the V3 workstream should not redesign customer-facing website/legal/SEO presentation unless that presentation is directly required by the active V3 step and is explicitly coordinated.

## 4. Shared-repository Git rules

Because both workstreams share `ALKAVisuals/legend-stories-website`:

1. Fresh-check `main` immediately before every new branch.
2. Use a dedicated feature branch; never write website implementation directly to `main`.
3. Keep each PR scoped to one workstream.
4. Before merge, re-check whether `main` moved since the branch was created.
5. If `main` moved, compare/rebase/update the branch and rerun relevant tests/CI before merge.
6. Never merge or revive an old V3 PR merely because it remains open; verify current GitHub handoffs first.
7. Never assume a previously recorded SHA is still current.
8. Every workstream report must state the branch, starting `main` SHA, changed files, and whether `main` moved during the work.

## 5. Current coordination checkpoint

Checkpoint at the time this coordination contract was written:

```text
storefront main: c6ee0faf357e4943b4ddc0e92335748c20c00c99
V3 PR #164: MERGED
V3 next implementation area: Gate-3 Slice B
public website next launch-readiness area: Privacy Blocker B
```

This is a historical checkpoint only. **Always fresh-check current `main` before work.**

## 6. Production safety

Neither parallel workstream may, without explicit owner approval for that exact action:

- deploy or publish Netlify Production;
- enable PayPal Live;
- enable Production email sending;
- apply V3 production migrations;
- activate V3 Profile 1;
- issue live V3 invoices;
- perform a real production payment/email proof.

GitHub branch/PR work is not authorization for any of those production actions.

## 7. Conflict priority

If instructions conflict:

1. newest GitHub repository state;
2. this coordination contract for cross-workstream boundaries;
3. the current handoff for the active workstream;
4. old chat history last.

When uncertain whether a change belongs to the website or V3 workstream, fail closed: **stop and coordinate instead of modifying shared commerce code.**
