# LegendMural projectstatus

Laatst inhoudelijk bijgewerkt: 14 augustus 2026.

Dit document is de actuele bron van waarheid voor de launchstatus van `ALKAVisuals/legend-stories-website`. Historische Sprint- en Stripe-documenten beschrijven eerdere ontwikkelfasen maar bepalen niet langer de doelarchitectuur.

## Samenvatting

De storefront, centrale catalogus, productpaginageneratie, browsercommerce, autoritatieve orderberekening, Neon order-store, Netlify Function-adapters en kwaliteitsketen zijn grotendeels gebouwd en uitgebreid getest.

De definitieve launchkeuze is:

- **Netlify** als enige production host;
- **PayPal** als enige payment provider voor launch;
- **Neon Postgres** als eigen LegendMural orderdatabase;
- **Stripe** uitsluitend tijdelijk als legacy/fallbackcode totdat PayPal Sandbox + Neon inclusief webhook/reconciliation volledig bewezen is.

De PayPal webhook/reconciliationcode is nu geïmplementeerd in draft PR #85. PayPal Live is niet geactiveerd. De volgende echte releaseblokkade is een gecontroleerde PayPal Sandbox + Neon stagingvalidatie met een werkelijk Sandbox-webhookevent.

## Afgerond

### Product en content

- centrale catalogus met 111 producten en 6 batches;
- centrale runtime-productregistratie;
- gedeelde productpaginatemplate;
- alle 111 productpagina’s generator-managed en reproduceerbaar;
- related-productsvalidatie;
- catalogus-, structured-data- en productpaginapariteitscontroles;
- eerdere kapotte interne routes en duplicate SEO-titels opgelost.

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
- duplicate cart-persistence verwijderd;
- hosted checkout-client ondersteunt provideridentiteit en PayPal order IDs;
- PayPal return/capture-client aanwezig;
- Google Places blijft optioneel en kan handmatige adresinvoer niet blokkeren;
- adresvalidatie heeft timeout/fallback zodat checkout niet blijft hangen;
- success- en cancelpagina’s zijn aanwezig en `noindex`;
- winkelwagen wordt niet alleen op basis van een return-URL geleegd;
- oude winkelwagenafbeeldingen kunnen naar actuele Netlify/Vite assets worden hersteld.

### Server-side orderbeveiliging

- autoritatieve orderquote uit centrale productdata;
- browserprijzen, namen en totalen worden genegeerd;
- bedragen worden in gehele eurocenten berekend;
- durable pending-ordervereiste vóór hosted checkout-response;
- privacy-minimale orderstatusresponse;
- verified paid-only cart cleanup;
- provider-neutrale delen van het order-store contract blijven behouden.

### PayPal

- sandbox-first PayPal API-client;
- create-order handler;
- server-side PayPal Order payload uit autoritatieve quote;
- PayPal approval redirectvalidatie;
- capture handler;
- capture-idempotency;
- controle dat PayPal amount/currency/reference bij de gereserveerde order horen;
- Neon PayPal capture persistence;
- bestaande `paid` order geeft idempotent duplicate-resultaat;
- PayPal order-ID ondersteuning in orderstatus en returnflow;
- Netlify Functions voor PayPal create order, capture en webhook;
- same-origin routes `/api/paypal/checkout`, `/api/paypal/capture` en `/api/paypal/webhook`;
- officiële PayPal postback-signatureverificatie;
- `webhook_event` wordt in de verificatiecall exact zoals ontvangen teruggestuurd zonder parse/re-serialize;
- environment-specifieke `PAYPAL_WEBHOOK_ID`;
- `PAYMENT.CAPTURE.COMPLETED` kan Neon onafhankelijk naar `paid` reconciliëren;
- `CHECKOUT.ORDER.APPROVED` kan recovery-capture uitvoeren met dezelfde stabiele capture-idempotency-key als de browserflow;
- `CHECKOUT.PAYMENT-APPROVAL.REVERSED`, `PAYMENT.CAPTURE.PENDING` en `PAYMENT.CAPTURE.DECLINED` hebben gecontroleerde niet-paid verwerking;
- late niet-paid events kunnen een reeds betaalde order niet laten regresseren;
- unsupported verified events muteren geen orders;
- refund/reversal state handling is bewust uitgesteld tot een aparte financiële state-machine;
- PayPal Live blijft fail-closed tenzij server-side expliciet toegestaan.

### Neon Postgres

- provider-neutraal order-store contract;
- herbruikbare conformance-suite;
- Neon Postgres in Frankfurt gebruikt voor de geïsoleerde testomgeving;
- bestaande order- en Stripe-eventmigraties behouden;
- provider-aware PayPal reconciliationmigratie toegevoegd zonder historische migraties te herschrijven;
- `payment_provider` wordt door PostgreSQL uit het payment session/order ID afgeleid;
- `paypal_webhook_events` ledger met order-FK en minimale eventidentiteit;
- event-ledger runtime grants zijn beperkt tot `SELECT` en `INSERT`;
- webhookevent en ordermutatie delen één `SERIALIZABLE` transactie;
- transacties, `FOR UPDATE`, locking en versiecontrole;
- expliciete JSONB-serialisatie;
- bounded retries/backoff voor retryable serializable conflicts;
- pinned Neon- en WebSocketdependencies;
- eerdere echte Neon-migraties en order-store conformance uitgevoerd;
- nieuwe PayPal-migraties/reconciliation zijn in de handmatige Neon integration harness opgenomen maar nog niet opnieuw tegen de geïsoleerde echte Neon testomgeving uitgevoerd;
- synthetische fixture-cleanup aanwezig.

Voor productie blijven vereist:

- dedicated least-privilege runtime-rol;
- aparte productieomgeving;
- backup-/restorebeleid;
- privacy-/retentiebeleid.

### Netlify

- `netlify.toml` aanwezig;
- Node.js 22 voor de Netlify-build;
- PayPal create-order Function;
- PayPal capture Function;
- PayPal webhook Function;
- orderstatus Function;
- same-origin PayPal/runtime routes;
- gedeelde Neon order-store inclusief webhook-store geïnjecteerd in serverhandlers;
- fail-closed gedrag wanneer vereiste configuratie ontbreekt;
- productcatalogus beschikbaar voor Function-bundling;
- aparte Node 22 Netlify-compatibiliteitsworkflow;
- Netlify is de enige beoogde production host.

### Performance en media

- repository-wide mediareferentieaudit;
- 9 volledig ongebruikte bestanden verwijderd;
- ongeveer 12,8 MB ongebruikte media verwijderd;
- collectie-video’s van ongeveer 22,23 MB naar 7,16 MB gebracht;
- ongebruikte video-audio verwijderd waar usages muted zijn;
- posters toegevoegd;
- adaptief videoladen voor viewport, visibility, Reduced Motion en Save-Data;
- grote actieve rasterbestanden geclassificeerd;
- vijf homepage-marketingafbeeldingen als WebP toegevoegd;
- ongeveer 85,52% potentiële transferreductie voor die vijf afbeeldingen;
- browserderivatives voor zware transparante productafbeeldingen;
- originele product-/printbronnen behouden.

### Codekwaliteit en CI

- uitvoerbare inline scripts geëxternaliseerd;
- inline handlers sterk gecentraliseerd;
- accessibility/purchase-flow contracten toegevoegd;
- permanente repository-, CSS-, dependency-, media-, image-, video- en runtime-audits;
- permanente commerce-, order-, Neon- en buildvalidatie;
- unit tests en Vite-productiebuild in de quality gate;
- aparte Node 22 Netlify-compatibiliteitscontrole;
- PayPal webhooktests dekken signatureverificatie, exact raw postback, matching, duplicates, recovery, mode/provider/order/amount/currency mismatch en paid-state non-regression;
- normale GitHub Actions-permissie is `contents: read`;
- GitHub Pages is geen production deploymentpad meer.

## Tijdelijke legacy: Stripe

De repository bevat nog Stripecode uit de eerdere betalingsarchitectuur, waaronder servermodules, Netlify fallbackroutes, validators, tests en documentatie.

Dit is **niet** de beoogde launchprovider.

De veilige migratievolgorde is nu:

1. PayPal webhook/reconciliation bouwen — **code gereed in draft PR #85**;
2. PayPal Sandbox + Neon staging volledig bewijzen;
3. regressietests voor create, capture, return, duplicate events en foutpaden groen krijgen tegen de stagingomgeving;
4. daarna Stripe in een aparte gecontroleerde cleanup-PR verwijderen;
5. volledige quality/build regression opnieuw uitvoeren.

Provider-neutrale order-, security- en Neoncomponenten moeten tijdens die cleanup behouden blijven.

## Actuele releaseblokkades

### 1. PayPal Sandbox + Neon staging

De webhook/reconciliationcode is gebouwd, maar moet nog tegen een dedicated stagingomgeving worden bewezen met uitsluitend:

- geïsoleerde staging Neon;
- PayPal Sandbox Client ID/Secret;
- een echte Sandbox webhooklistener + environment-specifieke `PAYPAL_WEBHOOK_ID`;
- Netlify staging/Deploy Preview environment variables;
- synthetische klantdata.

PayPal's webhook simulator is niet voldoende voor onze gekozen postback-signatureverificatie. Gebruik een werkelijk event uit de gekoppelde Sandbox REST app.

Zie [`PAYPAL_STAGING.md`](PAYPAL_STAGING.md).

### 2. Complete end-to-end test

Minimaal bewijzen:

1. cart → serverquote;
2. pending order in Neon vóór checkout-response;
3. PayPal Sandbox order creation;
4. approval;
5. server capture;
6. Neon `paid`;
7. echte webhook-signatureverificatie;
8. webhook/reconciliation en event-ledger;
9. privacy-minimale orderstatus;
10. paid-only cart cleanup;
11. duplicate capture/webhook/refresh blijft idempotent;
12. browseronderbreking na PayPal capture wordt door `PAYMENT.CAPTURE.COMPLETED` hersteld;
13. late `PENDING` regresseert `paid` niet;
14. cancel/failure behoudt de cart;
15. gemanipuleerde browserprijzen worden genegeerd.

Test daarbij Compact, Statement, `LEGEND10`, NL/EU/VS shipping en free shipping vanaf €69.

### 3. Storefront launch cleanup

De zichtbare site bevat nog oude launchrestanten die vóór officiële publicatie moeten worden gecorrigeerd, waaronder:

- `Legend Stories` branding op verschillende plekken;
- oude GitHub Pages canonical/Open Graph URLs;
- social proof/trustclaims zoals `1K+ Sold`, `4.9★ On Trustpilot` en `Best seller` wanneer deze niet aantoonbaar onderbouwd zijn;
- footer/help/legal routes en betaalbadges controleren op feitelijke juistheid;
- definitief domain/SEO beleid pas toepassen zodra het publieke domein is bevestigd.

### 4. Legal / commerce operations

Voor officiële launch nog afronden/valideren:

- privacy;
- returns/herroepingsrecht;
- refunds;
- algemene voorwaarden;
- shipping/customscommunicatie;
- bedrijfs- en contactgegevens;
- IP-/portret-/auteursrecht-/trademarkcontrole van de artworkcatalogus;
- support-, fulfillment-, refund- en disputeproces.

## Voor productie nog vereist

- PayPal webhook/reconciliation met echt Sandbox-event bewezen;
- PayPal Sandbox E2E volledig groen;
- legacy Stripe gecontroleerd verwijderd;
- productie-Neonomgeving;
- dedicated least-privilege runtime-rol;
- backup-/restorebeleid;
- privacy-/retentiebeleid;
- aparte Netlify production variables;
- volledig geverifieerd PayPal Business-account;
- PayPal Live app/credentials uitsluitend server-side;
- PayPal Live webhook;
- expliciete live enablement uitsluitend server-side;
- definitief publiek domein en HTTPS;
- canonical, sitemap, robots en social metadata op het definitieve domein;
- monitoring/logging/incidentprocedure;
- operationeel order-, refund-, fulfillment- en klantenserviceproces;
- gecontroleerde kleine echte betaling;
- rollbackprocedure.

## Technische verbeteringen die niet launch-blocking zijn

- resterende classic-scriptarchitectuur verder modulariseren;
- additional responsive/performance audits;
- technische SEO voor collecties/breadcrumbs;
- uitgebreidere interactie- en device-tests;
- workflow/artifact-retentie verder optimaliseren;
- aparte refund/reversal state-machine ontwerpen zodra het operationele refundbeleid en vereiste PayPal payloadcontract zijn vastgesteld.

## Niet vóór launch nodig

- klantaccounts;
- wishlist;
- loyalty;
- uitgebreide search;
- grote analyticsstack;
- abandoned-cartplatform;
- frameworkrewrite.

## Werkafspraken

- iedere wijziging begint met analyse en een beperkte scope;
- wijzigingen gaan via branch en PR;
- geen merge zonder expliciete goedkeuring;
- geen productie-Netlifywijziging zonder afzonderlijke toestemming;
- geen secrets in chat of repository;
- GitHub Pages wordt niet als tweede production host onderhouden;
- Stripe wordt pas verwijderd na bewezen PayPal staging;
- Neon blijft behouden als orderdatabase;
- originele product- en printmedia worden niet overschreven door browseroptimalisatie;
- een groene quality gate vervangt geen handmatige UX-, payment- of infrastructuurreview.
