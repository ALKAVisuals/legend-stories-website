# Development and release process

## 1. Doel

Dit document beschrijft hoe wijzigingen veilig worden ontwikkeld, gevalideerd en vrijgegeven. De repository bevat storefrontcode én voorbereide servercontracten; daardoor moet iedere wijziging duidelijk aangeven of zij alleen frontend, repositorylogica, testinfrastructuur, staging of productie raakt.

## 2. Lokale omgeving

Vereisten:

- Node.js 20;
- npm;
- FFmpeg en FFprobe voor volledige mediavalidatie;
- een schone Git-branch vanaf de actuele `main`.

```bash
git clone https://github.com/ALKAVisuals/legend-stories-website.git
cd legend-stories-website
npm ci
npm run dev
```

De lokale Vite-server gebruikt standaard poort 3001.

## 3. Branch- en PR-beleid

Gebruik één beperkte scope per branch.

Voorbeelden:

```text
agent/project-documentation
refactor/inline-handler-audit
fix/checkout-focus-management
perf/responsive-product-derivatives
feat/netlify-checkout-staging
```

Iedere PR bevat minimaal:

- wat er is gewijzigd;
- waarom dit nodig is;
- welke gebruikers- of ontwikkelaarsimpact bestaat;
- wat bewust niet is gewijzigd;
- welke checks zijn uitgevoerd;
- veiligheidsgrenzen en bekende resterende risico’s.

Geen wijziging wordt rechtstreeks op `main` uitgevoerd. Merge gebeurt alleen na expliciete goedkeuring.

## 4. Normale validatie

Voer voor een algemene PR minimaal uit:

```bash
npm ci
npm run quality
```

De volledige quality chain omvat repository-, CSS-, dependency-, media-, product-, commerce-, Stripe-, Neon-, unit- en buildvalidatie.

Bij een beperkte documentatie-PR is een volledige build functioneel niet noodzakelijk, maar de GitHub quality gate blijft de definitieve integriteitscontrole.

## 5. Productcatalogus wijzigen

Wijzig productdata alleen in de centrale catalogus en bijbehorende presentatiemanifests.

Veilige volgorde:

1. wijzig product- of presentatiedata;
2. voer catalogusvalidatie uit;
3. genereer productpreviews;
4. controleer templatecompatibiliteit;
5. genereer beheerde live productpagina’s;
6. controleer dat alle 111 live pagina’s reproduceerbaar zijn;
7. voer de volledige quality gate uit.

Belangrijke commando’s:

```bash
npm run validate:full-catalog
npm run audit:product-page-templates
npm run generate:managed-product-pages
npm run validate:managed-product-pages:live
npm run generate:runtime-products
npm run validate:runtime-products
```

Pas gegenereerde root-productpagina’s niet handmatig aan. Een wijziging moet terug te voeren zijn op centrale data of de gedeelde template.

## 6. Commerce wijzigen

Wijzigingen aan prijs, korting, shipping of checkout vereisen altijd:

- centnauwkeurige server-side validatie;
- tests met gemanipuleerde browserprijzen;
- controle van expliciete en fallback shipping zones;
- controle van idempotency en conflictsituaties;
- catalogusbrede validatie voor alle 111 producten.

Minimale checks:

```bash
npm run validate:commerce-runtime
npm run validate:order-security
npm run validate:stripe-checkout
npm run validate:browser-checkout
npm run validate:checkout-persistence
npm run validate:stripe-webhook
npm run validate:order-return
npm test
```

De browser mag nooit de autoriteit worden voor een geldbedrag of betaalstatus.

## 7. Media wijzigen

### Algemene regels

- verwijder alleen media na een bewezen referentieaudit;
- overschrijf geen originele product- of printbronnen;
- gebruik derivatives voor browserdelivery;
- behoud URL’s wanneer bestaande pagina’s ervan afhankelijk zijn;
- leg encoderinstellingen en kwaliteitsmetingen reproduceerbaar vast;
- voeg permanente driftvalidatie toe.

### Afbeeldingen

Controleer minimaal:

- codec;
- afmetingen;
- transparantie;
- bestandsgrootte en ratio;
- SSIM wanneer een lossy derivative wordt gebruikt;
- exacte HTML/CSS-referenties;
- fallbackgedrag.

### Video

Controleer minimaal:

- codec en profiel;
- frame rate, duur en frame count;
- pixel format en kleurmetadata;
- MP4 fast start;
- audio-aanwezigheid;
- poster;
- SSIM en PSNR;
- loading policy en Reduced Motion/Save-Data.

## 8. Neon-testactivatie

De echte Neon-integratie mag alleen draaien tegen de geïsoleerde branch uit issue #31.

Voorwaarden:

- ALKAVisuals is eigenaar van de Neon-organisatie;
- MFA staat aan;
- regio is Frankfurt (`aws-eu-central-1`);
- branch bevat geen productiegegevens;
- aparte migratie- en runtimecredentials;
- secrets staan in de GitHub environment `neon-integration`;
- secrets worden nergens geprint.

Vereiste secrets:

```text
NEON_TEST_DATABASE_URL
NEON_TEST_MIGRATION_URL
```

Start daarna handmatig de workflow **Neon order-store integration**.

Acceptatie:

- migratie slaagt en is repeatable;
- echte Neon-adapter haalt alle conformance-scenario’s;
- concurrentietests slagen;
- runtime-rol kan niet verwijderen of truncaten;
- synthetische testdata is na afloop verwijderd;
- geen checkoutendpoint, Netlifyinstelling of Stripekey is geactiveerd.

## 9. Netlify staging-sprint

Deze sprint start alleen na een groene Neon-integratietest en afzonderlijke toestemming.

Scope:

- dunne Netlify Function-adapters voor checkout, webhook en orderstatus;
- staging-only environment variables;
- Stripe-testkeys;
- staging-Neonbranch;
- origin- en CORS-beperking;
- logging zonder secrets of onnodige persoonsgegevens;
- browser-endpoints uitsluitend voor staging.

Niet toegestaan in dezelfde stap:

- productie-Neoncredentials;
- `sk_live_`;
- live webhookenablement;
- productiecanonical- of domeinmigratie;
- echte klantgegevens.

## 10. End-to-end stagingacceptatie

Een stagingrelease is pas geslaagd wanneer de volgende flow bewezen is:

1. gebruiker voegt een product toe;
2. server herberekent producten en bedragen;
3. pending order wordt duurzaam opgeslagen;
4. Stripe-test Checkout Session wordt aangemaakt;
5. testbetaling wordt voltooid;
6. geldige ondertekende webhook wordt verwerkt;
7. orderstatus wordt `paid`;
8. returnpagina vraagt exacte status op;
9. alleen de bijbehorende cart-/Checkoutdata wordt verwijderd;
10. refresh en duplicate webhook veranderen niets dubbel;
11. failure, cancel en expiry behouden de winkelwagen;
12. logs bevatten geen secrets of volledige gevoelige payloads.

Test daarnaast:

- gemanipuleerde browserprijzen;
- ongeldige hoeveelheden;
- duplicate Checkoutrequest;
- duplicate webhookevent;
- webhook vóór of na returnpagina;
- verkeerde Checkout Session bij geldige orderreference;
- tijdelijke database- of Stripefout;
- trage verbinding en requesttimeout.

## 11. Productierelease

Productie vereist een apart goedkeuringsmoment.

Checklist:

- productie-Neonbranch en least-privilege rollen;
- backup- en herstelbeleid vastgesteld;
- retentie- en privacybeleid vastgesteld;
- DPA en relevante voorwaarden beoordeeld;
- gescheiden Netlify-productievariabelen;
- correcte Stripe live webhookroute;
- live keys alleen server-side;
- expliciete server-side live enablement;
- definitief publiek domein en HTTPS;
- canonical, sitemap en robots op het definitieve domein;
- monitoring en alerting;
- operationeel order-, refund- en supportproces;
- gecontroleerde kleine echte betaling;
- rollback- en incidentprocedure.

## 12. Rollbackprincipes

### Storefront

- revert de specifieke mergecommit;
- herstel geen gegenereerde pagina’s handmatig;
- genereer opnieuw vanuit de laatst geldige centrale data.

### Media

- originele bronnen blijven behouden;
- herstel de vorige referentie of derivative;
- valideer fallback en hashes opnieuw.

### Database

- gebruik voorwaartse herstelmigraties wanneer orders kunnen bestaan;
- verwijder of herschrijf geen productieorders zonder formeel operationeel besluit;
- test restoreprocedures vóór productie.

### Betalingen

- schakel hosted Checkout via serverconfiguratie uit;
- behoud webhooklogging en orderdata voor reconciliatie;
- markeer geen orders handmatig betaald zonder Stripebewijs en audittrail.

## 13. Secrets en privacy

Nooit committen of delen via issues, PR’s of chat:

- Neon connection strings;
- Stripe secret keys;
- webhook secrets;
- Netlify tokens;
- klantnamen, adressen of betaalgegevens uit echte orders.

Gebruik environment scopes en least privilege. Testfixtures moeten synthetisch en herkenbaar verwijderbaar zijn.

## 14. Definition of done

Een wijziging is pas gereed wanneer:

- scope en niet-doelen duidelijk zijn;
- relevante tests en validators groen zijn;
- tijdelijke tooling is verwijderd of veilig permanent gemaakt;
- secrets en productieconfiguratie afwezig zijn tenzij expliciet onderdeel van een goedgekeurde infrastructuursprint;
- documentatie is bijgewerkt wanneer architectuur of workflow verandert;
- PR review-ready is;
- merge expliciet is goedgekeurd.
