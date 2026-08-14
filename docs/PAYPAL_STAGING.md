# PayPal Sandbox + Neon staging

Laatst inhoudelijk bijgewerkt: 14 augustus 2026.

## Doel

LegendMural gebruikt PayPal als enige beoogde payment provider voor launch en Neon Postgres als eigen orderdatabase. Deze checklist beschrijft hoe de PayPal create-order/capture/webhook flow veilig in een geïsoleerde Netlify stagingomgeving wordt bewezen voordat PayPal Live wordt overwogen.

De repository bevat create order, browser capture, verified order status, Neon persistence, PayPal webhook-signatureverificatie en een idempotente Neon reconciliationprocessor. **De implementatie moet nog tegen echte PayPal Sandbox-events + geïsoleerde Neon staging worden bewezen voordat de betaalarchitectuur productie-gereed is.**

## Architectuur

```text
Browser
  ↓
POST /api/paypal/checkout
  ↓
autoritatieve serverquote
  ↓
Neon payment_pending
  ↓
PayPal Sandbox order
  ↓
klant approval
  ↓
POST /api/paypal/capture
  ↓
PayPal capture
  ↓
Neon paid
  ↓
POST /api/order-status
  ↓
verified return / paid-only cart cleanup
```

Onafhankelijke herstelroute:

```text
POST /api/paypal/webhook
  ↓
PayPal signature postback verification
  ↓
verified event
  ↓
provider/reference/order-id/amount/currency/mode checks
  ↓
idempotente event reservation + order lock
  ↓
Neon reconciliation
```

`PAYMENT.CAPTURE.COMPLETED` kan een gemiste browserreturn herstellen naar `paid`. `CHECKOUT.ORDER.APPROVED` kan recovery-capture uitvoeren met dezelfde stabiele `PayPal-Request-Id` als de browsercapture. `PENDING` en `DECLINED` mogen een `paid` order nooit terugzetten. `PAYMENT.CAPTURE.REFUNDED` en `PAYMENT.CAPTURE.REVERSED` worden in deze launchfase na geldige signature bewust als unsupported genegeerd; een volledige refund/reversal order-state-machine hoort in een aparte operationele wijziging.

## Staginggrenzen

Gebruik uitsluitend:

- een dedicated Netlify Deploy Preview/branchcontext;
- een geïsoleerde Neon staging/testomgeving;
- PayPal Sandbox credentials;
- synthetische klantgegevens;
- Sandbox buyer/seller testaccounts.

Niet toegestaan:

- PayPal Live credentials;
- `PAYPAL_ALLOW_LIVE=true`;
- productie-Neoncredentials;
- echte klantgegevens;
- secrets in GitHub, PR-comments, logs of chat.

## Vereiste Netlify environment variables

Secrets worden rechtstreeks in Netlify ingevoerd.

### Secrets

```text
NEON_DATABASE_URL=<pooled TLS staging runtime URL>
PAYPAL_CLIENT_ID=<PayPal Sandbox client ID>
PAYPAL_CLIENT_SECRET=<PayPal Sandbox secret>
```

### Server-side stagingconfiguratie

```text
PAYPAL_WEBHOOK_ID=<Webhook ID van exact de Sandbox listener-URL>
CHECKOUT_SUCCESS_URL=<STAGING_ORIGIN>/order-success.html
CHECKOUT_CANCEL_URL=<STAGING_ORIGIN>/order-cancelled.html
CHECKOUT_ALLOWED_ORIGINS=<STAGING_ORIGIN>
```

De `PAYPAL_WEBHOOK_ID` hoort bij de webhooklistener die in de PayPal Developer Portal voor deze stagingomgeving is aangemaakt. Gebruik niet stilzwijgend een webhook-ID van een andere app, URL of omgeving.

### PayPal mode

`PAYPAL_API_BASE` mag voor Sandbox afwezig blijven; de server gebruikt dan standaard de officiële Sandbox API-origin.

```text
PAYPAL_ALLOW_LIVE=false
```

Of laat `PAYPAL_ALLOW_LIVE` volledig weg. Staging mag live mode nooit toestaan.

## Readinesscontrole vóór een betaling

Controleer na een verse Netlify stagingdeploy:

1. storefront geeft HTTP 200;
2. `/api/paypal/checkout` bestaat en een verkeerde method faalt gecontroleerd;
3. ontbrekende/ongeldige JSON faalt vóór een PayPal-order wordt aangemaakt;
4. `/api/paypal/capture` bestaat en faalt gecontroleerd op een ongeldige lookup;
5. `/api/order-status` bestaat;
6. `/api/paypal/webhook` bestaat, accepteert alleen JSON `POST` en weigert ongeldige signature requests;
7. met `NEON_DATABASE_URL` en geldige PayPal-configuratie wordt een geverifieerd ondersteund event door de reconciliationprocessor overgenomen;
8. zonder geconfigureerde reconciliation-store blijft de webhook fail-closed en bevestigt hij het event niet als verwerkt;
9. ontbreken van vereiste Neon of PayPal configuratie leidt tot een gecontroleerde fout, niet tot een onduidelijke crash;
10. responses of logs bevatten geen secrets of volledige webhookpayloads.

## Webhookverificatie testen

De listener gebruikt PayPal's officiële `POST /v1/notifications/verify-webhook-signature` postbackmethode. Daarvoor worden de PayPal transmission/signature headers, de environment-specifieke webhook-ID en het ontvangen event aan PayPal aangeboden. Alleen `verification_status: SUCCESS` wordt geaccepteerd.

De ontvangen request body wordt eerst als raw tekst bewaard. Voor de PayPal postback wordt `webhook_event` vervolgens **exact met die ontvangen JSON-tekst** in de verificatiebody ingevoegd. Parse → reserialize is niet toegestaan voor de verificatiebody, omdat PayPal expliciet waarschuwt dat afwijkingen in formatting of content de signature-verificatie kunnen laten falen. Dezelfde raw body mag daarnaast afzonderlijk worden geparsed voor onze eigen eventverwerking nadat de ontvangstvalidatie is uitgevoerd.

Let op: PayPal's webhook simulator verstuurt mockevents die niet via de postback `verify-webhook-signature` endpoint verifieerbaar zijn. Gebruik voor de echte signature/reconciliation acceptance test daarom een werkelijk Sandbox-event dat door de gekoppelde Sandbox REST app wordt gegenereerd.

## Eerste gecontroleerde end-to-end test

Gebruik één bestaand product en synthetische klantdata.

1. Voeg één product toe aan de stagingcart.
2. Controleer de juiste variant:
   - Compact: maximaal 50 × 30 cm — €35 incl. btw;
   - Statement: maximaal 50 × 50 cm — €45 incl. btw.
3. Start checkout.
4. Controleer dat de server zelf prijs, korting en shipping berekent.
5. Controleer dat vóór de PayPal redirect een duurzame `payment_pending` order in Neon bestaat.
6. Voltooi approval met een PayPal Sandbox buyer.
7. Laat de server de PayPal-order capturen.
8. Controleer dat Neon exact dezelfde order naar `paid` brengt.
9. Controleer `/api/order-status` op dezelfde reference en PayPal order ID.
10. Controleer dat de returnpagina alleen na serverbevestigde `paid`-status de relevante cart/checkoutdata verwijdert.
11. Refresh de returnpagina en controleer idempotent gedrag.
12. Controleer dat dezelfde capture niet leidt tot een tweede betaling of dubbele ordermutatie.
13. Controleer dat het echte `PAYMENT.CAPTURE.COMPLETED` Sandbox webhookevent wordt geverifieerd, in `paypal_webhook_events` wordt gereserveerd en idempotent tegen dezelfde order wordt gereconciled.
14. Lever hetzelfde webhookevent opnieuw en controleer dat order `version` en `paid_at` niet nogmaals veranderen.
15. Simuleer browseronderbreking na PayPal-capture en vóór lokale bevestiging; controleer dat `PAYMENT.CAPTURE.COMPLETED` de order alsnog naar `paid` brengt.
16. Controleer `CHECKOUT.ORDER.APPROVED` recovery-capture en bevestig dat dezelfde `legend-paypal-capture-<reference>` idempotency-key wordt gebruikt.
17. Lever een late `PAYMENT.CAPTURE.PENDING` na `paid` en controleer dat de order `paid` blijft.

## Commercecases die afzonderlijk getest moeten worden

### Product en variant

- Compact €35;
- Statement €45;
- Statement als standaard/aanbevolen variant;
- quantity > 1 binnen toegestane grenzen.

### Korting

- zonder kortingscode;
- `LEGEND10` = 10%;
- ongeldige kortingscode wordt geweigerd.

### Shipping

- Nederland: €4,95;
- EU: €9,95;
- Verenigde Staten: €9,95 tracked;
- gratis verzending vanaf €69 in ondersteunde markten;
- niet-ondersteund land wordt geweigerd.

### Security

- gemanipuleerde browserprijs wordt genegeerd;
- gemanipuleerde productnaam/totaal wordt genegeerd;
- onbekend product wordt geweigerd;
- verkeerde PayPal order ID + geldige reference levert geen ordermutatie op;
- verkeerde reference + geldige PayPal order ID levert geen ordermutatie op;
- verkeerd amount/currency levert geen `paid` mutatie op;
- verkeerd provider/mode levert geen ordermutatie op;
- ontbrekende of ongeldige PayPal webhook-signature headers leveren geen ordermutatie op;
- een `FAILURE` signature response van PayPal levert geen ordermutatie op;
- een niet-ondersteund maar geldig geverifieerd event veroorzaakt geen ordermutatie.

### Fout- en retrygedrag

- cancel vóór capture behoudt de cart;
- tijdelijke PayPal API-fout;
- tijdelijke Neon-fout;
- browserrefresh na approval;
- duplicate create-order request;
- duplicate capture request;
- duplicate webhookdelivery;
- `PAYMENT.CAPTURE.COMPLETED` vóór/na `CHECKOUT.ORDER.APPROVED`;
- browsercapture en webhook tegelijk;
- tijdelijke PayPal signature-verificatiestoring;
- trage verbinding/request timeout.

## PayPal webhook — implementatiestatus

De server-side webhooklaag bevat nu:

- officiële PayPal postback signature-verificatie;
- raw-body ontvangst en exact-preserving postback van `webhook_event`;
- environment-specifieke webhook-ID;
- provider-, mode-, reference- en PayPal order-ID matching;
- amount/currency matching voor de ondersteunde capture-events;
- `SERIALIZABLE` transacties en `FOR UPDATE` order locking;
- durable `paypal_webhook_events` event-ID reservation;
- duplicate-event bescherming;
- recovery via `PAYMENT.CAPTURE.COMPLETED`;
- recovery-capture via `CHECKOUT.ORDER.APPROVED`;
- gecontroleerde foutstatus via `CHECKOUT.PAYMENT-APPROVAL.REVERSED`;
- bescherming tegen statusregressie van `paid`;
- minimale ledger zonder volledige PayPal-/klantpayloads;
- verified-but-ignored gedrag voor refund/reversal-events totdat hun financiële state-machine apart is ontworpen.

De resterende launch blocker is nu **bewijs in echte PayPal Sandbox + Neon staging**, niet het ontbreken van de reconciliationcode zelf.

Stripe mag pas worden verwijderd nadat de PayPal flow inclusief webhook/reconciliation en staging-regressies aantoonbaar groen is.

## Productieacceptatie

Een groene Sandboxtest geeft **geen** toestemming voor PayPal Live.

Voor productie zijn daarnaast minimaal vereist:

- volledig geverifieerd PayPal Business-account;
- aparte PayPal Live app/credentials;
- PayPal Live webhook;
- productie-Neonomgeving;
- dedicated least-privilege Neon runtime role;
- backup-/restorebeleid;
- privacy-/retentiebeleid;
- monitoring/logging/incidentprocedure;
- final domain en HTTPS;
- juridische/help-content gereed;
- één gecontroleerde kleine echte bestelling en reconciliatie.
