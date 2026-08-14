# Verified order status return flow

Laatst inhoudelijk bijgewerkt: 14 augustus 2026.

## Current status

De returnflow ondersteunt PayPal order IDs en gebruikt same-origin Netlify endpoints voor capture en statuscontrole.

Doelroutes:

```text
/api/paypal/capture
/api/order-status
```

De browserreturn is geen betalingsbewijs. Alleen de server mag een order als betaald bevestigen.

## Verification identity

De browser bezit minimaal:

- de 64-character server-generated LegendMural orderreference;
- de PayPal order ID die bij dezelfde pending order hoort.

De status/capture request bevat geen browserprijs, totaal, customer- of productpayload als betalingsbewijs.

Conceptueel:

```json
{
  "reference": "…",
  "orderId": "PAYPAL_ORDER_ID"
}
```

Voor de generieke orderstatuslaag wordt de payment session/order ID als `sessionId` doorgegeven, zodat de statusendpoint zowel de bestaande legacy Stripe-identiteit als PayPal order IDs kan valideren zolang de migratie loopt.

## PayPal capture

Na approval controleert `/api/paypal/capture` eerst:

- geldige LegendMural reference;
- geldige PayPal order ID;
- dat de opgeslagen order bestaat;
- dat de opgeslagen payment session/order ID exact overeenkomt;
- dat test/live mode consistent is.

Daarna capturet de server via PayPal en valideert het resultaat tegen:

- reference;
- PayPal order ID;
- amount;
- currency.

Neon moet vervolgens een `paid` order teruggeven voordat de endpoint payment confirmation retourneert.

Een reeds betaalde order kan idempotent als duplicate result terugkomen.

## Server order-status endpoint

De orderstatusendpoint gebruikt:

```js
orderStore.getOrderByReference(reference)
```

De endpoint:

- accepteert alleen de bedoelde JSON requestmethode;
- handhaaft de configured storefront origin;
- faalt gesloten zonder store;
- geeft dezelfde generieke not-foundbehandeling bij onbekende/mismatched orderidentiteit;
- retourneert geen customer-, address-, product- of amountdetails;
- gebruikt `Cache-Control: no-store`.

Een succesvolle response is privacy-minimaal en bevat alleen identifiers/statusmetadata die nodig zijn voor de returnflow.

## Cart-clearing policy

Checkout/cartdata wordt alleen verwijderd wanneer de serverresponse intern consistent is en bevat:

```text
status = paid
paid = true
```

Deze states wissen de cart niet:

- `payment_pending`;
- `payment_processing`;
- `payment_failed`;
- `expired`;
- unknown/unavailable.

Unrelated browserpreferences blijven behouden.

## Return-page behavior

`order-success.html` en `js/order-return.js` kunnen onder andere tonen:

- verification in progress;
- payment pending;
- payment processing;
- payment failed;
- checkout expired;
- payment confirmed;
- verification unavailable.

De pagina blijft `noindex, nofollow`.

## PayPal webhook en reconciliation

De returnflow is niet bedoeld als vervanging voor een onafhankelijke provider webhook.

Voor productie moet nog een PayPal webhook/reconciliationlaag worden gebouwd zodat Neon ook correct kan worden bijgewerkt wanneer:

- de klant de returnpagina nooit opent;
- de browser sluit na approval;
- een netwerkfout tussen capture en browserresponse optreedt;
- PayPal een event opnieuw bezorgt.

De webhook/reconciliationlaag moet idempotent zijn en dezelfde orderidentiteit/amount/currency/mode controleren.

## Validation

Run:

```bash
npm run validate:order-return
npm run validate:browser-checkout
npm test
npm run quality
```

Daarnaast is een echte PayPal Sandbox + Neon stagingtest vereist vóór productie. Zie [`PAYPAL_STAGING.md`](PAYPAL_STAGING.md).
