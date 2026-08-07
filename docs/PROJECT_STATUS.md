# LegendMural projectstatus

Laatst inhoudelijk bijgewerkt: 7 augustus 2026.

Dit document beschrijft de actuele repositorystatus. Het bewijst niet dat productie-secrets, live Stripe of het definitieve publieke domein al zijn geactiveerd.

## Samenvatting

De storefront, catalogusarchitectuur, productpaginageneratie, browsercommerce, autoritatieve orderberekening, Stripe-contracten, Neon order-store, Netlify Function-adapters en kwaliteitsketen zijn geïmplementeerd en uitgebreid getest.

De eerder genoemde Neon-blokkade uit issue #31 is niet meer actueel: de geïsoleerde echte Neon-integratie is uitgevoerd en PR #74 heeft de daarbij gevonden JSONB- en serializable-transactionproblemen opgelost. De volgende echte releaseblokkade is nu een gecontroleerde Netlify staging-validatie met Stripe-testmodus en de geïsoleerde Neon-omgeving. Live betalingen blijven uitgeschakeld.

Netlify is de enige beoogde production host. GitHub Pages wordt niet als parallel production target onderhouden.

## Afgerond

### Product en content

- centrale catalogus met 111 producten en 6 batches;
- centrale runtime-productregistratie;
- gedeelde productpaginatemplate;
- alle 111 live productpagina’s generator-managed en reproduceerbaar;
- gerelateerde-productenvalidatie;
- canonical-, structured-data- en cataloguspariteitcontroles;
- kapotte interne routes en duplicate SEO-titels opgelost.

### Launch commerce

- Compact: maximaal 50 × 30 cm voor €35 incl. btw;
- Statement: maximaal 50 × 50 cm voor €45 incl. btw;
- Statement is standaard en aanbevolen;
- originele ontwerpverhoudingen blijven behouden binnen de productiedoos;
- publieke kortingscode `LEGEND10` voor 10%;
- Nederland: €4,95 verzending;
- EU: €9,95 verzending;
- Verenigde Staten: €9,95 tracked verzending;
- gratis verzending vanaf €69 in ondersteunde markten;
- bestemmingen buiten NL, EU en VS worden geblokkeerd.

### Browsercommerce

- winkelwagen en productidentiteit centraal bewaakt;
- centrale korting- en verzendregels;
- opgeslagen kortingscodes worden opnieuw gevalideerd;
- dubbele cart-persistence verwijderd;
- browser Checkout-client gekoppeld aan same-origin runtimeconfiguratie;
- Google Places blijft optioneel en kan handmatige adresinvoer niet blokkeren;
- adresvalidatie heeft een timeout/fallback zodat checkout niet blijft hangen;
- success- en cancelpagina’s zijn aanwezig en `noindex`;
- winkelwagen wordt niet op basis van alleen een return-URL geleegd;
- oude winkelwagenafbeeldingen kunnen via de runtime-productregistratie naar het actuele Netlify/Vite-pad worden hersteld.

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

### Neon Postgres

- provider-neutraal order-store contract;
- herbruikbare conformance-suite;
- Neon Postgres in Frankfurt gekozen voor de geïsoleerde testomgeving;
- Postgresmigratie voor orders en Stripe-eventreserveringen;
- Neon-adapter met transacties, locking en versiecontrole;
- expliciete JSONB-serialisatie voor pending orders;
- bounded retries met backoff voor retryable serializable conflicts;
- pinned Neon- en WebSocketdependencies;
- echte Neon-migraties uitgevoerd;
- echte order-store conformance uitgevoerd;
- concurrent transact gedrag tegen echte PostgreSQL gevalideerd;
- synthetische fixture-cleanup aanwezig;
- productie vereist nog steeds een dedicated least-privilege runtime-rol en vastgesteld backup-/privacybeleid.

### Netlify stagingarchitectuur

- `netlify.toml` aanwezig;
- Node.js 22 voor de Netlify-build;
- Netlify Function voor checkout;
- Netlify Function voor Stripe webhook;
- Netlify Function voor orderstatus;
- same-origin routes `/api/checkout`, `/api/order-status` en `/api/stripe-webhook`;
- gedeelde Neon order-store geïnjecteerd in de bestaande serverhandlers;
- fail-closed gedrag wanneer vereiste configuratie ontbreekt;
- productcatalogus expliciet beschikbaar voor Function-bundling;
- aparte Node 22 Netlify-compatibiliteitsworkflow aanwezig;
- live Stripe-activering blijft uitgesloten.

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
- originele PNG- en product-/printbronnen behouden;
- runtime productafbeeldingen en related-products CSS worden in de Netlify/Vite-output gecontroleerd beschikbaar gemaakt.

### Codekwaliteit en CI

- laatste uitvoerbare inline script geëxternaliseerd;
- 236 inline image-error handlers gecentraliseerd;
- nul inline `onerror`-handlers over;
- permanente repository-, CSS-, dependency-, media-, image-, video- en runtime-audits;
- permanente commerce-, Stripe-, Neon- en ordervalidatie;
- unit tests en Vite-productiebuild in de quality gate;
- aparte accessibility- en purchase-flow audit;
- aparte Node 22 Netlify-compatibiliteitscontrole;
- normale GitHub Actions-permissie is `contents: read`;
- GitHub Pages is geen production deploymentpad meer.

## Actuele releaseblokkade

### Netlify staging end-to-end valideren

De repositorycode voor staging is aanwezig. Voor doorgang naar productie moet de externe stagingomgeving aantoonbaar de volledige flow doorlopen met uitsluitend testdata en Stripe-testmodus.

Benodigde validatie:

1. Netlify staging gebruikt uitsluitend staging/test environment variables;
2. checkout Function kan een autoritatieve orderquote opslaan in de geïsoleerde Neon-omgeving;
3. Stripe-test Checkout Session wordt correct aangemaakt;
4. een Stripe-testbetaling voltooit;
5. de ondertekende webhook zet de orderstatus naar `paid`;
6. de returnpagina bevestigt exact dezelfde order en Checkout Session;
7. alleen bij serverbevestigde `paid`-status wordt bijbehorende cart-/Checkoutdata verwijderd;
8. cancel, failure en expiry behouden de winkelwagen;
9. retries, refreshes en duplicate events veroorzaken geen dubbele ordermutaties;
10. logs bevatten geen secrets of onnodige persoonsgegevens.

## Voor productie nog vereist

Productieactivering vereist een afzonderlijk besluit en minimaal:

- gescheiden productie-Neonbranch;
- dedicated least-privilege runtime-rol;
- vastgesteld backup- en herstelbeleid;
- vastgesteld privacy- en retentiebeleid;
- aparte Netlify-productievariabelen;
- Stripe live webhook en live keys uitsluitend server-side;
- expliciete `live`-enablement uitsluitend server-side;
- definitief publiek domein, HTTPS, canonical, sitemap en robots;
- logging, monitoring en incidentprocedure;
- operationeel order-, refund- en klantenserviceproces;
- gecontroleerde kleine echte betaling;
- rollbackprocedure.

## Technische verbeteringen die parallel mogelijk zijn

Deze onderdelen vereisen geen live secrets:

- resterende documentatie actueel houden;
- resterende inline event handlers read-only classificeren en in veilige batches centraliseren;
- aanvullende toegankelijkheidsaudit van menu, modals, cart en checkout;
- responsive image- en fetch-priority-audit;
- technische SEO voor collecties, breadcrumbs en social metadata;
- mobiele koopflow en foutstatussen verder verbeteren;
- testdekking voor interacties en toegankelijkheidscontracten uitbreiden.

## Commerciële roadmap na bewezen staging

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
- geen productie-Netlifywijziging zonder afzonderlijke toestemming;
- geen secrets in chat of repository;
- GitHub Pages wordt niet als tweede production host onderhouden;
- tijdelijke migratietooling wordt vóór merge verwijderd of permanent veilig gemaakt;
- performanceoptimalisatie overschrijft nooit originele product- of printbronnen;
- een groene quality gate is noodzakelijk maar vervangt geen handmatige UX- of infrastructuurreview.
