# Durable checkout persistence contract

Laatst inhoudelijk bijgewerkt: 14 augustus 2026.

## Current status

LegendMural vereist een duurzame orderrecord voordat een hosted payment approval URL als geldige checkoutresponse aan de browser wordt teruggegeven.

De actieve launchrichting gebruikt:

- PayPal voor payment;
- Neon Postgres voor orderopslag;
- Netlify Functions als serveradapter.

De oude Stripe-specifieke implementatie blijft tijdelijk als legacy/fallback in de repository totdat PayPal staging inclusief webhook/reconciliation volledig is bewezen.

## Waarom deze grens nodig is

Een browserreturn of payment-provider redirect is geen voldoende orderbewijs. LegendMural moet de order, het bedrag en de provideridentiteit al server-side kennen voordat de klant buiten de storefront verdergaat.

De PayPal flow is daarom:

1. valideer de minimale browserrequest;
2. bereken de autoritatieve catalogusquote;
3. maak/reserveer de PayPal Order met deterministische idempotency;
4. bouw een autoritatieve `payment_pending` orderrecord;
5. persist die order duurzaam in Neon;
6. controleer dat reference, amount, currency, mode en PayPal order ID overeenkomen;
7. retourneer pas daarna de PayPal approval URL.

Als persistence faalt, wordt de approval URL niet als succesvolle checkoutresponse aan de browser vrijgegeven.

## Store interface

De centrale checkout/storelaag gebruikt duurzame capabilities voor pending checkout en order lookup. De PayPal capturelaag voegt transactionele captureverwerking toe.

Conceptueel:

```js
{
  persistPendingCheckout(order),
  getOrderByReference(reference),
  processPaypalCapture(capture)
}
```

Provider-neutrale capabilities moeten behouden blijven wanneer de legacy Stripecode later wordt verwijderd.

## Pending order record

De server-generated record bevat onder andere:

- deterministische orderreference;
- `payment_pending` status;
- amount/totals in integer cents;
- EUR currency;
- test/live mode;
- provider/payment session identity;
- PayPal order ID voor de PayPal flow;
- autoritatieve productnamen, prijzen, varianten, quantities en pages;
- normalized customer- en deliverygegevens;
- discount- en shippingdetails;
- optimistic versioning.

Browser-supplied namen, prijzen en totals worden niet als autoriteit opgeslagen.

## Idempotency en conflicts

Een identieke retry mag dezelfde bestaande pending order teruggeven.

Een conflict onder dezelfde reference/payment identity mag nooit stilzwijgend worden geaccepteerd wanneer bijvoorbeeld verschilt:

- amount;
- currency;
- mode;
- producten/variant/quantity;
- customer/delivery payload binnen het immutable ordercontract;
- PayPal order ID.

## Capture en `paid`

Na buyer approval:

1. browser levert alleen de eerder bekende reference + PayPal order ID aan de capture endpoint;
2. server haalt de pending order uit Neon;
3. reference en order ID moeten exact overeenkomen;
4. server capturet de PayPal Order;
5. capture-resultaat wordt gecontroleerd op amount, currency en orderidentity;
6. Neon verwerkt de capture idempotent;
7. alleen een correct opgeslagen `paid` orderresultaat wordt als payment confirmation teruggegeven.

Een reeds betaalde order mag een idempotent duplicate-resultaat opleveren zonder nieuwe paymentmutatie.

## Failure behavior

- ontbrekende Neon store/configuratie → gecontroleerde 503;
- ontbrekende PayPal Sandbox credentials → gecontroleerde 503;
- conflicterende pending order → geen geldige approvalflow;
- verkeerde reference/order ID → geen orderdetails, generieke not-found/mismatchbehandeling;
- capture/provider mismatch → weigeren;
- tijdelijke storagefailure na capture → paymentstate moet later via retry/webhook/reconciliation herstelbaar zijn;
- identieke retry → veilig/idempotent.

## Relatie tot PayPal webhook

De huidige create/capture persistence is nog niet de volledige productieflow.

Voor productie moet een PayPal webhook/reconciliationlaag hetzelfde duurzame ordermodel gebruiken om:

- provider events onafhankelijk van de browserreturn te verwerken;
- duplicate events idempotent te reserveren/verwerken;
- capture/paymentidentity te matchen;
- Neon state te reconciliëren;
- reeds betaalde orders niet te laten regresseren.

## Neon

De echte geïsoleerde Neon-integratie is uitgevoerd. Migraties, conformance en concurrent gedrag zijn getest. JSONB-serialisatie en retryable SERIALIZABLE conflicts zijn al gehard.

Voor productie blijven vereist:

- separate production environment;
- dedicated least-privilege runtime role;
- backup-/restorebeleid;
- privacy-/retentiebeleid.

## Validation

Run:

```bash
npm run validate:checkout-persistence
npm run validate:neon-order-store
npm test
npm run quality
```

De bestaande validation suite bevat nog legacy Stripecases zolang Stripecode bewust niet is verwijderd. PayPal-specifieke E2E staging komt bovenop deze repositorychecks.
