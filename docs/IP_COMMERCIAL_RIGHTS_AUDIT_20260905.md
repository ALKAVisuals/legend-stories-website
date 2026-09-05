# LegendMural — IP / commercial-rights audit

**Date:** 2026-09-05  
**Scope:** public website launch-readiness / Blocker E  
**Repository baseline:** `main` at `ec5e7817774cb6082a1c71f59dadf612fca4c2ff`  
**Status:** repository audit complete; owner confirmations 1–3 recorded; remaining person/title clearance intentionally deferred

## Purpose

This document records the concrete copyright, portrait/personality-right and trademark exposures visible in the current LegendMural storefront. It is an inventory and launch-control record, not a legal opinion and not a finding that any listed design infringes third-party rights.

The repository can show which designs, titles and marketing assets are offered publicly. It cannot independently prove who created every underlying artwork, which references were used, or whether permissions/licences exist outside the repository. Final commercial clearance therefore remains an owner/legal decision where still applicable.

## Scope reviewed

- the managed catalogue of **111 products** in `data/products/catalog.json`;
- public product titles, slugs, descriptions and image paths;
- the public homepage showcase / portfolio in `index.html`;
- obvious repository filename-level references to well-known people, entertainment properties, sports brands and leagues.

No V3 Commerce / Orders / Invoices implementation is in scope for this audit.

## Main result

The public product catalogue largely uses generic or original-facing names such as `The Balanced Mind`, `Constant Evolution`, `Pure Ambition`, `True Freedom` and similar titles. The repository review did not find obvious filename-level references to `Nike`, `Adidas`, `NBA`, `UFC`, `Jordan` or `Kobe`.

That is useful risk reduction, but it is **not** repository proof that every visual or title is commercially cleared. Owner confirmations and, where needed, external legal clearance remain the controlling evidence.

## Owner confirmations recorded on 5 September 2026

The owner explicitly confirmed the following three launch facts:

1. **Artwork provenance:** all sticker artworks are created by LegendMural/Alka Group and are not literal copies or traces of third-party photographs or artwork taken from the internet for commercial sale.
2. **Official logos:** the final sticker artworks do not contain official brand, club, team or league logos.
3. **Lyrics / long quotations:** the final sticker artworks do not reproduce literal song lyrics or long third-party quotations.

These confirmations close those three owner-information questions for the current launch review. They are internal launch-control evidence; they are **not** customer-facing website claims and do not require a disclaimer or rights statement on the public storefront.

## Remaining items intentionally deferred

### 1. Recognizable people in homepage / showcase assets

The homepage currently contains or references the following assets/labels:

- `media/beforeafter/LM_tupac_after.png`, with visible copy `After — Tupac Mural`;
- `media/voorbeelden/Tupac_bedroom.png` / `.webp`;
- `media/voorbeelden/Arnold S..png` / `.webp`;
- `media/voorbeelden/Ice Cube.png` / `.webp`;
- `media/voorbeelden/Ibrahimovic.png` / `.webp`;
- `media/voorbeelden/Mike T..png` / `.webp`;
- `media/voorbeelden/Fightclub.png` / `.webp`.

The customer-facing portfolio card labels themselves are mostly generic (`West Coast Room`, `Power Room`, `Underground`, `90s Vibes`, `Champion's Wall`, `Knockout Room`). The remaining question is commercial use of recognizable likenesses/source material.

**Owner direction:** revisit this clearance question later. Do **not** add public website wording about permissions, rights status or this internal launch gate merely to document the deferment.

### 2. `Mamba Mindset`

The managed catalogue contains:

- Product ID: `LM-2026-00056`
- public name: `Mamba Mindset`
- page: `sport-mamba-mindset.html`
- image: `media/stikkers/2026/batch 3/Sport Legends/mamba-mindset-sport-legend-mural.png`

The wording has a strong commercial association with a specific well-known sports personality and related merchandising context. This audit did **not** establish an exact trademark-registration result or a definitive legal restriction, so it must not be described as an infringement finding.

**Status:** keep this within the remaining Blocker E legal/owner clearance bucket and revisit later together with the recognizable-person commercial-use question. Do not add customer-facing rights/disclaimer copy for this internal checkpoint.

## Launch-control rule

For Blocker E, use a conservative internal catalogue rule where a future clearance review is needed:

- **cleared** — provenance/permission is documented or owner confirms sufficient rights;
- **hold** — provenance or commercial personality/trademark position is unresolved;
- **remove/replace** — owner decides not to pursue clearance.

The owner confirmations above mean the current catalogue is no longer waiting on provenance, official-logo or lyric/long-quotation questions. The remaining recognizable-person/title clearance is intentionally deferred and must not be silently marked cleared.

## Official reference baseline

Use current official guidance as the legal reference baseline rather than third-party blog summaries:

- Dutch Government / Business.gov.nl — Copyright: https://business.gov.nl/regulations/copyright/
- Dutch Government / Business.gov.nl — Trademarks: https://business.gov.nl/regulations/register-trademark/
- BOIP trademark register: https://www.boip.int/en/trademarks-register
- KVK — copyright and portrait-right context for photographs: https://www.kvk.nl/wetten-en-regels/auteursrecht-op-fotos-voor-je-website/

These sources support the general distinction between copyright in creative works, trademark protection and rights/issues around use of recognizable people. They do not by themselves clear any specific LegendMural product.

## Blocker E closure checklist

Current owner-confirmed items:

- [x] sticker artwork is owner-created and not literally copied/traced from third-party internet photographs/artwork for commercial sale;
- [x] no official brand/club/team/league logos are incorporated in the final sticker artworks;
- [x] no literal song lyrics or long third-party quotations are reproduced in the final sticker artworks.

Still intentionally deferred:

- [ ] commercial use of recognizable likenesses is cleared or affected assets are held/removed;
- [ ] `LM-2026-00056` (`Mamba Mindset`) is cleared or renamed/replaced if that later review requires it.

## Exact next website handling

Do **not** ask the owner to resolve the recognizable-person/title clearance again until the owner chooses to revisit it. Do **not** add this internal rights-status discussion to the public storefront.

Blocker E therefore remains **open / partially evidenced / intentionally deferred**, not closed. Continue only with website work that is independent of this deferred gate. Production remains prohibited until the required release gates are resolved and the owner explicitly authorizes the exact Production cutover.

Do not change V3-protected files, payment architecture or Production configuration as part of this checkpoint.
