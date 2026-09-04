# LegendMural GPSR product-safety plan

**Updated:** 4 September 2026  
**Repository:** `ALKAVisuals/legend-stories-website`  
**Scope:** public LegendMural wall-sticker catalogue / launch-readiness  
**Status:** Blocker D part 1 audit and part 2A online-offer identity implementation complete; material confirmation, supported warning/use wording and physical marking remain.

## Purpose

Keep GPSR implementation proportionate to the actual LegendMural product. LegendMural currently sells 111 physical wall-sticker catalogue products with predefined 30 cm and 45 cm variants. The storefront already uses a managed product-page template, so product-safety presentation should be centralized and generated rather than manually duplicated across 111 pages.

This plan does not introduce payment, order, invoice or V3 changes.

## Current facts already established in the repository

- Seller/trader identity already exists publicly as **Alka Group, trading through LegendMural**.
- Public company information already includes the Dutch postal address, email address and telephone number.
- Product pages identify the product name, image, collection, selected size, price, `Matte vinyl`, `Removable`, and `Made in Netherlands`.
- The full catalogue contains a unique `productId` in the form `LM-2026-xxxxx` for every product.
- Each product has fixed catalogue variants for Compact (30 cm longest side) and Statement (45 cm longest side).
- Batch identity is already stored in the catalogue.
- Product pages are generated centrally from `templates/product-page.html` through the managed product-page generation system.

## Manufacturer/economic-operator working position

Owner-confirmed operating fact: LegendMural controls its own production of the wall stickers in the Netherlands and sells them under the LegendMural brand.

Working implementation position for Blocker D:

> **Manufacturer: Alka Group, trading through LegendMural, Netherlands.**

Before final publication, keep this aligned with the actual production/legal setup. No third-party EU responsible-person block is planned while Alka Group itself is the EU manufacturer.

## Minimal centralized website implementation

Part 2A is implemented in the managed product-page system: all 111 product pages now expose the authoritative Product ID plus manufacturer postal/electronic identity centrally. Material-dependent use/safety wording remains deferred until the facts below are confirmed.

Public product-information status:

1. **Implemented:** visible product identifier using the authoritative `LM-2026-xxxxx` product ID;
2. **Implemented:** manufacturer identity: Alka Group / LegendMural;
3. **Implemented:** manufacturer postal address and electronic contact;
4. **Pending material confirmation:** concise intended-use / application information supported by the actual vinyl manufacturer's documentation;
5. **Pending risk assessment:** only safety warnings that are actually supported by the product/material risk assessment;
6. **Implemented/preserved:** existing size/variant identification and catalogue traceability.

Likely implementation surface:

- `data/products/catalog.json` as authoritative per-product identity source;
- `templates/product-page.html` as the central presentation surface;
- `scripts/product-page-generation.mjs` to inject product ID / centralized safety fields;
- focused contract tests to prove all 111 generated product pages receive the required fields.

Do not add invented warnings merely to make the page look compliant.

## Claims that must be verified before final GPSR/public wording

The current storefront uses claims including:

- `Matte vinyl`;
- `Removable`;
- `residue-free`;
- `for every room` / equivalent broad indoor-use wording;
- `Made in Netherlands`.

`Matte vinyl` and `Made in Netherlands` are current product/production assertions. The broader performance/application claims, especially `residue-free` and unrestricted room/surface suitability, must be checked against the exact substrate/adhesive technical documentation before they are treated as universally supported claims.

## Exact production inputs still required from the owner

Provide any of the following as a photo, supplier link, label text or technical datasheet. No secret/account information is needed.

### 1. Vinyl / self-adhesive media

Need:

- manufacturer/brand;
- exact product name and/or product code;
- ideally the product datasheet or supplier product page.

This is the most important source for intended surfaces, adhesive properties, removability, temperature/application limitations and any material-specific warnings.

### 2. Ink system

Printer is understood to be a Roland VersaSTUDIO BN-20A. Need the exact ink family/cartridge product actually used in production, not merely the printer model.

Need:

- ink family / cartridge name;
- product code if available;
- datasheet/SDS or supplier page if available.

### 3. Laminate / coating

Confirm either:

- **none used**, or
- exact laminate/coating manufacturer + type/product code.

### 4. Consumer packaging

Describe the final physical pack the customer receives, for example:

- release/backing liner only;
- protective sheet/sleeve;
- flat cardboard mailer;
- tube;
- other packaging.

Also confirm where a small manufacturer/product-ID label or insert can practically be placed.

## Internal minimum product-safety record

For this low-complexity product family, use a proportionate shared wall-sticker safety record rather than 111 unrelated safety dossiers, provided all products genuinely share the same material and production system.

The record should document:

- product family: printed self-adhesive wall sticker;
- applicable media / adhesive;
- ink system;
- laminate/coating if any;
- intended use and reasonable foreseeable misuse;
- identified risks and why each is controlled or not material;
- relevant supplier technical documents/SDS references;
- manufacturer identity;
- catalogue/product-ID and batch traceability;
- approved customer-facing warnings/instructions, if any.

A new safety assessment is needed if a materially different vinyl, adhesive, ink, laminate or intended-use category is introduced later.

## Physical product / packaging traceability

Website presentation alone is not the full traceability solution. Before commercial release, define a lightweight physical marking/insert approach carrying at least:

- LegendMural / Alka Group manufacturer identity;
- postal/electronic contact as applicable;
- product identifier or a traceable product/batch reference.

Preferred practical direction: one small standardized backing-sheet label, packaging label or included card generated from the order/product identity. Exact format remains open until the owner confirms the final packaging method.

## What is explicitly not required by this plan

- no 111 manually written safety pages;
- no fabricated warning list;
- no payment-provider changes;
- no PayPal changes;
- no V3/order/invoice changes;
- no Netlify Production deployment;
- no public claim that compliance is complete before the material facts and final risk assessment are confirmed.

## Completion criteria for Blocker D

Blocker D can move from audit to implementation-complete when:

1. exact vinyl/media is confirmed;
2. exact ink system is confirmed;
3. laminate/coating status is confirmed;
4. packaging/physical marking method is confirmed;
5. claims and any warnings are validated against real product documentation;
6. the shared product-safety record is completed;
7. the managed product-page template exposes the required manufacturer/product identity and applicable safety/use information centrally;
8. tests prove the required information is generated consistently across the managed catalogue;
9. no V3-reserved files are modified.

## Exact next step

> Obtain the four owner production inputs above. Until they are known, do not publish new safety warnings and do not strengthen performance/application claims. Once received, validate the exact material documentation and produce the final centralized website + physical-label implementation specification.