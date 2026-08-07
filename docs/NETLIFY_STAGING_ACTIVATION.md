# Netlify staging activation

## Doel

Deze checklist activeert uitsluitend een **dedicated LegendMural stagingomgeving** voor één gecontroleerde end-to-end betaaltest. De productie-Netlifycontext, live Stripe-modus en echte klantdata blijven buiten scope.

Op 7 augustus 2026 zijn twee bestaande Netlify-deployments side-effect-free geprobed:

- de eerdere Deploy Preview van PR #81;
- `https://legendmural.netlify.app`.

Beide storefronts antwoordden normaal met HTTP 200, maar `/api/checkout` antwoordde met HTTP 503 `CHECKOUT_SERVICE_NOT_CONFIGURED`. De repositorycode is dus gedeployed, maar de externe commerce-runtime is nog niet met een bruikbare `NEON_DATABASE_URL` verbonden.

Gebruik `legendmural.netlify.app` niet als test-secretcontainer zolang die deployment de productiecontext vertegenwoordigt. Richt staging in op een afzonderlijke Netlify Deploy Preview/branchcontext.

## Vereiste stagingvariabelen

Voer waarden rechtstreeks in Netlify in. Plaats secrets nooit in GitHub, PR-comments, logs of chat.

### Secrets

- `NEON_DATABASE_URL`
  - gepoolde TLS runtime-URL van de **geïsoleerde staging-Neonbranch**;
  - gebruik de staging runtime-rol, niet de migratiecredential;
  - gebruik geen productiebranch of echte klantdata.
- `STRIPE_SECRET_KEY`
  - uitsluitend een Stripe test secret key die met `sk_test_` begint.
- `STRIPE_WEBHOOK_SECRET`
  - signing secret van het Stripe **test** webhookendpoint; begint met `whsec_`.

### Niet-geheime stagingconfiguratie

Vervang `<STAGING_ORIGIN>` door exact de HTTPS-origin van de dedicated Netlify stagingdeployment, zonder trailing slash.

```text
CHECKOUT_SUCCESS_URL=<STAGING_ORIGIN>/order-success.html
CHECKOUT_CANCEL_URL=<STAGING_ORIGIN>/order-cancelled.html
CHECKOUT_ALLOWED_ORIGINS=<STAGING_ORIGIN>
STRIPE_ALLOW_LIVE=false
```

`CHECKOUT_SUCCESS_URL` krijgt server-side automatisch `session_id={CHECKOUT_SESSION_ID}` toegevoegd. Voeg die placeholder dus niet zelf aan de Netlifyvariabele toe.

Laat `STRIPE_ALLOW_LIVE` op `false` staan of verwijder de variabele volledig. Staging mag nooit met een live Stripe key of live webhook werken.

## Stripe test-webhook

Maak in Stripe test mode een webhookendpoint aan op:

```text
<STAGING_ORIGIN>/api/stripe-webhook
```

Abonneer uitsluitend op de eventtypen die de LegendMural webhooknormalizer verwerkt:

- `checkout.session.completed`
- `checkout.session.async_payment_succeeded`
- `checkout.session.async_payment_failed`
- `checkout.session.expired`

Andere geldig ondertekende Stripe-events worden door de server bewust genegeerd.

## Veilige readiness-probe

Na het instellen van de stagingvariabelen en een nieuwe Netlify stagingdeploy:

1. open GitHub Actions;
2. kies **Netlify staging readiness probe**;
3. kies **Run workflow**;
4. vul bij `staging_url` uitsluitend de dedicated HTTPS staging-origin in.

De probe creëert geen order en geen Stripe Checkout Session. Zij gebruikt alleen foutpaden om configuratiegrenzen te bewijzen:

- storefront: HTTP 200;
- `GET /api/checkout`: HTTP 405 `METHOD_NOT_ALLOWED` → Neon bootstrap werkt;
- malformed checkout JSON: HTTP 400 `INVALID_JSON` → checkout return-URLs zijn geconfigureerd;
- lege cart: HTTP 400 `EMPTY_CART` → Stripe test-keyconfiguratie is geldig zonder een Stripe Session te maken;
- `GET /api/order-status`: HTTP 405 → dezelfde Neon order-store is beschikbaar;
- `GET /api/stripe-webhook`: HTTP 405 → webhook Function bootstrap werkt;
- opzettelijk ongeldige Stripe-signature: HTTP 400 → `STRIPE_WEBHOOK_SECRET` is aanwezig; HTTP 503 zou configuratie missen betekenen.

Een 503 op een commerce-endpoint is geen geslaagde readiness-status.

## Daarna: één gecontroleerde Stripe-testorder

Voer pas na een volledig groene readiness-probe één end-to-end test uit:

1. voeg één bestaand product toe aan de stagingcart;
2. gebruik synthetische klant- en adresgegevens;
3. start checkout en controleer dat Stripe een `cs_test_...` Session opent;
4. voltooi de betaling met Stripe testgegevens;
5. bevestig dat `checkout.session.completed` via de ondertekende webhook wordt verwerkt;
6. bevestig dat de Neon-order naar `paid` gaat;
7. bevestig dat `order-success.html` exact dezelfde orderreferentie en Session opvraagt;
8. bevestig dat uitsluitend na serverbevestigde `paid`-status de bijbehorende cart-/Checkoutdata wordt verwijderd;
9. refresh de returnpagina en controleer idempotent gedrag;
10. herhaal geen echte betaling wanneer dezelfde Checkout Session al succesvol is afgerond.

Test daarna afzonderlijk cancel/expiry zodat de winkelwagen behouden blijft.

## Acceptatiecriteria staging

Staging is pas bewezen wanneer:

- readiness-probe volledig groen is;
- alle gebruikte credentials test/staging-only zijn;
- één echte Stripe test Checkout Session succesvol end-to-end is verwerkt;
- de order durable in Neon staat vóór de Checkout-response;
- de ondertekende webhook de status naar `paid` brengt;
- order-status geen klant- of orderdetaildata lekt;
- alleen `paid` de bijbehorende browsercart opruimt;
- duplicate webhook/refresh geen dubbele mutatie veroorzaakt;
- logs geen secrets of volledige gevoelige payloads bevatten.

Een groene stagingtest is **geen** toestemming om live Stripe of productiecredentials te activeren. Productie blijft een afzonderlijke goedkeuringsstap.
