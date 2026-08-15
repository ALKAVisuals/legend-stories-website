# LegendMural projectstatus

Laatst inhoudelijk bijgewerkt: 15 augustus 2026.

Dit document is de actuele bron van waarheid voor de launchstatus van `ALKAVisuals/legend-stories-website`. Historische Sprint- en Stripe-documenten beschrijven eerdere ontwikkelfasen maar bepalen niet langer de doelarchitectuur.

## Samenvatting

De storefront, centrale catalogus, productpaginageneratie, browsercommerce, autoritatieve orderberekening, Neon order-store, Netlify Function-adapters en kwaliteitsketen zijn grotendeels gebouwd en uitgebreid getest.

De definitieve launchkeuze is:

- **Netlify** als enige production host;
- **PayPal** als enige payment provider voor launch;
- **Neon Postgres** als eigen LegendMural orderdatabase;
- **geen actieve Stripe checkout- of webhookruntime**; historische Stripe databasevelden/migraties en read-compatibiliteit blijven uitsluitend behouden voor bestaande audit-/orderdata.

Op 15 augustus 2026 is eerst de kernketen daadwerkelijk bewezen tegen PayPal Sandbox + de geïsoleerde Neon stagingbranch: echte order creation via een Netlify Deploy Preview, buyer approval, server-side capture, Neon `paid`, plus echte `CHECKOUT.ORDER.APPROVED` en `PAYMENT.CAPTURE.COMPLETED` webhookdeliveries in de event-ledger. Daarna is ook de volledige browser-native storefront happy path bewezen: product → cart → checkout → PayPal Sandbox → automatische return → serververificatie → `Payment confirmed` → paid-only cart cleanup, zonder handmatige refresh. Duplicate webhookdelivery, cancel/cart preservation en browserinterruption met webhook recovery zijn eveneens end-to-end bewezen. PayPal Live is niet geactiveerd.

De actieve legacy Stripe-runtime is verwijderd en de cleanup is via PR #87 naar `main` gemerged. De post-merge Quality-, Accessibility/purchase-flow- en Netlify-compatibiliteitschecks zijn opnieuw groen bevestigd.

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
- hosted checkout-client accepteert voor nieuwe checkouts uitsluitend `provider: 'paypal'` en PayPal order IDs;
- ontbrekende of expliciete legacy-provideridentiteit wordt fail-closed geweigerd;
- PayPal return/capture-client aanwezig;
- Google Places blijft optioneel en kan handmatige adresinvoer niet blokkeren;
- adresvalidatie heeft timeout/fallback zodat checkout niet blijft hangen;
- success- en cancelpagina’s zijn aanwezig en `noindex`;
- winkelwagen wordt niet alleen op basis van een return-URL geleegd;
- orderstatus gebruikt bounded polling zodat een normale PayPal-return automatisch kan wachten op serverbevestiging;
- de payment-returnmodule wordt runtime geladen zodat deployment-generated Netlify commerce-routes niet in een oude Vite-bundle worden vastgebakken;
- browser-native PayPal Sandbox happy path is end-to-end bewezen en eindigde automatisch in `Payment confirmed` met paid-only cart cleanup;
- oude winkelwagenafbeeldingen kunnen naar actuele Netlify/Vite assets worden hersteld.

### Server-side orderbeveiliging

- autoritatieve orderquote uit centrale productdata;
- browserprijzen, namen en totalen worden genegeerd;
- bedragen worden in gehele eurocenten berekend;
- durable pending-ordervereiste vóór hosted checkout-response;
- checkout-persistence vereist voor nieuwe checkouts expliciet PayPal en accepteert geen impliciete Stripe-default meer;
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
- PayPal Live blijft fail-closed tenzij server-side expliciet toegestaan;
- echte Sandbox buyer approval en server-side capture zijn op 15 augustus 2026 tegen Netlify Deploy Previews uitgevoerd;
- dezelfde echte Sandboxbetaling leverde geverifieerde `CHECKOUT.ORDER.APPROVED` en `PAYMENT.CAPTURE.COMPLETED` webhookevents op in Neon;
- een volledige browser-native storefrontbetaling is succesvol afgerond tot `Payment confirmed`, zonder Ctrl+R of andere handmatige bevestigingsactie;
- duplicate webhook redelivery is idempotent bewezen;
- cancel vóór capture met cart preservation is end-to-end bewezen;
- browserinterruption vóór capture-response is end-to-end hersteld via PayPal webhook recovery.

### Neon Postgres

- provider-neutraal order-store contract;
- herbruikbare conformance-suite;
- Neon Postgres in Frankfurt gebruikt voor de geïsoleerde testomgeving;
- bestaande order- en Stripe-eventmigraties behouden;
- provider-aware PayPal reconciliationmigratie toegevoegd zonder historische migraties te herschrijven;
- `payment_provider` blijft bestaande provideridentiteit kunnen lezen voor historische orders;
- `paypal_webhook_events` ledger met minimale eventidentiteit;
- event-ledger runtime grants zijn beperkt tot `SELECT` en `INSERT`;
- webhookevent en ordermutatie delen één `SERIALIZABLE` transactie;
- transacties, `FOR UPDATE`, locking en versiecontrole;
- expliciete JSONB-serialisatie;
- bounded retries/backoff voor retryable serializable conflicts;
- pinned Neon- en WebSocketdependencies;
- PayPal-migraties zijn toegepast op de geïsoleerde `order-store-integration` stagingbranch;
- echte stagingorders bewezen `payment_pending → paid`, `version 0 → 1` en éénmalige `paid_at`;
- echte PayPal webhookevents zijn duurzaam in `paypal_webhook_events` geregistreerd;
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
- legacy Stripe checkout- en webhookroutes zijn verwijderd;
- gedeelde Neon order-store inclusief webhook-store geïnjecteerd in serverhandlers;
- fail-closed gedrag wanneer vereiste configuratie ontbreekt;
- productcatalogus beschikbaar voor Function-bundling;
- aparte Node 22 Netlify-compatibiliteitsworkflow;
- de compatibiliteitsworkflow valideert `/api/paypal/checkout`, `/api/paypal/capture`, `/api/order-status` en de ongebundelde runtime payment-returnmodule;
- Netlify is de enige beoogde production host;
- PayPal Sandbox is met de geïsoleerde Neon stagingbranch via Deploy Previews gevalideerd;
- tijdelijke stagingdiagnose/workflows zijn na de echte betaling weer verwijderd.

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
- Stripe-only validators/tests/workflowgates zijn verwijderd of, waar de onderliggende securitycoverage provider-neutraal was, naar PayPal/provider-neutrale tests gemigreerd;
- normale GitHub Actions-permissie is `contents: read`;
- GitHub Pages is geen production deploymentpad meer.

## Legacy Stripe: runtime verwijderd, historie behouden

De **actieve** Stripe-betaalruntime is verwijderd en de cleanup is via PR #87 gemerged. Nieuwe storefrontcheckouts kunnen niet meer via Stripe worden aangemaakt of verwerkt.

Verwijderd zijn onder andere:

- Stripe checkout- en webhook Netlify Functions/routes;
- Stripe server-API handlers;
- Stripe API-/checkout-/webhook paymentmodules;
- Stripe-eventverwerking uit de algemene Neon runtime;
- Stripe-only validators, CI-gates en tests die geen provider-neutrale waarde hadden.

Bewust behouden voor historische/auditcompatibiliteit:

- bestaande migrations en databasevelden die eerdere Stripe-orders/events beschrijven;
- historische provideridentiteit/read-compatibiliteit voor bestaande orderrecords;
- historische Stripe-eventmetadata waar bestaande schema's of auditdata daarvan afhankelijk zijn;
- documentatie die expliciet als historische context is gemarkeerd.

Deze scheiding is bewust: **geen actieve Stripe-runtime, geen destructieve databasecleanup van historische data**. De cleanup is gemerged en de post-merge Quality-, Accessibility/purchase-flow- en Netlify-compatibiliteitschecks zijn opnieuw groen bevestigd.

## Actuele releaseblokkades

### 1. Resterende PayPal regressie- en edgecases

De echte Sandbox/Neon kernketen, browser-native happy path, duplicate webhookdelivery, cancel/cart preservation en interruption/recovery zijn bewezen. Nog aanvullend valideren vóór livegang:

1. tijdelijke PayPal API- of signatureverificatiestoring faalt gecontroleerd;
2. tijdelijke Neon-fout faalt gecontroleerd en kan veilig worden herprobeerd;
3. gemanipuleerde browserprijzen en productdata blijven server-side genegeerd;
4. resterende concurrency/idempotencycases blijven groen op de actuele `main`-baseline;
5. volledige commerce-matrix voor Compact, Statement, `LEGEND10`, NL/EU/VS shipping en free shipping vanaf €69;
6. volledige Quality, Netlify compatibility, accessibility/purchase-flow en productiebuild blijven groen op launch-gerichte PR's.

### 2. Storefront launch cleanup

De zichtbare site bevat nog oude launchrestanten die vóór officiële publicatie moeten worden gecorrigeerd, waaronder:

- `Legend Stories` branding op verschillende plekken;
- oude GitHub Pages canonical/Open Graph URLs;
- social proof/trustclaims zoals `1K+ Sold`, `4.9★ On Trustpilot` en `Best seller` wanneer deze niet aantoonbaar onderbouwd zijn;
- zichtbare prijs- en shippingcopy gelijkzetten met de centrale commerceconfiguratie;
- placeholder contactgegevens verwijderen of vervangen door geverifieerde bedrijfsgegevens;
- footer/help/legal routes en betaalbadges controleren op feitelijke juistheid;
- definitief domain/SEO beleid pas toepassen zodra het publieke domein is bevestigd.

### 3. Legal / commerce operations

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

- resterende PayPal Sandbox negatieve/idempotencycases;
- volledige launch-gerichte regressie- en commerce-matrix groen;
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
- nieuwe checkouts zijn PayPal-only; historische Stripe schema-/auditcompatibiliteit wordt niet destructief verwijderd;
- Neon blijft behouden als orderdatabase;
- originele product- en printmedia worden niet overschreven door browseroptimalisatie;
- een groene quality gate vervangt geen handmatige UX-, payment- of infrastructuurreview.