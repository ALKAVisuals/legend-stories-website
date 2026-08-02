# LegendMural storefront

Premium, mobile-first e-commerce storefront voor LegendMural. De website verkoopt muurkunst rond sport-, muziek-, combat- en wisdom-legendes en is gebouwd met statische HTML, Tailwind CSS, Vanilla JavaScript en Vite.

De repository bevat inmiddels meer dan alleen een frontend: productdata, productpaginageneratie, orderberekening, Stripe Checkout-contracten, webhookvalidatie, een Neon Postgres-adapter en uitgebreide kwaliteitscontroles zijn centraal vastgelegd. Hosted checkout, Netlify Functions en live betalingen blijven bewust uitgeschakeld totdat de staging- en productie-infrastructuur afzonderlijk is goedgekeurd.

## Belangrijkste kenmerken

- 111 producten verdeeld over 6 catalogusbatches;
- alle productpagina’s worden vanuit één gedeelde template gegenereerd;
- centrale catalogus, prijs-, kortings- en verzendregels;
- server-side autoritatieve orderberekening in eurocenten;
- voorbereid Stripe Checkout-, webhook- en orderstatuscontract;
- voorbereid Neon Postgres order-store met migraties en conformance-tests;
- geoptimaliseerde video- en homepageafbeeldingen met objectieve kwaliteitsgrenzen;
- permanente repository-, SEO-, media-, commerce-, database- en buildvalidatie;
- GitHub Actions werkt in de normale situatie met `contents: read`.

## Huidige status

| Onderdeel | Status |
|---|---|
| Productcatalogus en productpagina’s | Productieklaar binnen de repository |
| Winkelwagen, korting en verzending | Centraal gevalideerd |
| Stripe Checkout-code | Voorbereid en getest, endpoint uitgeschakeld |
| Stripe webhook en orderstatus | Voorbereid en getest, niet gedeployed |
| Neon Postgres-adapter | Voorbereid; echte integratietest wacht op issue #31 |
| Netlify Functions | Nog niet geïmplementeerd |
| Stripe live betalingen | Uitgeschakeld |
| Definitieve productie-release | Nog niet vrijgegeven |

Zie [`docs/PROJECT_STATUS.md`](docs/PROJECT_STATUS.md) voor de actuele roadmap en blokkades.

## Technische stack

- **HTML5** voor de statische multi-page storefront;
- **Tailwind CSS 3.4** en PostCSS;
- **Vanilla JavaScript** voor cart, navigatie, productinteracties en browser Checkout;
- **Vite 6** voor de multi-page productiebuild;
- **Node.js 20** voor generators, validators, tests en CI;
- **Neon Postgres** als gekozen toekomstige orderdatabase;
- **Stripe Checkout** als gekozen toekomstige hosted betaalflow;
- **Netlify** als beoogde hosting- en serverlessomgeving.

## Snel starten

Vereisten:

- Node.js 20;
- npm;
- FFmpeg en FFprobe voor de volledige media-quality gate.

```bash
git clone https://github.com/ALKAVisuals/legend-stories-website.git
cd legend-stories-website
npm ci
npm run dev
```

De ontwikkelserver draait standaard op:

```text
http://localhost:3001
```

`npm run dev` genereert eerst de runtime-productregistratie en start daarna Vite.

## Belangrijkste commando’s

```bash
npm run dev          # Runtime-productdata genereren en lokale server starten
npm run build        # Productieregistratie, Vite-build en outputvalidatie
npm test             # Alle Node.js-unit tests
npm run quality      # Volledige lokale kwaliteitsketen
```

Veelgebruikte gerichte controles:

```bash
npm run validate:full-catalog
npm run validate:managed-product-pages:live
npm run validate:commerce-runtime
npm run validate:order-security
npm run validate:stripe-checkout
npm run validate:stripe-webhook
npm run validate:neon-order-store
npm run validate:homepage-marketing-webp
npm run validate:video-delivery
```

## Projectstructuur

```text
.
├── data/
│   ├── products/                  # Centrale catalogus en batchpresentatie
│   └── media/                     # Reproduceerbare media-optimalisatiemanifests
├── docs/                          # Architectuur, status en activatie-instructies
├── generated/
│   └── public/                    # Gegenereerde runtime-assets voor Vite
├── js/                            # Browserruntime en commerce-modules
├── media/                         # Storefrontmedia en geverifieerde derivatives
├── server/
│   ├── commerce/                  # Autoritatieve order- en prijslogica
│   ├── db/                        # Order-store contracten, Neon-adapter en migraties
│   └── payments/                  # Stripe Checkout, webhook en orderstatus
├── scripts/                       # Generators, audits en validators
├── templates/
│   └── product-page.html          # Gedeelde productpaginatemplate
├── tests/                         # Unit- en contracttests
├── *.html                         # Homepage, collecties, checkout en gegenereerde producten
├── package.json
└── vite.config.mjs
```

## Productdata en productpagina’s

De centrale productcatalogus is de autoriteit voor onder andere:

- product-ID en slug;
- naam en beschrijving;
- prijs en beschikbaarheid;
- collectie en batch;
- productafbeelding;
- canonical URL en productmetadata.

Alle 111 live productpagina’s moeten byte-identiek reproduceerbaar zijn vanuit de gedeelde template en hun presentatiemanifests. Handmatige wijzigingen in gegenereerde product-HTML worden door de quality gate afgekeurd.

Normale workflow voor productpaginawijzigingen:

1. pas centrale catalogus- of presentatiegegevens aan;
2. genereer previews;
3. valideer de volledige catalogus en templatecompatibiliteit;
4. genereer de beheerde live pagina’s;
5. voer `npm run quality` uit.

## Commerce- en betalingsgrenzen

De browser is nooit de autoriteit voor productnamen, prijzen, korting, verzending of totaalbedragen. De server-side orderquote:

- zoekt producten opnieuw op in de centrale catalogus;
- negeert browserprijzen en browsertotalen;
- valideert aantallen en productidentiteit;
- past centrale korting en verzending toe;
- rekent in gehele eurocenten;
- levert de enige geldige basis voor een Stripe Checkout Session.

De Stripe- en orderstatuscode is platformneutraal voorbereid, maar de browser-endpointconfiguratie blijft leeg. Zonder een goedgekeurde serverless adapter, veilige secrets en een echte database kan de storefront geen hosted betaling starten.

## Neon-integratie

De repository bevat:

- een Neon Postgres order-store adapter;
- een idempotente databaseschemamigratie;
- een aparte migratie- en least-privilege runtimerol;
- provider-neutrale conformance-tests;
- een handmatige GitHub Actions-integratieworkflow;
- synthetische fixture-cleanup voor en na de echte test.

De echte integratietest blijft geblokkeerd totdat issue #31 is uitgevoerd en de volgende secrets veilig in de `neon-integration` GitHub environment staan:

- `NEON_TEST_DATABASE_URL`;
- `NEON_TEST_MIGRATION_URL`.

Zie [`docs/NEON_INTEGRATION_ACTIVATION.md`](docs/NEON_INTEGRATION_ACTIVATION.md).

## Media en performance

De repository bewaakt actieve mediaverwijzingen, grote rasterbestanden en videolevering. Belangrijke uitgevoerde optimalisaties:

- ongebruikte media zijn verwijderd en worden voortaan geblokkeerd;
- collectie-video’s zijn met geverifieerde SSIM- en PSNR-grenzen geoptimaliseerd;
- video’s respecteren viewport, tabbladzichtbaarheid, Reduced Motion en Save-Data;
- homepage-marketingafbeeldingen gebruiken WebP-first `image-set()` met PNG-fallback;
- originele transparante product- en printbronnen blijven onaangetast.

## Kwaliteitsketen

`npm run quality` controleert onder andere:

- interne links, metadata en duplicate titles;
- dependency- en CSS-audits;
- mediareferenties, rastermetadata en videodelivery;
- alle 111 producten en gegenereerde productpagina’s;
- runtime-productdata en related products;
- cart, korting, shipping en orderquotes;
- Stripe Checkout, webhook en verified return flow;
- order-store contracten en Neon-architectuur;
- unit tests;
- Vite-build en uiteindelijke productie-output.

Een groene PR-check is vereist voordat een wijziging voor merge wordt voorgesteld.

## Deployment en releasebeleid

Netlify is de beoogde hostingomgeving, maar deze repository activeert nog geen productie-Functions, secrets of live betaalendpoints. Deploymentwijzigingen worden apart beoordeeld.

De geplande releasevolgorde is:

1. geïsoleerde Neon-testomgeving aanmaken;
2. echte Neon-conformance-test uitvoeren;
3. Netlify staging Functions voor checkout, webhook en status toevoegen;
4. Stripe-testbetaling end-to-end valideren;
5. pas daarna productie-infrastructuur en live betalingen afzonderlijk goedkeuren.

Zie [`docs/DEVELOPMENT_AND_RELEASE.md`](docs/DEVELOPMENT_AND_RELEASE.md) voor de operationele checklist.

## Documentatie

- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — componenten, datastromen en veiligheidsgrenzen;
- [`docs/PROJECT_STATUS.md`](docs/PROJECT_STATUS.md) — afgerond werk, blokkades en roadmap;
- [`docs/DEVELOPMENT_AND_RELEASE.md`](docs/DEVELOPMENT_AND_RELEASE.md) — ontwikkel-, review-, staging- en releaseproces;
- [`docs/NEON_INTEGRATION_ACTIVATION.md`](docs/NEON_INTEGRATION_ACTIVATION.md) — activeren van de echte Neon-test.

## Veiligheidsregels

- Commit nooit secrets, database-URL’s of Stripe-keys.
- Plak credentials niet in issues, PR’s of chatberichten.
- Verander gegenereerde productpagina’s niet handmatig.
- Activeer live Stripe-modus niet via browsercode.
- Wijzig Netlify of productie-infrastructuur alleen in een afzonderlijk goedgekeurde sprint.
- Behoud originele product- en printmedia; gebruik geverifieerde browserderivatives.

## Licentie

© 2026 LegendMural / ALKAVisuals. Alle rechten voorbehouden.
