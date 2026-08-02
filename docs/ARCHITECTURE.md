# LegendMural architecture

## 1. Doel en uitgangspunten

LegendMural is een statische multi-page storefront met een voorbereid server-side commerce- en betaalmodel. De architectuur kiest bewust voor:

- snelle statische pagina’s;
- centrale product- en commerce-data;
- reproduceerbare productpagina’s;
- zo weinig mogelijk browservertrouwen;
- provider-neutrale servercontracten;
- kleine, gecontroleerde infrastructuurstappen;
- permanente validatie van kritieke aannames.

De browserstorefront is bruikbaar zonder actieve hosted checkout. Betalings- en databasecode blijft fail-closed zolang endpoints, secrets of een duurzame store ontbreken.

## 2. Hoofdcomponenten

### Storefront

De storefront bestaat uit root-HTML-pagina’s, gedeelde CSS en browsermodules in `js/`.

Verantwoordelijkheden:

- navigatie en mobiele menu’s;
- productpresentatie;
- winkelwagen en lokale voorkeuren;
- kortingscode-invoer;
- checkoutformulier;
- optionele hosted Checkout-client;
- verified order-return UI;
- adaptieve media- en videoloading.

De browser berekent bedragen voor presentatie, maar die bedragen zijn nooit autoritatief voor een serverbetaling.

### Centrale productcatalogus

`data/products/catalog.json` is de inhoudelijke autoriteit voor de 111 producten.

Belangrijke gegevens:

- product-ID en slug;
- pagina en canonical URL;
- naam en beschrijving;
- prijs en valuta;
- beschikbaarheid;
- batch en collectie;
- mediareferenties.

De runtime-productregistratie wordt hieruit gegenereerd. Validators bewaken dat live productpagina’s, runtimegegevens en catalogus niet uiteenlopen.

### Productpaginagenerator

`templates/product-page.html` is de gedeelde presentatiebasis voor alle productpagina’s. Batchspecifieke presentatiegegevens vullen de template aan.

Datastroom:

```text
catalogus + presentatiemanifest + gedeelde template
                         ↓
                gegenereerde productpagina
                         ↓
              live root-HTML + validatie
```

De live productpagina’s moeten byte-identiek opnieuw gegenereerd kunnen worden. Handmatige afwijkingen worden afgekeurd.

### Commercebeleid

Centrale modules bepalen:

- geldige productidentiteiten;
- prijzen;
- kortingscodes;
- shipping zones en verzendkosten;
- gratis-verzenddrempels;
- centnauwkeurige afronding.

Deze regels worden zowel door browservalidatie als server-side orderquotes gebruikt, maar alleen de serverquote is autoritatief voor betaling.

### Autoritatieve orderquote

De server-side orderquote ontvangt een minimale winkelwagenaanvraag en:

1. valideert product-ID’s en aantallen;
2. zoekt productdata opnieuw op in de centrale catalogus;
3. negeert browsernamen, browserprijzen en browsertotalen;
4. past korting en verzending centraal toe;
5. rekent alles om naar gehele eurocenten;
6. retourneert de enige geldige basis voor Checkout en orderopslag.

### Stripe Checkout-boundary

De voorbereidende Stripe-laag:

- accepteert standaard alleen `sk_test_`-keys;
- blokkeert live modus tenzij die server-side expliciet wordt toegestaan;
- bouwt line items uit de autoritatieve quote;
- gebruikt deterministische idempotency keys;
- beheert success- en cancel-URL’s server-side;
- retourneert alleen gevalideerde Stripe Checkout-URL’s.

Zonder een duurzame order-store wordt geen Checkout-URL teruggegeven.

### Order-store contract

Alle servergrenzen gebruiken één centraal order-store capability contract voor:

- pending Checkout-orders opslaan;
- Stripe-events atomair verwerken;
- orderstatus veilig opvragen.

Een provider-neutrale conformance-suite valideert iedere adapter op:

- idempotente ordercreatie;
- conflictbehandeling;
- detached reads;
- concurrente identieke writes;
- dubbele Stripe-events;
- ontbrekende orders.

### Neon Postgres-adapter

Neon Postgres is gekozen voor toekomstige duurzame orderopslag.

De adapter gebruikt:

- TLS-only Neon-URL’s;
- SERIALIZABLE transacties;
- row locking;
- optimistische versiecontroles;
- atomaire Stripe-eventreservering;
- aparte migratie- en least-privilege runtimerollen.

De code en integratieharness staan klaar, maar de echte database-integratietest is nog niet uitgevoerd.

### Stripe webhook

De webhookboundary:

- valideert de handtekening op de exacte raw body;
- gebruikt HMAC-SHA256 en timing-safe vergelijking;
- weigert te oude, gemanipuleerde of ongeldige events;
- controleert reference, session ID, bedrag, valuta en test/live modus;
- verwerkt dubbele events idempotent;
- voorkomt regressie van reeds betaalde orders.

### Verified order return

De returnpagina vertrouwt de querystring niet als betalingsbewijs.

De browser:

1. vergelijkt de teruggekeerde Checkout Session met eerder opgeslagen sessiedata;
2. vraagt orderstatus op via het serverendpoint;
3. verwacht een exacte match op orderreferentie en Checkout Session;
4. leegt alleen bij een serverbevestigde `paid`-status de Checkout-gerelateerde browserdata;
5. behoudt de winkelwagen bij pending, failed, expired of onbereikbare status.

### Media delivery

De medialaag gebruikt:

- actieve-reference audits;
- duplicate- en orphan-detectie;
- metadata-inspectie via FFprobe;
- WebP-derivatives met SSIM- en grootteguardrails;
- geoptimaliseerde H.264-video’s met SSIM/PSNR-grenzen;
- posters en `preload="none"`;
- viewport-, visibility-, Reduced Motion- en Save-Data-beleid.

Originele transparante product- en printbronnen blijven behouden.

## 3. Build- en quality-architectuur

Vite bouwt iedere root-HTML-pagina als afzonderlijke multi-page entry. De build:

1. genereert de runtime-productregistratie;
2. bouwt alle HTML-pagina’s en assets;
3. kopieert benodigde browserruntimebestanden;
4. valideert de uiteindelijke productie-output.

De quality gate controleert:

- repository- en linkintegriteit;
- SEO en metadata;
- CSS en dependencies;
- media- en videodelivery;
- catalogus en productpagina’s;
- browsercommerce;
- orderquote en betalingscontracten;
- databasecontracten en Neon-harness;
- unit tests;
- productiebuild.

## 4. Veiligheidsgrenzen

### Browser

Mag nooit de autoriteit zijn voor:

- productprijs;
- productnaam;
- korting;
- verzendbedrag;
- totaalbedrag;
- betalingsstatus.

### GitHub

- secrets mogen niet in commits, logs, issues of PR’s verschijnen;
- normale workflows gebruiken `contents: read`;
- tijdelijke schrijfworkflows moeten vóór merge worden verwijderd of teruggebracht naar read-only;
- iedere risicovolle migratie krijgt een permanente validator.

### Database

- migraties gebruiken een aparte directe verbinding;
- runtime gebruikt een gepoolde least-privilege verbinding;
- integratietests gebruiken alleen synthetische data;
- productiegegevens mogen nooit in de integratiebranch worden geplaatst.

### Deployment

- Netlifywijzigingen zijn een afzonderlijke sprint;
- test- en productievariabelen worden gescheiden;
- live Stripe-modus vereist een aparte expliciete goedkeuring;
- browser-endpointconstants worden pas ingevuld voor een goedgekeurde omgeving.

## 5. Geplande deploymentarchitectuur

De beoogde stagingopzet:

```text
Browser storefront
    ├── POST checkout  ───────┐
    ├── POST order status ────┼── Netlify Functions
    └── Stripe return page ───┘        │
                                       ├── Stripe Checkout API (test mode)
Stripe webhook ────────────────────────┤
                                       └── Neon Postgres staging branch
```

Voor productie worden aparte Neon-, Stripe- en Netlifyconfiguraties gebruikt. Geen stagingsecret wordt naar productie gekopieerd zonder aparte beoordeling.

## 6. Beslissingen die nog openstaan

- definitieve productiebranch- en backupstrategie in Neon;
- Netlify Function-routes en environment scopes;
- definitief publiek domein en canonical/sitemapbeleid;
- monitoring, logging en alerting;
- operationele orderadministratie en supportflow;
- refunds, disputes en handmatige ordercorrecties;
- privacyretentie voor klant- en ordergegevens.

## 7. Niet-doelen van de huidige repositoryfase

De huidige code activeert niet automatisch:

- een Neon-account of databaseproject;
- Netlify Functions;
- Stripe secrets;
- live betalingen;
- productiegegevens;
- klantaccounts of een adminportal.

Die onderdelen worden alleen toegevoegd via afzonderlijk goedgekeurde implementatie- en releasefases.
