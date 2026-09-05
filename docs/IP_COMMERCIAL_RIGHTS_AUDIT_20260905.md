# LegendMural — IP / commercial-rights audit

**Date:** 2026-09-05  
**Scope:** public website launch-readiness / Blocker E  
**Repository baseline:** `main` at `ec5e7817774cb6082a1c71f59dadf612fca4c2ff`  
**Status:** repository audit complete; owner/legal clearance remains a launch gate

## Purpose

This document records the concrete copyright, portrait/personality-right and trademark exposures visible in the current LegendMural storefront. It is an inventory and launch-control record, not a legal opinion and not a finding that any listed design infringes third-party rights.

The repository can show which designs, titles and marketing assets are offered publicly. It cannot prove who created every underlying artwork, which references were used, or whether permissions/licences exist outside the repository. Final commercial clearance therefore remains an owner/legal decision.

## Scope reviewed

- the managed catalogue of **111 products** in `data/products/catalog.json`;
- public product titles, slugs, descriptions and image paths;
- the public homepage showcase / portfolio in `index.html`;
- obvious repository filename-level references to well-known people, entertainment properties, sports brands and leagues.

No V3 Commerce / Orders / Invoices implementation is in scope for this audit.

## Main result

The public product catalogue largely uses generic or original-facing names such as `The Balanced Mind`, `Constant Evolution`, `Pure Ambition`, `True Freedom` and similar titles. The repository review did not find obvious filename-level references to `Nike`, `Adidas`, `NBA`, `UFC`, `Jordan` or `Kobe`.

That is useful risk reduction, but it is **not** proof that the artwork itself contains no protected logo, trade dress, copied photograph, recognizable person or other protected element. The image provenance and visual contents still need owner confirmation where applicable.

## Items requiring explicit clearance before launch

### 1. Recognizable people in homepage / showcase assets

The homepage currently contains or references the following assets/labels:

- `media/beforeafter/LM_tupac_after.png`, with visible copy `After — Tupac Mural`;
- `media/voorbeelden/Tupac_bedroom.png` / `.webp`;
- `media/voorbeelden/Arnold S..png` / `.webp`;
- `media/voorbeelden/Ice Cube.png` / `.webp`;
- `media/voorbeelden/Ibrahimovic.png` / `.webp`;
- `media/voorbeelden/Mike T..png` / `.webp`;
- `media/voorbeelden/Fightclub.png` / `.webp`.

The customer-facing portfolio card labels themselves are mostly generic (`West Coast Room`, `Power Room`, `Underground`, `90s Vibes`, `Champion's Wall`, `Knockout Room`), but the underlying visual content and provenance still matter.

**Required closure evidence:** owner confirms the commercial right to use the relevant artwork and any recognizable likeness/source material, or the asset is removed/held from the launch set until cleared.

### 2. `Mamba Mindset`

The managed catalogue contains:

- Product ID: `LM-2026-00056`
- public name: `Mamba Mindset`
- page: `sport-mamba-mindset.html`
- image: `media/stikkers/2026/batch 3/Sport Legends/mamba-mindset-sport-legend-mural.png`

The wording has a strong commercial association with a specific well-known sports personality and related merchandising context. This audit did **not** establish an exact trademark-registration result or a definitive legal restriction, so it must not be described as an infringement finding.

**Required closure:** confirm commercial clearance for this title/visual, or use a neutral title and cleared artwork before launch.

### 3. Source artwork, photographs and logos

The repository cannot determine whether an illustration was independently created from scratch, derived from a licensed/public-domain source, or copied/traced from a third-party photograph/artwork.

**Required owner confirmations:**

1. no third-party photograph or artwork was copied/traced for commercial sale without a sufficient licence or other legal basis;
2. no official brand, club, league or team logo is incorporated without sufficient permission/legal basis;
3. no song lyrics, long quotations, movie artwork or other protected text/artwork is reproduced without sufficient permission/legal basis;
4. recognizable-person designs have been individually considered for the intended commercial merchandise use.

## Recommended launch-control rule

For Blocker E, use a conservative catalogue rule:

- **cleared** — provenance/permission is documented or owner confirms sufficient rights;
- **hold** — provenance or commercial personality/trademark position is unresolved;
- **remove/replace** — owner decides not to pursue clearance.

An unresolved item does not need to block unrelated cleared products from being technically ready, but it should not be part of the public Production launch catalogue until the owner has cleared it.

## Official reference baseline

Use current official guidance as the legal reference baseline rather than third-party blog summaries:

- Dutch Government / Business.gov.nl — Copyright: https://business.gov.nl/regulations/copyright/
- Dutch Government / Business.gov.nl — Trademarks: https://business.gov.nl/regulations/register-trademark/
- BOIP trademark register: https://www.boip.int/en/trademarks-register
- KVK — copyright and portrait-right context for photographs: https://www.kvk.nl/wetten-en-regels/auteursrecht-op-fotos-voor-je-website/

These sources support the general distinction between copyright in creative works, trademark protection and rights/issues around use of recognizable people. They do not by themselves clear any specific LegendMural product.

## Blocker E closure checklist

Blocker E can be marked complete only after the owner has supplied/recorded the following decisions:

- [ ] artwork provenance for the recognizable-person homepage/showcase assets is confirmed;
- [ ] commercial use of recognizable likenesses is cleared or those assets are held/removed;
- [ ] `LM-2026-00056` (`Mamba Mindset`) is cleared or renamed/replaced;
- [ ] no unlicensed official brand/team/league logos are used in the launch catalogue;
- [ ] no unlicensed copied photos/artwork, lyrics or long third-party quotations are used in the launch catalogue;
- [ ] any uncertain design is explicitly placed on hold rather than silently treated as cleared.

## Exact next website step

Obtain the owner confirmations above and turn this inventory into a concrete **cleared / hold / remove-or-replace** launch list. Only after that owner checkpoint should Blocker E be closed in `docs/CURRENT_PRODUCTION_STATUS_20260903.md`.

Do not change V3-protected files, payment architecture or Production configuration as part of this checkpoint.
