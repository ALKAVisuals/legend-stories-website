# LegendMural storefront

Premium, mobile-first e-commerce storefront voor LegendMural. De website verkoopt muurkunst rond sport-, muziek-, combat- en wisdom-legendes en is gebouwd met statische HTML, Tailwind CSS, Vanilla JavaScript en Vite.

De repository bevat naast de storefront ook centrale productdata, productpaginageneratie, autoritatieve orderberekening, Stripe Checkout- en webhookgrenzen, een Neon Postgres order-store en Netlify Functions voor checkout, webhook en orderstatus. Live Stripe-betalingen en een definitieve productie-release blijven uitgeschakeld totdat de productie-infrastructuur afzonderlijk is goedgekeurd.

## Belangrijkste kenmerken

- 111 producten verdeeld over 6 catalogusbatches;
- alle productpagina’s worden vanuit één gedeelde template gegenereerd;
- centrale catalogus, prijs-, kortings- en verzendregels;
- server-side autoritatieve orderberekening in eurocenten;
- Stripe Checkout-, webhook- en orderstatuscontracten met test-mode guardrails;
- Neon Postgres order-store met migraties, conformance-tests en een uitgevoerde echte integratietest;
- Netlify Functions voor checkout, webhook en orderstatus;
- geoptimaliseerde video- en homepageafbeeldingen met objectieve kwaliteitsgrenzen;
- permanente repository-, SEO-, media-, commerce-, database- en buildvalidatie;
- GitHub Actions werkt in de normale situatie met `contents: read`;
- Netlify is de enige beoogde production host; GitHub Pages is geen production target.

## Huidige status

| Onderdeel | Status |
|---|---|
| Productcatalogus en productpagina’s | Productieklaar binnen de repository |
| Winkelwagen, korting en verzending | Centraal gevalideerd |
| Stripe Checkout-code | Geïmplementeerd voor test/staging via Netlify Function |
| Stripe webhook en orderstatus | Geïmplementeerd via Netlify Functions |
| Neon Postgres-adapter | Echte geïsoleerde integratie en conformance uitgevoerd |
| Netlify Functions | Geïmplementeerd; productieactivatie nog niet vrijgegeven |
| GitHub Pages | Geen production target |
| Stripe live betalingen | Uitgeschakeld |
| Definitieve productie-release | Nog niet vrijgegeven |

Zie [`docs/PROJECT_STATUS.md`](docs/PROJECT_STATUS.md) voor de actuele roadmap en blokkades.

## Technische stack

- **HTML5** voor de statische multi-page storefront;
- **Tailwind CSS 3.4** en PostCSS;
- **Vanilla JavaScript** voor cart, navigatie, productinteracties en browser Checkout;
- **Vite 6** voor de multi-page productiebuild;
- **Node.js 20** voor de hoofd-quality gate en lokale repositorychecks;
- **Node.js 22** voor de Netlify-build en Netlify-compatibiliteitscontrole;
- **Neon Postgres** voor duurzame orderopslag;
- **Stripe Checkout** voor de hosted betaalflow;
- **Netlify** als beoogde hosting- en serverlessomgeving.

## Snel starten

Vereisten:

- Node.js 20 voor de standaard lokale kwaliteitsketen;
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
├── netlify/
│   └── functions/                 # Checkout-, webhook- en orderstatusadapters
├── server/
│   ├── commerce/                  # Autoritatieve order- en prijslogica
│   ├── db/                        # Order-store contracten, Neon-adapter en migraties
│   └── payments/                  # Stripe Checkout, webhook en orderstatus
├── scripts/                       # Generators, audits en validators
├── templates/
│   └── product-page.html          # Gedeelde productpaginatemplate
├── tests/                         # Unit- en contracttests
├── *.html                         # Homepage, collecties, checkout en gegenereerde producten
├── netlify.toml
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

Netlify publiceert same-origin routes voor checkout en orderstatus en bevat een Stripe-webhookroute. Zonder de vereiste staging- of productie-environmentvariabelen falen deze servergrenzen veilig. Live Stripe-modus blijft server-side geblokkeerd totdat die afzonderlijk wordt goedgekeurd.

## Neon-integratie

De repository bevat:

- een Neon Postgres order-store adapter;
- een idempotente databaseschemamigratie;
- provider-neutrale conformance-tests;
- een handmatige GitHub Actions-integratieworkflow;
- synthetische fixture-cleanup voor en na de echte test;
- bounded retries voor retryable serializable transacties;
- expliciete JSONB-serialisatie voor orderdata.

De echte geïsoleerde Neon-integratie is uitgevoerd: migraties, order-store conformance en concurrent gedrag zijn gevalideerd. Voor productie blijft een afzonderlijke least-privilege runtime-rol, backup-/restorebeleid en privacybeoordeling vereist.

Zie [`docs/NEON_INTEGRATION_ACTIVATION.md`](docs/NEON_INTEGRATION_ACTIVATION.md) voor de testharness en veiligheidsgrenzen.

## Media en performance

De repository bewaakt actieve mediaverwijzingen, grote rasterbestanden en videolevering. Belangrijke uitgevoerde optimalisaties:

- ongebruikte media zijn verwijderd en worden voortaan geblokkeerd;
- collectie-video’s zijn met geverifieerde SSIM- en PSNR-grenzen geoptimaliseerd;
- video-audio is verwijderd waar alle usages muted zijn;
- posters zijn toegevoegd;
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

Daarnaast bestaat een aparte Node 22 Netlify-compatibiliteitsworkflow. Een groene PR-check is vereist voordat een wijziging voor merge wordt voorgesteld.

## Deployment en releasebeleid

Netlify is de enige beoogde production host. GitHub wordt gebruikt voor broncode, branches, PR’s, CI en reviews, niet als tweede production website-host.

De huidige releasevolgorde is:

1. repository- en Netlify-compatibiliteit groen houden;
2. Netlify staging met uitsluitend Stripe-testkeys en een geïsoleerde Neon-omgeving configureren;
3. volledige testbetaling end-to-end valideren;
4. webhookgestuurde `paid`-status en paid-only cart cleanup bevestigen;
5. retries, refreshes, cancel/failure en duplicate events testen;
6. pas daarna productie-infrastructuur en live betalingen afzonderlijk goedkeuren.

Zie [`docs/DEVELOPMENT_AND_RELEASE.md`](docs/DEVELOPMENT_AND_RELEASE.md) voor de operationele checklist.

## Documentatie

- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — componenten, datastromen en veiligheidsgrenzen;
- [`docs/PROJECT_STATUS.md`](docs/PROJECT_STATUS.md) — afgerond werk, blokkades en roadmap;
- [`docs/DEVELOPMENT_AND_RELEASE.md`](docs/DEVELOPMENT_AND_RELEASE.md) — ontwikkel-, review-, staging- en releaseproces;
- [`docs/NEON_INTEGRATION_ACTIVATION.md`](docs/NEON_INTEGRATION_ACTIVATION.md) — Neon-integratieharness en testveiligheid.

## Veiligheidsregels

- Commit nooit secrets, database-URL’s of Stripe-keys.
- Plak credentials niet in issues, PR’s of chatberichten.
- Verander gegenereerde productpagina’s niet handmatig.
- Activeer live Stripe-modus niet via browsercode.
- Wijzig Netlify of productie-infrastructuur alleen in een afzonderlijk goedgekeurde sprint.
- Gebruik GitHub Pages niet als parallel production target.
- Behoud originele product- en printmedia; gebruik geverifieerde browserderivatives.

## Licentie

© 2026 LegendMural / ALKAVisuals. Alle rechten voorbehouden.
