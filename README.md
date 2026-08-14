# LegendMural storefront

Premium, mobile-first e-commerce storefront voor LegendMural. De website verkoopt matte vinyl muurstickers rond sport-, muziek-, combat- en wisdom-legendes en is gebouwd met statische HTML, Tailwind CSS, Vanilla JavaScript en Vite.

De repository bevat naast de storefront ook centrale productdata, productpaginageneratie, autoritatieve server-side commerce, een Neon Postgres order-store en Netlify Functions voor de betaal- en orderflow.

## Huidige architectuurbeslissingen

- **Production host:** Netlify.
- **Payment provider voor launch:** PayPal-only.
- **Orderdatabase:** Neon Postgres.
- **Productcatalogus:** 111 producten verdeeld over 6 batches.
- **Live betalingen:** nog niet geactiveerd.
- **Stripe:** nog tijdelijk aanwezig als legacy/fallbackcode totdat de volledige PayPal Sandbox + Neon end-to-end flow bewezen is; Stripe is geen doelprovider voor launch.
- **GitHub Pages:** uitgeschakeld en geen production target.

## Belangrijkste kenmerken

- alle 111 productpagina’s worden vanuit één gedeelde template en centrale data gegenereerd;
- centrale prijs-, kortings- en verzendregels;
- server-side autoritatieve orderberekening in gehele eurocenten;
- PayPal create-order en capture flow met sandbox-first/live guardrails;
- duurzame pending-order- en paid-statusopslag in Neon Postgres;
- Netlify Functions voor PayPal checkout, PayPal capture en orderstatus;
- Stripecode blijft uitsluitend tijdelijk aanwezig voor gecontroleerde migratie/rollback totdat PayPal staging volledig bewezen is;
- geoptimaliseerde video- en productafbeeldingen met objectieve kwaliteitsgrenzen;
- permanente repository-, media-, commerce-, database-, accessibility- en buildvalidatie;
- Netlify is de enige beoogde production host.

## Huidige status

| Onderdeel | Status |
|---|---|
| Productcatalogus en 111 productpagina’s | Gereed en generator-managed |
| Winkelwagen, korting en verzending | Centraal gevalideerd |
| Autoritatieve server-side orderquote | Gereed |
| Neon Postgres | Echte geïsoleerde integratie en conformance uitgevoerd |
| PayPal create order | Geïmplementeerd, sandbox-first |
| PayPal capture | Geïmplementeerd met Neon paid-persistence |
| PayPal webhook | Nog te implementeren vóór productie |
| Netlify Functions | Geïmplementeerd; stagingsecrets nog te configureren |
| PayPal Sandbox E2E | Nog uit te voeren |
| Stripe | Legacy/fallback; later gecontroleerd verwijderen |
| GitHub Pages | Geen production target |
| PayPal Live | Uitgeschakeld |
| Definitieve productie-release | Nog niet vrijgegeven |

Zie [`docs/PROJECT_STATUS.md`](docs/PROJECT_STATUS.md) voor de actuele roadmap en blokkades.

## Technische stack

- **HTML5** voor de statische multi-page storefront;
- **Tailwind CSS 3.4** en PostCSS;
- **Vanilla JavaScript** voor cart, navigatie, productinteracties en browser checkout;
- **Vite 6** voor de multi-page productiebuild;
- **Node.js 20** voor de hoofd-quality gate en lokale repositorychecks;
- **Node.js 22** voor Netlify-builds en Netlify-compatibiliteitscontrole;
- **Neon Postgres** voor duurzame orderopslag;
- **PayPal Orders API** als enige beoogde payment provider voor launch;
- **Netlify** voor hosting en serverless Functions.

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
npm run dev
npm run build
npm test
npm run quality
```

Veelgebruikte gerichte controles:

```bash
npm run validate:full-catalog
npm run validate:managed-product-pages:live
npm run validate:commerce-runtime
npm run validate:order-security
npm run validate:browser-checkout
npm run validate:order-return
npm run validate:neon-order-store
npm run validate:homepage-marketing-webp
npm run validate:video-delivery
```

De quality chain bevat nog enkele Stripe-specifieke validators omdat de legacy Stripe-implementatie bewust nog niet is verwijderd. Die validators blijven tijdelijk actief totdat PayPal Sandbox + Neon volledig end-to-end bewezen is en Stripe in een aparte gecontroleerde cleanup-PR wordt verwijderd.

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
│   └── functions/                 # PayPal-, orderstatus- en tijdelijke legacy Stripe-adapters
├── server/
│   ├── commerce/                  # Autoritatieve order- en prijslogica
│   ├── adapters/                  # Neon order-store adapters
│   ├── orders/                    # Durable order- en providercontracten
│   └── payments/                  # PayPal en tijdelijke legacy Stripe payment code
├── scripts/                       # Generators, audits en validators
├── templates/
│   └── product-page.html          # Gedeelde productpaginatemplate
├── tests/                         # Unit- en contracttests
├── *.html                         # Homepage, collecties, returnpagina’s en producten
├── netlify.toml
├── package.json
└── vite.config.mjs
```

## Productdata en productpagina’s

`data/products/catalog.json` is de inhoudelijke autoriteit voor onder andere:

- product-ID en slug;
- naam en beschrijving;
- prijs en beschikbaarheid;
- collectie en batch;
- productafbeelding;
- pagina-identiteit en productmetadata.

Alle 111 live productpagina’s moeten reproduceerbaar zijn vanuit de gedeelde template en hun presentatiemanifests. Handmatige wijzigingen in gegenereerde product-HTML worden door de quality gate afgekeurd.

Normale workflow:

1. pas centrale catalogus- of presentatiegegevens aan;
2. genereer previews;
3. valideer catalogus en templatecompatibiliteit;
4. genereer de beheerde live pagina’s;
5. voer `npm run quality` uit.

## Commerce- en betalingsgrenzen

De browser is nooit de autoriteit voor productnamen, prijzen, korting, verzending, totaalbedragen of betaalstatus.

De server-side orderquote:

- zoekt producten opnieuw op in de centrale catalogus;
- negeert browserprijzen en browsertotalen;
- valideert aantallen en productidentiteit;
- past centrale korting en verzending toe;
- rekent in gehele eurocenten;
- levert de enige geldige basis voor PayPal en orderopslag.

De beoogde launchflow is:

```text
Browser
  ↓
Netlify Function
  ↓
autoritatieve quote
  ↓
Neon pending order
  ↓
PayPal order + approval
  ↓
server capture
  ↓
Neon paid
  ↓
order status / return
```

Voor productie wordt hier nog een **PayPal webhook + reconciliationlaag** aan toegevoegd. De browserreturn mag nooit de enige onafhankelijke bevestiging van betaling zijn.

## PayPal

De huidige repository bevat:

- sandbox-first PayPal API-client;
- create-order handler;
- capture handler;
- PayPal browser checkout/return ondersteuning;
- trusted PayPal hostvalidatie;
- idempotency keys;
- Neon capture persistence;
- orderstatuscontrole.

PayPal Live is fail-closed: live API-toegang vereist expliciete server-side enablement en aparte productiecredentials.

Zie [`docs/PAYPAL_STAGING.md`](docs/PAYPAL_STAGING.md) voor de veilige stagingvolgorde.

## Neon-integratie

De echte geïsoleerde Neon-integratie is uitgevoerd: migraties, order-store conformance en concurrent gedrag zijn gevalideerd. PR #74 heeft daarbij gevonden JSONB-serialisatie- en serializable-retryproblemen opgelost.

Voor productie blijven vereist:

- aparte productieomgeving/branch;
- dedicated least-privilege runtime-rol;
- backup-/restorebeleid;
- privacy- en retentiebeleid.

## Media en performance

Belangrijke uitgevoerde optimalisaties:

- ongebruikte media verwijderd en via audits bewaakt;
- collectie-video’s geoptimaliseerd met SSIM/PSNR-guardrails;
- posters en adaptief videoladen toegevoegd;
- homepage-marketingafbeeldingen gebruiken WebP-first delivery;
- zware transparante productafbeeldingen hebben browserderivatives;
- originele product- en printbronnen blijven behouden.

## Kwaliteitsketen

`npm run quality` controleert onder andere:

- repository- en linkintegriteit;
- metadata en SEO-contracten;
- dependencies en CSS;
- media- en videodelivery;
- alle 111 producten en gegenereerde productpagina’s;
- runtime-productdata;
- cart, korting, shipping en orderquotes;
- browser checkout en verified return;
- legacy Stripe-contracten zolang die code nog aanwezig is;
- order-store contracten en Neon-architectuur;
- unit tests;
- Vite-build en productie-output.

Daarnaast bestaan aparte accessibility/purchase-flow- en Node 22 Netlify-compatibiliteitsworkflows.

## Releasevolgorde

De huidige releasevolgorde is:

1. repository/documentatie op PayPal-only architectuur brengen;
2. PayPal webhook + idempotente reconciliation implementeren;
3. geïsoleerde Neon staging en PayPal Sandbox rechtstreeks in Netlify configureren;
4. volledige PayPal testbetaling end-to-end valideren;
5. retries, refreshes, cancel/failure en duplicate events testen;
6. daarna legacy Stripe gecontroleerd verwijderen;
7. branding, SEO, legal/help-content en final-domain cleanup uitvoeren;
8. productie-Neon en PayPal Live afzonderlijk goedkeuren;
9. één gecontroleerde echte bestelling uitvoeren;
10. pas daarna officieel releasen.

## Documentatie

- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — componenten, datastromen en veiligheidsgrenzen;
- [`docs/PROJECT_STATUS.md`](docs/PROJECT_STATUS.md) — actuele status, blokkades en roadmap;
- [`docs/DEVELOPMENT_AND_RELEASE.md`](docs/DEVELOPMENT_AND_RELEASE.md) — ontwikkel-, review-, staging- en releaseproces;
- [`docs/PAYPAL_STAGING.md`](docs/PAYPAL_STAGING.md) — PayPal Sandbox + Neon stagingplan;
- [`docs/NEON_INTEGRATION_ACTIVATION.md`](docs/NEON_INTEGRATION_ACTIVATION.md) — Neon-integratieharness en testveiligheid.

Historische Sprint- en Stripe-documenten mogen als ontwikkelgeschiedenis blijven bestaan, maar zijn niet de bron van waarheid voor de huidige launcharchitectuur. Gebruik bij twijfel `README.md`, `docs/ARCHITECTURE.md` en `docs/PROJECT_STATUS.md`.

## Veiligheidsregels

- Commit nooit secrets, database-URL’s, PayPal secrets of webhook secrets.
- Plak credentials niet in issues, PR’s of chatberichten.
- Verander gegenereerde productpagina’s niet handmatig.
- Activeer PayPal Live niet vanuit browsercode of zonder aparte productiegoedkeuring.
- Verwijder Neon niet: PayPal is payment provider, Neon is de LegendMural orderdatabase.
- Gebruik GitHub Pages niet als parallel production target.
- Behoud originele product- en printmedia; gebruik geverifieerde browserderivatives.

## Licentie

© 2026 LegendMural / ALKAVisuals. Alle rechten voorbehouden.
