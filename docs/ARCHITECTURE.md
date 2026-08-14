# LegendMural architecture

Laatst inhoudelijk bijgewerkt: 14 augustus 2026.

## 1. Doel en uitgangspunten

LegendMural is een statische multi-page storefront met server-side commerce, een Neon Postgres order-store en Netlify Function-adapters voor checkout, capture en orderstatus.

De huidige doelarchitectuur kiest bewust voor:

- snelle statische pagina’s;
- centrale product- en commerce-data;
- reproduceerbare productpagina’s;
- zo weinig mogelijk browservertrouwen;
- duurzame eigen orderopslag in Neon;
- PayPal als enige beoogde payment provider voor launch;
- kleine, gecontroleerde infrastructuurstappen;
- permanente validatie van kritieke aannames;
- één production host: Netlify.

GitHub wordt gebruikt voor broncode, branches, PR’s, CI en reviews. GitHub Pages is geen parallel production target.

De storefront blijft fail-closed wanneer noodzakelijke betaal- of databaseconfiguratie ontbreekt. PayPal Live wordt niet automatisch geactiveerd.

## 2. Hoofdcomponenten

### Storefront

De storefront bestaat uit root-HTML-pagina’s, gedeelde CSS en browsermodules in `js/`.

Verantwoordelijkheden:

- navigatie en mobiele menu’s;
- productpresentatie;
- winkelwagen en lokale voorkeuren;
- kortingscode-invoer;
- checkoutformulier;
- hosted checkout-client;
- PayPal approval/return handling;
- verified order-return UI;
- adaptieve media- en videoloading.

De browser berekent bedragen voor presentatie, maar die bedragen zijn nooit autoritatief voor een serverbetaling.

### Centrale productcatalogus

`data/products/catalog.json` is de inhoudelijke autoriteit voor de 111 producten.

Belangrijke gegevens:

- product-ID en slug;
- pagina-identiteit;
- naam en beschrijving;
- prijs en valuta;
- beschikbaarheid;
- batch en collectie;
- mediareferenties.

De runtime-productregistratie wordt hieruit gegenereerd. Validators bewaken dat live productpagina’s, runtimegegevens en catalogus niet uiteenlopen.

### Productpaginagenerator

`templates/product-page.html` is de gedeelde presentatiebasis voor alle productpagina’s. Batchspecifieke presentatiegegevens vullen de template aan.

```text
catalogus + presentatiemanifest + gedeelde template
                         ↓
                gegenereerde productpagina
                         ↓
              live root-HTML + validatie
```

De live productpagina’s moeten reproduceerbaar opnieuw gegenereerd kunnen worden. Handmatige afwijkingen worden afgekeurd.

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

1. valideert product-ID’s, varianten en aantallen;
2. zoekt productdata opnieuw op in de centrale catalogus;
3. negeert browsernamen, browserprijzen en browsertotalen;
4. past korting en verzending centraal toe;
5. rekent alles om naar gehele eurocenten;
6. retourneert de enige geldige basis voor payment en orderopslag.

### PayPal boundary

De PayPal-laag is sandbox-first en bestaat momenteel uit:

- `server/payments/paypal-api.mjs` voor OAuth en PayPal Orders API-verkeer;
- server-side PayPal order creation uit de autoritatieve quote;
- trusted PayPal approval URL-validatie in de browser;
- server-side capture;
- capture-resultaatvalidatie op order ID, reference, amount en currency;
- idempotency via `PayPal-Request-Id`;
- live-mode guardrail via `PAYPAL_ALLOW_LIVE`.

De standaard API-origin is PayPal Sandbox. De officiële live API-origin wordt alleen geaccepteerd wanneer live mode server-side expliciet is toegestaan.

### Durable checkout persistence

Voor een hosted checkout-response moet de bijbehorende LegendMural-order duurzaam zijn opgeslagen.

De PayPal flow:

1. valideert het request en berekent de autoritatieve quote;
2. maakt/reserveert de PayPal Order met deterministische idempotency;
3. bouwt een autoritatieve `payment_pending` orderrecord;
4. slaat de order duurzaam op in Neon;
5. valideert dat store-resultaat en PayPal order ID bij elkaar horen;
6. retourneert pas daarna de approval URL aan de browser.

### Order-store contract

De codebase heeft één centrale order-store grens voor duurzame orderopslag en orderstatus. Provider-neutrale onderdelen moeten behouden blijven, ook wanneer de tijdelijke Stripecode later wordt verwijderd.

Belangrijke eigenschappen:

- idempotente ordercreatie;
- conflictbehandeling;
- detached reads;
- concurrente identieke writes;
- transactionele statusupdates;
- consistente orderidentiteit;
- privacy-minimale statusresponses.

### Neon Postgres-adapter

Neon Postgres is de duurzame LegendMural order-store.

De adapter gebruikt onder andere:

- TLS-only Neon-URL’s;
- SERIALIZABLE transacties;
- row locking;
- optimistische versiecontroles;
- expliciete JSONB-serialisatie;
- bounded retries voor retryable serializable conflicts;
- gescheiden migratie- en runtimecredentials waar de omgeving dit ondersteunt.

De echte geïsoleerde integratietest is uitgevoerd. Migraties, provider-neutrale conformance en concurrent gedrag tegen echte PostgreSQL zijn gevalideerd. Voor productie blijven een dedicated least-privilege runtime-rol, aparte productieomgeving en backup-/privacybeleid vereist.

### PayPal capture persistence

Na approval wordt PayPal niet door de browser als betaald verklaard. De server:

1. controleert de lokale orderreference en PayPal order ID;
2. haalt de opgeslagen pending order op;
3. weigert mismatches;
4. capturet via de PayPal API;
5. valideert amount/currency/reference/order ID;
6. verwerkt de capture idempotent in Neon;
7. retourneert alleen een `paid` resultaat wanneer de store de betaalde order heeft bevestigd.

Een reeds betaalde order kan veilig als duplicate capture-resultaat terugkomen zonder tweede ordermutatie.

### PayPal webhook — nog te implementeren

De huidige create/capture flow is nog niet de volledige productiearchitectuur.

Voor productie moet een PayPal webhook/reconciliationlaag worden toegevoegd die:

- PayPal events server-side verifieert;
- event- en paymentidentiteit tegen de opgeslagen order controleert;
- amount, currency, mode en provider valideert;
- duplicate deliveries idempotent verwerkt;
- betaalde orders niet laat regresseren;
- Neon kan reconciliëren wanneer de browserreturn wegvalt;
- geen secrets of onnodige gevoelige payloads logt.

### Netlify Function-adapters

`netlify/functions/` bevat voor de doelarchitectuur onder andere dunne adapters voor:

- `create-paypal-order.mjs`;
- `capture-paypal-order.mjs`;
- `order-status.mjs`.

`netlify.toml` publiceert de PayPal/runtime routes:

```text
/api/paypal/checkout
/api/paypal/capture
/api/order-status
```

De Netlify-build draait op Node.js 22. Ontbrekende of ongeldige configuratie faalt gesloten.

### Verified order return

De returnpagina vertrouwt de URL nooit als betalingsbewijs.

De browser:

1. gebruikt de eerder opgeslagen orderreference en PayPal order ID;
2. laat de server capture/verify uitvoeren waar vereist;
3. vraagt orderstatus via het serverendpoint op;
4. verwacht een exacte match op orderreference en payment session/order ID;
5. leegt alleen bij serverbevestigde `paid`-status de checkoutgerelateerde browserdata;
6. behoudt de cart bij pending, failed, expired of onbereikbare status.

### Cart image recovery

Winkelwagenitems worden lokaal opgeslagen en kunnen daardoor een ouder afbeeldingspad bevatten dan de huidige Vite-build. Wanneer zo’n lokale afbeelding faalt, gebruikt de cart-runtime de stabiele productpagina-identiteit om het actuele browserbeeld uit `data/product-registry.json` op te halen. Alleen goedgekeurde lokale Netlify/Vite-paden worden geaccepteerd en de herstelde URL wordt teruggeschreven naar `localStorage`.

### Media delivery

De medialaag gebruikt:

- actieve-reference audits;
- duplicate- en orphan-detectie;
- metadata-inspectie via FFprobe;
- WebP-derivatives met kwaliteits- en grootteguardrails;
- geoptimaliseerde H.264-video’s met SSIM/PSNR-grenzen;
- posters en `preload="none"`;
- viewport-, visibility-, Reduced Motion- en Save-Data-beleid.

Originele transparante product- en printbronnen blijven behouden.

## 3. Tijdelijke legacy Stripe-laag

De repository bevat nog Stripecode uit de eerdere architectuur. Onder andere bestaan nog legacy servermodules, Netlify fallbackroutes, tests en validators.

Deze code is **geen onderdeel van de gewenste eindarchitectuur**.

Zij blijft tijdelijk staan totdat:

1. PayPal webhook/reconciliation is geïmplementeerd;
2. PayPal Sandbox + Neon staging end-to-end groen is;
3. capture, return, duplicate events en foutpaden aantoonbaar stabiel zijn.

Daarna wordt Stripe in een aparte PR verwijderd. Provider-neutrale commerce-, order-, database- en securitycomponenten moeten daarbij behouden blijven.

## 4. Build- en quality-architectuur

Vite bouwt iedere root-HTML-pagina als afzonderlijke multi-page entry. De standaard build:

1. genereert de runtime-productregistratie;
2. bouwt alle HTML-pagina’s en assets;
3. kopieert benodigde browserruntimebestanden en geverifieerde runtime-assets;
4. finaliseert runtimedata met actuele gebouwde asset-URL’s;
5. valideert de uiteindelijke productie-output.

De quality gate draait op Node.js 20 en controleert onder andere:

- repository- en linkintegriteit;
- SEO en metadata;
- CSS en dependencies;
- media- en videodelivery;
- catalogus en productpagina’s;
- browsercommerce;
- cart-controls en image fallback;
- orderquote en paymentcontracten;
- databasecontracten en Neon-harness;
- unit tests;
- productiebuild.

Enkele checks heten nog `validate:stripe-*` zolang de legacy Stripe-code bewust aanwezig blijft. Die namen/code worden pas in de latere Stripe-removal PR opgeschoond.

Een aparte workflow controleert de Netlify-build op Node.js 22.

## 5. Veiligheidsgrenzen

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
- tijdelijke schrijfworkflows moeten vóór merge worden verwijderd of permanent veilig worden gemaakt;
- GitHub Pages wordt niet gebruikt als alternatieve production host.

### Database

- test en productie blijven gescheiden;
- runtime gebruikt een gepoolde TLS-verbinding;
- productie gebruikt een dedicated least-privilege runtime-rol;
- integratietests gebruiken alleen synthetische data;
- productiegegevens mogen nooit in de integratieomgeving worden geplaatst.

### Deployment

- Netlify is de enige beoogde production host;
- test- en productievariabelen worden gescheiden;
- PayPal Live vereist een aparte expliciete goedkeuring;
- definitief domein/canonical/SEO wordt als aparte launchfase behandeld.

## 6. Deploymentarchitectuur

De huidige stagingdoelarchitectuur is:

```text
Browser storefront
    ├── POST /api/paypal/checkout ─┐
    ├── POST /api/paypal/capture ──┼── Netlify Functions
    └── POST /api/order-status ────┘        │
                                            ├── PayPal Orders API
                                            └── Neon Postgres
```

Voor productie wordt toegevoegd:

```text
PayPal webhook
    ↓
Netlify webhook Function
    ↓
verification + idempotent reconciliation
    ↓
Neon Postgres
```

Staging gebruikt uitsluitend PayPal Sandbox en een geïsoleerde Neon-omgeving. Productie krijgt aparte Neon-, PayPal- en Netlifyconfiguraties.

## 7. Openstaande architectuurbeslissingen/werk

- PayPal webhook/reconciliation ontwerp en implementatie;
- dedicated productie-Neonbranch/omgeving;
- productie runtime-rol en privileges;
- backup-/restorestrategie;
- privacyretentie voor klant- en ordergegevens;
- definitief publiek domein en canonical/sitemapbeleid;
- monitoring, logging en alerting;
- operationele orderadministratie en supportflow;
- refunds, disputes en handmatige ordercorrecties;
- gecontroleerde Stripe-removal na bewezen PayPal staging.

## 8. Niet automatisch geactiveerd door repositorycode

De repository activeert niet zelfstandig:

- productie-Neoncredentials;
- Netlify production environment variables;
- PayPal secrets;
- PayPal Live;
- productiegegevens;
- een definitief publiek domein;
- klantaccounts of een adminportal.

Die onderdelen worden alleen geactiveerd via afzonderlijk goedgekeurde releasefases.
