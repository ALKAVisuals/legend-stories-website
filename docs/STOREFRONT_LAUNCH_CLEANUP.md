# Storefront launch cleanup

Status: in uitvoering op `agent/storefront-launch-cleanup`.

Deze cleanup is bewust beperkt tot zichtbare launchrestanten en feitelijke storefrontcopy. Production Netlify, production Neon, PayPal Live, juridische beleidsinhoud en artwork-IP review vallen buiten deze branch.

## Centrale commerce source-of-truth

- Compact: 50 × 30 cm — €35 incl. btw.
- Statement: 50 × 50 cm — €45 incl. btw.
- Publieke kortingscode: `LEGEND10` — 10%.
- Nederland: €4,95 verzending.
- EU: €9,95 verzending.
- Verenigde Staten: €9,95 tracked verzending.
- Gratis verzending vanaf €69 in ondersteunde markten.
- Overige bestemmingen: checkout niet beschikbaar.

Runtimebronnen:

- `js/commerce/product-variants.mjs`
- `js/commerce/shipping.mjs`

Losse HTML-copy mag deze configuratie niet tegenspreken.

## Bevestigde launchrestanten

### Homepage

Bevestigd in `index.html`:

- `Legend Stories` staat nog in title/meta/Open Graph/accessibilitycopy;
- canonical en `og:url` wijzen nog naar de oude GitHub Pages-host;
- onbewezen social proof staat zichtbaar als `1K+ Sold`, `4.9★ On Trustpilot` en `Best seller`;
- zichtbare productprijs `€49,95` komt voor naast cartdata die naar de centrale Statement-variant van €45 resolveert;
- cartcopy noemt `Free shipping on orders over €50`, terwijl de runtimegrens €69 is;
- value-propcopy noemt alleen Europese verzending terwijl de Verenigde Staten ook een actieve markt zijn;
- WhatsApp-link gebruikt placeholdernummer `+31 6 12345678`.

## Correctieregels

1. **Branding** — klantgerichte merknaam wordt `LegendMural`. Historische documentatie hoeft niet zonder reden herschreven te worden.
2. **Prijzen** — zichtbare variantprijzen moeten overeenkomen met `product-variants.mjs`; browserdata is nooit autoritatief voor serverberekeningen.
3. **Shipping** — zichtbare bedragen, markten en free-shippinggrens moeten overeenkomen met `shipping.mjs`.
4. **Trustclaims** — claims zonder controleerbaar bewijs verwijderen; niet vervangen door nieuwe onbewezen claims.
5. **Contact** — placeholder telefoon-/WhatsAppdata niet publiceren. Alleen geverifieerde bedrijfsgegevens gebruiken.
6. **SEO/domain** — GitHub Pages-URLs verwijderen zodra het definitieve publieke domein is bevestigd. Geen tijdelijk domein verzinnen.
7. **Legal** — alleen routes/labels controleren in deze cleanup; inhoudelijke privacy/returns/refunds/voorwaarden volgt in een aparte fase met actuele officiële bronnen.

## Veilige uitvoeringsvolgorde

1. generator/templates en gedeelde bronnen identificeren voordat individuele productpagina's worden aangepast;
2. homepage en gedeelde storefrontcopy corrigeren;
3. generator opnieuw gebruiken voor generator-managed pagina's in plaats van handmatig 111 productpagina's uiteen te laten lopen;
4. repository-wide controles uitvoeren op oude branding, GitHub Pages-URLs, `€49,95`, free-shippingcopy en placeholdercontactdata;
5. Quality, Accessibility/purchase-flow, Netlify compatibility en productiebuild groen bevestigen;
6. pas daarna merge overwegen na expliciete goedkeuring.

## Buiten scope

- production database of migrations;
- production environment variables;
- PayPal Live credentials/webhook/enablement;
- definitieve juridische teksten;
- refunds/reversal state-machine;
- artwork IP-/portret-/trademarkbeoordeling;
- frameworkrewrite of grote UI-redesigns.
