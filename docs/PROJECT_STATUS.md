# LegendMural projectstatus

Laatst inhoudelijk bijgewerkt: 7 augustus 2026.

Dit document beschrijft de actuele repositorystatus en de eerstvolgende releaseblokkade. Het bewijst niet dat productie-secrets, live Stripe of het definitieve publieke domein zijn geactiveerd.

## Samenvatting

De storefront, catalogusarchitectuur, productpaginageneratie, browsercommerce, autoritatieve orderberekening, Stripe-contracten, Neon order-store, Netlify Function-adapters en kwaliteitsketen zijn geïmplementeerd en uitgebreid getest.

De geïsoleerde echte Neon-integratie is uitgevoerd. PR #74 heeft de daarbij gevonden JSONB-serialisatie- en serializable-transactionproblemen opgelost. PR #81 heeft Netlify vastgelegd als enige production host en de GitHub Pages production-lijn verwijderd.

De huidige releaseblokkade zit niet meer in de repositorycode maar in de externe Netlify stagingconfiguratie: een dedicated stagingdeployment moet nog veilig worden gekoppeld aan een staging-Neon runtime-URL en Stripe-testcredentials. Live betalingen blijven uitgeschakeld.

## Afgerond

### Product en content

- centrale catalogus met 111 producten en 6 batches;
- gedeelde productpaginatemplate en reproduceerbare managed productpagina’s;
- centrale runtime-productregistratie en related-productsvalidatie;
- canonical-, structured-data- en cataloguspariteitcontroles;
- kapotte interne routes en duplicate SEO-titels opgelost.

### Launch commerce

- Compact: maximaal 50 × 30 cm voor €35 incl. btw;
- Statement: maximaal 50 × 50 cm voor €45 incl. btw, standaard en aanbevolen;
- originele ontwerpverhoudingen blijven behouden binnen de productiedoos;
- publieke kortingscode `LEGEND10` voor 10%;
- Nederland: €4,95 verzending;
- EU: €9,95 verzending;
- Verenigde Staten: €9,95 tracked verzending;
- gratis verzending vanaf €69 in ondersteunde markten;
- bestemmingen buiten NL, EU en VS worden geblokkeerd.

### Browsercommerce

- winkelwagen en productidentiteit centraal bewaakt;
- korting en shipping worden opnieuw gevalideerd;
- browser Checkout-client gebruikt same-origin runtimeconfiguratie;
- Google Places heeft timeout en handmatige fallback;
- `order-success.html` en `order-cancelled.html` zijn aanwezig en `noindex`;
- return-URL alleen is nooit voldoende om de winkelwagen te legen;
- oude winkelwagenafbeeldingen kunnen via de runtime-productregistratie naar actuele Netlify/Vite-assets worden hersteld.

### Server-side orderbeveiliging

- autoritatieve orderquote uit centrale productdata;
- browserprijzen, namen en totalen worden genegeerd;
- bedragen worden in gehele eurocenten berekend;
- Stripe Checkout-boundary dwingt standaard testmodus af;
- deterministische idempotency keys;
- durable pending-ordervereiste vóór Checkout-response;
- ondertekende Stripe-webhookvalidatie;
- monotone orderstatusovergangen;
- privacy-minimale orderstatusresponse;
- verified paid-only cart cleanup.

### Neon Postgres

- provider-neutraal order-store contract en conformance-suite;
- echte Neon-migraties en order-store conformance uitgevoerd;
- concurrent transact gedrag tegen echte PostgreSQL gevalideerd;
- expliciete JSONB-serialisatie voor pending orders;
- bounded retries met backoff voor retryable serializable conflicts;
- synthetische fixture-cleanup aanwezig;
- productie vereist nog een dedicated least-privilege runtime-rol en vastgesteld backup-/privacybeleid.

### Netlify architectuur

- Netlify is de enige beoogde production host;
- Node.js 22 voor Netlify-builds;
- Functions voor checkout, Stripe webhook en orderstatus;
- same-origin routes `/api/checkout`, `/api/order-status` en `/api/stripe-webhook`;
- gedeelde Neon order-store wordt in de serverhandlers geïnjecteerd;
- commerce Functions falen bewust gesloten wanneer vereiste configuratie ontbreekt;
- productcatalogus wordt expliciet meegebundeld;
- aparte Node 22 Netlify-compatibiliteitsworkflow aanwezig;
- live Stripe-activering blijft uitgesloten.

### Kwaliteit, accessibility en media

- permanente repository-, CSS-, dependency-, media-, image-, video- en runtime-audits;
- permanente commerce-, Stripe-, Neon- en ordervalidatie;
- unit tests en Vite-productiebuild in de quality gate;
- aparte accessibility- en purchase-flow audit;
- Netlify Node 22 compatibility groen op de Netlify-first cleanup;
- collectie-video’s en homepage-marketingmedia geoptimaliseerd zonder originele print-/productbronnen te overschrijven;
- GitHub Pages is geen production deploymentpad meer.

## Bewezen stagingstatus — 7 augustus 2026

Er is een side-effect-free runtimeprobe uitgevoerd tegen:

1. de eerdere Netlify Deploy Preview van PR #81;
2. `https://legendmural.netlify.app`.

Beide storefronts antwoordden met HTTP 200. Bij beide deployments antwoordde `/api/checkout` echter met HTTP 503 `CHECKOUT_SERVICE_NOT_CONFIGURED`.

De Function-code en routing zijn dus bereikbaar, maar de externe runtime heeft nog geen bruikbare `NEON_DATABASE_URL`. Dit is geen Deploy Preview-specifiek probleem: ook de primaire Netlifycontext mist op dit moment de commerce-databaseconfiguratie.

Er zijn tijdens deze probes geen orders, Stripe Checkout Sessions of database-writes aangemaakt.

## Actuele releaseblokkade

### Dedicated Netlify staging activeren

De eerstvolgende stap is één afzonderlijke stagingcontext configureren met uitsluitend test/stagingwaarden. Gebruik de primaire Netlify production context niet als tijdelijke secretcontainer.

Staging heeft nodig:

- gepoolde `NEON_DATABASE_URL` van de geïsoleerde staging-Neonbranch/runtime-rol;
- `STRIPE_SECRET_KEY` met uitsluitend een `sk_test_` key;
- `STRIPE_WEBHOOK_SECRET` van het Stripe test-webhookendpoint;
- `CHECKOUT_SUCCESS_URL=<STAGING_ORIGIN>/order-success.html`;
- `CHECKOUT_CANCEL_URL=<STAGING_ORIGIN>/order-cancelled.html`;
- `CHECKOUT_ALLOWED_ORIGINS=<STAGING_ORIGIN>`;
- `STRIPE_ALLOW_LIVE=false` of volledig afwezig.

Het Stripe test-webhookendpoint is:

```text
<STAGING_ORIGIN>/api/stripe-webhook
```

Ondersteunde events:

- `checkout.session.completed`;
- `checkout.session.async_payment_succeeded`;
- `checkout.session.async_payment_failed`;
- `checkout.session.expired`.

Zie [`NETLIFY_STAGING_ACTIVATION.md`](NETLIFY_STAGING_ACTIVATION.md) voor de volledige veilige activatie- en acceptatieprocedure.

## Stagingacceptatie

Voor een echte testbetaling wordt eerst de handmatige **Netlify staging readiness probe** uitgevoerd. Deze controleert Neon-, checkout URL-, Stripe test-key-, order-status- en webhookconfiguratie zonder een order of Stripe Session te creëren.

Pas na een volledig groene readiness-probe wordt één synthetische end-to-end testorder uitgevoerd:

1. product → cart;
2. autoritatieve serverquote;
3. durable pending order in staging-Neon;
4. Stripe `cs_test_...` Checkout Session;
5. Stripe testbetaling;
6. ondertekende webhook;
7. status `paid` in Neon;
8. verified return op `order-success.html`;
9. paid-only cart cleanup;
10. idempotente refresh/duplicate webhook.

Cancel, failure en expiry moeten de winkelwagen behouden.

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

De 120 HTML-pagina’s met de oude GitHub Pages-origin in canonical/Open Graph metadata worden pas in een aparte domein-/SEO-sprint gemigreerd zodra het definitieve publieke LegendMural-domein vaststaat.

## Werkafspraken

- iedere wijziging begint met analyse en beperkte scope;
- codewijzigingen gaan via branch en PR;
- geen merge zonder expliciete goedkeuring;
- geen productie-Netlifywijziging zonder afzonderlijke toestemming;
- geen secrets in chat, repository, issues of PR-comments;
- GitHub Pages wordt niet als tweede production host onderhouden;
- staging gebruikt uitsluitend synthetische data en Stripe-testmodus;
- performanceoptimalisatie overschrijft nooit originele product- of printbronnen;
- een groene quality gate vervangt geen handmatige UX- of infrastructuurreview.
