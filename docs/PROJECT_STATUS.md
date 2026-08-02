# LegendMural projectstatus

Laatst inhoudelijk bijgewerkt: 2 augustus 2026.

Dit document beschrijft de repositorystatus. Het is geen bewijs dat externe Neon-, Netlify- of Stripe-infrastructuur al is ingericht.

## Samenvatting

De storefront, catalogusarchitectuur, productpaginageneratie, browsercommerce, autoritatieve orderberekening, Stripe-contracten, Neon-adapter en kwaliteitsketen zijn voorbereid en uitgebreid getest zonder live infrastructuur te activeren.

De belangrijkste blokkade is GitHub issue #31: het aanmaken van een geïsoleerde Neon Postgres-testomgeving. Zonder die omgeving kan de echte databaseconformance niet worden uitgevoerd en mag de Netlify/Stripe-stagingfase niet starten.

## Afgerond

### Product en content

- centrale catalogus met 111 producten en 6 batches;
- centrale runtime-productregistratie;
- gedeelde productpaginatemplate;
- alle 111 live productpagina’s generator-managed en reproduceerbaar;
- gerelateerde-productenvalidatie;
- canonical-, structured-data- en cataloguspariteitcontroles;
- kapotte interne routes en duplicate SEO-titels opgelost.

### Browsercommerce

- winkelwagen en productidentiteit centraal bewaakt;
- centrale korting- en verzendregels;
- opgeslagen kortingscodes worden opnieuw gevalideerd;
- dubbele cart-persistence verwijderd;
- browser Checkout-client voorbereid;
- success- en cancelpagina’s aanwezig en `noindex`;
- winkelwagen wordt niet op basis van alleen een return-URL geleegd.

### Server-side orderbeveiliging

- autoritatieve orderquote uit centrale productdata;
- browserprijzen, namen en totalen worden genegeerd;
- bedragen worden in gehele eurocenten berekend;
- Stripe Checkout-boundary met test-key enforcement;
- deterministische idempotency keys;
- durable pending-ordervereiste vóór Checkout-response;
- ondertekende Stripe-webhookvalidatie;
- monotone orderstatusovergangen;
- privacy-minimale orderstatusresponse;
- verified paid-only cart cleanup.

### Databasevoorbereiding

- provider-neutraal order-store contract;
- herbruikbare conformance-suite;
- Neon Postgres gekozen in regio Frankfurt;
- Postgresmigratie voor orders en Stripe-eventreserveringen;
- dormant Neon-adapter met transacties, locking en versiecontrole;
- aparte migratie- en least-privilege runtimerol ontworpen;
- pinned Neon- en WebSocketdependencies;
- echte integratieharness en handmatige workflow aanwezig;
- gegarandeerde synthetische fixture-cleanup.

### Performance en media

- repository-wide mediareferentieaudit;
- 9 volledig ongebruikte bestanden verwijderd;
- ongeveer 12,8 MB ongebruikte media verwijderd;
- collectie-video’s van ongeveer 22,23 MB naar 7,16 MB gebracht;
- video-audio verwijderd waar alle usages muted zijn;
- posters toegevoegd;
- adaptief videoladen voor viewport, visibility, Reduced Motion en Save-Data;
- grote actieve rasterbestanden geclassificeerd;
- vijf homepage-marketingafbeeldingen als WebP toegevoegd;
- ongeveer 85,52% potentiële transferreductie voor die vijf afbeeldingen;
- originele PNG- en product-/printbronnen behouden.

### Codekwaliteit en CI

- laatste uitvoerbare inline script geëxternaliseerd;
- 236 inline image-error handlers gecentraliseerd;
- nul inline `onerror`-handlers over;
- permanente repository-, CSS-, dependency-, media-, image-, video- en runtime-audits;
- permanente commerce-, Stripe-, Neon- en ordervalidatie;
- unit tests en Vite-productiebuild in de quality gate;
- normale GitHub Actions-permissie is `contents: read`.

## Actuele blokkade

### Issue #31 — geïsoleerd Neon Postgres-testproject

Benodigde owner-acties:

- Neon-organisatie onder eigendom van ALKAVisuals;
- MFA inschakelen;
- project in `aws-eu-central-1`;
- geïsoleerde branch `order-store-integration`;
- alleen synthetische testdata;
- aparte migratie- en runtimerollen;
- pooled runtime-URL en directe migration-URL;
- secrets opslaan in de GitHub environment `neon-integration`:
  - `NEON_TEST_DATABASE_URL`;
  - `NEON_TEST_MIGRATION_URL`;
- backup/restorebeleid en DPA/privacyvoorwaarden beoordelen.

Credentials mogen nooit in deze repository, issues, PR’s, logs of chatberichten worden geplaatst.

## Direct daarna uitvoerbaar

Wanneer issue #31 is voltooid:

1. handmatige Neon-integratieworkflow uitvoeren;
2. migratie tegen de geïsoleerde branch toepassen;
3. provider-neutrale conformance tegen echte PostgreSQL draaien;
4. concurrente pending orders en duplicate Stripe-events testen;
5. runtime-permissiebeperkingen controleren;
6. synthetische records opruimen;
7. issue #31 alleen na een groene run sluiten.

## Volgende infrastructuurfase

Na een groene Neon-integratietest volgt een afzonderlijk goedgekeurde staging-sprint:

- dunne Netlify Functions voor checkout, webhook en orderstatus;
- uitsluitend Stripe-testkeys;
- Neon stagingbranch koppelen;
- browser-endpoints alleen voor staging invullen;
- CORS, origin en environment scopes valideren;
- volledige Stripe-testbetaling uitvoeren;
- webhookgestuurde `paid`-status bevestigen;
- paid-only cart cleanup bevestigen;
- retries, refreshes en duplicate events testen.

Netlify en Stripe mogen niet tegelijk met de eerste echte Neon-test worden geactiveerd. Daarmee blijft de foutscope beheersbaar.

## Productiefase

Productieactivering vereist een afzonderlijk besluit en minimaal:

- gescheiden productie-Neonbranch en rollen;
- vastgesteld backup- en herstelbeleid;
- privacy-/retentiebeleid;
- aparte Netlify-productievariabelen;
- Stripe live webhook en live keys;
- expliciete `live`-enablement uitsluitend server-side;
- gecontroleerde kleine echte betaling;
- logging, monitoring en incidentprocedure;
- order- en klantenserviceproces.

## Technische verbeteringen die parallel mogelijk zijn

Deze onderdelen vereisen geen externe secrets:

- README en architectuurdocumentatie actueel houden;
- resterende inline event handlers read-only classificeren en in veilige batches centraliseren;
- toegankelijkheidsaudit van menu, modals, cart en checkout;
- responsive image- en fetch-priority-audit;
- technische SEO voor collecties, breadcrumbs en social metadata;
- mobiele koopflow en foutstatussen verbeteren;
- testdekking voor interacties en toegankelijkheidscontracten uitbreiden.

## Commerciële roadmap na staging

Na een bewezen end-to-end betaalflow:

- productzoekfunctie en filters;
- reviews en social proof;
- wishlist;
- verbeterde productvergelijking;
- SEO-landingspagina’s en content;
- analytics en conversiemeting;
- abandoned-cartstrategie;
- klantaccounts en orderhistorie;
- eenvoudige order-/voorraadadministratie;
- support-, refund- en disputeprocessen.

## Werkafspraken

- iedere wijziging begint met analyse en een beperkte scope;
- codewijzigingen gaan via een branch en PR;
- geen merge zonder expliciete goedkeuring;
- geen Netlifywijziging zonder afzonderlijke toestemming;
- geen secrets in chat of repository;
- tijdelijke migratietooling wordt vóór merge verwijderd of permanent veilig gemaakt;
- performanceoptimalisatie overschrijft nooit originele product- of printbronnen;
- een groene quality gate is noodzakelijk maar vervangt geen handmatige UX- of infrastructuurreview.
