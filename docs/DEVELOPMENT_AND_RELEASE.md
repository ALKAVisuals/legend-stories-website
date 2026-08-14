# Development and release process

Laatst inhoudelijk bijgewerkt: 14 augustus 2026.

## 1. Doel

Dit document beschrijft hoe LegendMural veilig wordt ontwikkeld, gevalideerd en vrijgegeven. De repository bevat storefrontcode, server-side commerce, een Neon order-store en Netlify Function-adapters.

Definitieve launchrichting:

- Netlify = enige production host;
- PayPal = enige beoogde payment provider;
- Neon = duurzame LegendMural orderdatabase;
- Stripe = tijdelijke legacy/fallbackcode totdat PayPal staging volledig bewezen is.

## 2. Lokale omgeving

Vereisten:

- Node.js 20 voor de standaard lokale kwaliteitsketen;
- npm;
- FFmpeg en FFprobe voor volledige mediavalidatie;
- een schone Git-branch vanaf de actuele `main`.

```bash
git clone https://github.com/ALKAVisuals/legend-stories-website.git
cd legend-stories-website
npm ci
npm run dev
```

De lokale Vite-server gebruikt standaard poort 3001. De Netlify-build draait op Node.js 22 en heeft een aparte compatibiliteitsworkflow.

## 3. Branch- en PR-beleid

Gebruik één beperkte scope per branch.

Voorbeelden:

```text
fix/cart-image-recovery
fix/paypal-capture-idempotency
feat/paypal-webhook
chore/remove-legacy-stripe
perf/responsive-product-derivatives
```

Iedere PR bevat minimaal:

- wat er is gewijzigd;
- waarom dit nodig is;
- gebruikers-/ontwikkelaarsimpact;
- wat bewust niet is gewijzigd;
- welke checks zijn uitgevoerd;
- veiligheidsgrenzen en resterende risico’s.

Geen wijziging wordt rechtstreeks op `main` uitgevoerd. Merge gebeurt alleen na expliciete goedkeuring.

## 4. Normale validatie

Voer voor een algemene PR minimaal uit:

```bash
npm ci
npm run quality
```

De huidige quality chain bevat repository-, CSS-, dependency-, media-, product-, commerce-, Neon-, unit- en buildvalidatie. Enkele Stripe-specifieke validators blijven tijdelijk actief zolang de legacy Stripecode nog aanwezig is.

Daarnaast zijn er aparte GitHub Actions voor accessibility/purchase flow en Node 22 Netlify-compatibiliteit.

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

Pas gegenereerde root-productpagina’s niet handmatig aan.

## 6. Commerce wijzigen

Wijzigingen aan prijs, korting, shipping of checkout vereisen altijd:

- centnauwkeurige server-side validatie;
- tests met gemanipuleerde browserprijzen;
- controle van shipping zones en ondersteunde landen;
- controle van idempotency en conflictsituaties;
- catalogusbrede validatie voor alle 111 producten.

Minimale huidige checks:

```bash
npm run validate:commerce-runtime
npm run validate:order-security
npm run validate:browser-checkout
npm run validate:checkout-persistence
npm run validate:order-return
npm run validate:neon-order-store
npm test
```

De browser mag nooit de autoriteit worden voor een geldbedrag of betaalstatus.

## 7. PayPal wijzigen

PayPal is de enige beoogde payment provider voor launch.

Behouden veiligheidsgrenzen:

- Sandbox is standaard;
- Client ID/Secret alleen server-side;
- PayPal API-origin wordt op officiële origins beperkt;
- live API is geblokkeerd tenzij `PAYPAL_ALLOW_LIVE=true` expliciet server-side is ingesteld;
- browserprijzen worden nooit naar PayPal als autoriteit overgenomen;
- create/capture gebruikt idempotency;
- capture moet bij de opgeslagen orderreference, PayPal order ID, amount en currency passen;
- een `paid` status komt uitsluitend uit server-side PayPal/Neon verwerking.

Secrets worden nooit in GitHub, PR’s, logs of chat geplaatst.

## 8. Media wijzigen

- verwijder alleen media na een bewezen referentieaudit;
- overschrijf geen originele product- of printbronnen;
- gebruik derivatives voor browserdelivery;
- behoud bestaande URLs of voeg gecontroleerde fallback/migratie toe;
- leg encoderinstellingen en kwaliteitsmetingen reproduceerbaar vast;
- voeg permanente driftvalidatie toe.

Voor afbeeldingen controleer minimaal codec, afmetingen, transparantie, bestandsgrootte, kwaliteitsgrenzen en referenties.

Voor video controleer minimaal codec/profiel, frame rate, duur, pixel format, fast start, audio, poster, SSIM/PSNR en loading policy inclusief Reduced Motion en Save-Data.

## 9. Neon-integratie

De echte geïsoleerde Neon-integratie is uitgevoerd. Migraties, order-store conformance en concurrent transact gedrag tegen echte PostgreSQL zijn gevalideerd. JSONB-serialisatie- en serializable-retryproblemen zijn in PR #74 opgelost.

Een herhaalde echte test mag alleen tegen een geïsoleerde testomgeving met synthetische data draaien.

Testsecrets blijven alleen in de daarvoor bedoelde GitHub environment:

```text
NEON_TEST_DATABASE_URL
NEON_TEST_MIGRATION_URL
```

Voor productie blijven vereist:

- aparte productieomgeving;
- dedicated least-privilege runtime-rol;
- backup-/restorebeleid;
- privacy-/retentiebeleid.

## 10. Netlify staging — PayPal Sandbox

De doelroutes zijn:

```text
/api/paypal/checkout
/api/paypal/capture
/api/order-status
```

Configureer staging uitsluitend met een geïsoleerde Netlify Deploy Preview/branchcontext, staging Neon en PayPal Sandbox.

Vereiste secrets rechtstreeks in Netlify:

```text
NEON_DATABASE_URL
PAYPAL_CLIENT_ID
PAYPAL_CLIENT_SECRET
```

Niet-geheime configuratie:

```text
CHECKOUT_SUCCESS_URL=<STAGING_ORIGIN>/order-success.html
CHECKOUT_CANCEL_URL=<STAGING_ORIGIN>/order-cancelled.html
CHECKOUT_ALLOWED_ORIGINS=<STAGING_ORIGIN>
PAYPAL_ALLOW_LIVE=false
```

`PAYPAL_API_BASE` mag in Sandbox afwezig blijven; de server gebruikt dan standaard de officiële PayPal Sandbox API-origin.

Zie [`PAYPAL_STAGING.md`](PAYPAL_STAGING.md) voor de volledige checklist.

## 11. PayPal webhook — vereist vóór productie

De huidige create/capture flow moet vóór productie worden aangevuld met een server-side PayPal webhook/reconciliationlaag.

Minimumeisen:

- server-side verificatie van PayPal events;
- controle van payment/order/capture identity;
- amount/currency/mode/provider matching;
- idempotente eventverwerking;
- duplicate deliveries veilig afhandelen;
- geen regressie van `paid`;
- reconciliation wanneer browserreturn wordt onderbroken;
- geen gevoelige volledige payloads loggen.

## 12. End-to-end stagingacceptatie

Een stagingrelease is pas geslaagd wanneer deze flow aantoonbaar werkt:

1. gebruiker voegt een product toe;
2. server herberekent product, variant, korting, shipping en totaal;
3. pending order wordt duurzaam opgeslagen;
4. PayPal Sandbox Order wordt aangemaakt;
5. buyer approval wordt voltooid;
6. server capture wordt uitgevoerd;
7. orderstatus wordt `paid` in Neon;
8. webhook/reconciliation bevestigt of reconcilieert de paymentstate;
9. returnpagina vraagt exacte status op;
10. alleen de bijbehorende checkout/cartdata wordt verwijderd;
11. refresh, duplicate capture en duplicate webhook veranderen niets dubbel;
12. cancel/failure behoudt de cart;
13. logs bevatten geen secrets of volledige gevoelige payloads.

Test daarnaast:

- Compact €35;
- Statement €45;
- `LEGEND10`;
- NL €4,95;
- EU €9,95;
- VS €9,95 tracked;
- gratis verzending vanaf €69;
- gemanipuleerde browserprijzen;
- ongeldige hoeveelheden/producten;
- database- en PayPal timeouts/fouten;
- oude cart-assets uit `localStorage`.

## 13. Legacy Stripe verwijderen

Stripe is geen launchprovider meer. Verwijderen gebeurt pas na een volledig groene PayPal stagingflow.

De Stripe-removal PR moet eerst inventariseren en scheiden:

- Stripe-only Netlify Functions;
- Stripe-only payment modules;
- Stripe-only tests/validators;
- Stripe environment/config references;
- Stripe documentation;
- provider-neutrale order/security/databasecode die behouden moet blijven.

Daarna volledige quality/build regression uitvoeren. Stripe niet tegelijk met de eerste PayPal stagingtest verwijderen.

## 14. Productierelease

Productie vereist een apart goedkeuringsmoment.

Checklist:

- PayPal webhook/reconciliation volledig getest;
- PayPal Sandbox E2E volledig groen;
- legacy Stripe gecontroleerd verwijderd;
- productie-Neonomgeving;
- dedicated least-privilege runtime-rol;
- backup-/restorebeleid;
- retentie-/privacybeleid;
- gescheiden Netlify production variables;
- geverifieerd PayPal Business-account;
- PayPal Live credentials alleen server-side;
- PayPal Live webhook;
- expliciete server-side live enablement;
- definitief publiek domein en HTTPS;
- canonical, sitemap, robots en social metadata;
- monitoring en alerting;
- order-, fulfillment-, refund-, dispute- en supportproces;
- gecontroleerde kleine echte betaling;
- rollback-/incidentprocedure.

## 15. Rollbackprincipes

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

- schakel hosted checkout via serverconfiguratie uit wanneer nodig;
- behoud orderdata en reconciliationinformatie;
- markeer geen orders handmatig betaald zonder verifieerbare PayPal/payment-evidence en audittrail.

## 16. Secrets en privacy

Nooit committen of delen via issues, PR’s of chat:

- Neon connection strings;
- PayPal Client Secret;
- PayPal webhook secrets/verificatiecredentials;
- legacy Stripe secrets zolang die code bestaat;
- Netlify tokens;
- echte klantnamen, adressen of betaalgegevens.

Gebruik environment scopes en least privilege. Testfixtures moeten synthetisch en herkenbaar verwijderbaar zijn.

## 17. Definition of done

Een wijziging is pas gereed wanneer:

- scope en niet-doelen duidelijk zijn;
- relevante tests en validators groen zijn;
- tijdelijke tooling is verwijderd of veilig permanent gemaakt;
- secrets en productieconfiguratie afwezig zijn tenzij expliciet goedgekeurd;
- documentatie is bijgewerkt wanneer architectuur of workflow verandert;
- GitHub Pages niet als parallel production target wordt toegevoegd;
- PR review-ready is;
- merge expliciet is goedgekeurd.
