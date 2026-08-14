# Browser checkout integration

Laatst inhoudelijk bijgewerkt: 14 augustus 2026.

## Current status

De storefront gebruikt een provider-aware hosted checkout client. Voor de launch is **PayPal de enige beoogde payment provider**.

De Netlify-build genereert runtimeconfiguratie met deze doelroutes:

```text
/api/paypal/checkout
/api/paypal/capture
/api/order-status
```

PayPal Live is niet geactiveerd. Zonder geldige Neon- en PayPal-configuratie falen de servergrenzen gesloten.

Legacy Stripecode blijft tijdelijk aanwezig totdat de volledige PayPal Sandbox + Neon flow inclusief webhook/reconciliation bewezen is.

## Browser flow

De browser:

1. valideert checkoutformulier en adres;
2. bouwt een minimale orderrequest uit stabiele productidentiteiten, varianten en quantities;
3. stuurt alleen de noodzakelijke order/customer data naar de same-origin checkout endpoint;
4. vertrouwt browserprijzen, shipping of totalen niet als betalingsautoriteit;
5. valideert provider, mode, reference, payment session/order ID en approval URL uit de serverresponse;
6. bewaart de server-generated reference en payment session/order ID tijdelijk voor de returnflow;
7. redirect alleen naar een trusted PayPal host wanneer `provider = paypal`.

Voor PayPal Sandbox worden uitsluitend officiële sandbox PayPal hosts geaccepteerd; live PayPal hosts worden alleen bij een expliciet live-mode serverresultaat geaccepteerd.

## PayPal return en capture

Na buyer approval wordt de betaling niet simpelweg op basis van de return-URL als betaald beschouwd.

De browserreturn gebruikt:

- de 64-character LegendMural orderreference;
- de PayPal order ID;
- `/api/paypal/capture` voor server-side capture;
- `/api/order-status` voor de uiteindelijke privacy-minimale statuscontrole.

De capture endpoint controleert eerst of reference en PayPal order ID bij de gereserveerde Neon-order horen. Daarna wordt PayPal server-side gecaptured en wordt alleen een `paid` resultaat teruggegeven wanneer Neon de betaalde order heeft bevestigd.

## Cart clearing

De cart wordt nooit geleegd vanwege alleen:

- een querystring;
- een redirect;
- een PayPal approval-resultaat in de browser.

Checkout/cartdata wordt alleen verwijderd na een intern consistente, serverbevestigde:

```text
status = paid
paid = true
```

Pending, processing, failed, expired of unavailable states behouden de cart.

## Return pages

- `order-success.html` verifieert/capturet de paymentstate en toont de serverbevestigde status;
- `order-cancelled.html` behoudt de winkelwagen wanneer geen betaling is voltooid;
- beide pagina’s blijven `noindex, nofollow`.

## Security invariants

- PayPal Client Secret verschijnt nooit onder `js/` of in HTML;
- requests gebruiken same-origin endpoints en geen ambient credentials;
- niet-lokale endpoints vereisen HTTPS;
- browsercalculated prijzen/totals worden nooit betalingsautoriteit;
- PayPal approval URLs worden tegen trusted PayPal hosts gevalideerd;
- reference en PayPal order ID moeten bij dezelfde opgeslagen order horen;
- PayPal Live vereist expliciete server-side enablement;
- de browserreturn is geen onafhankelijke webhookvervanger.

## Nog vereist vóór productie

1. PayPal webhook/reconciliation implementeren.
2. Geïsoleerde Neon staging configureren.
3. PayPal Sandbox credentials rechtstreeks in Netlify configureren.
4. Complete create → approval → capture → Neon paid → order status flow testen.
5. Duplicate create/capture/refresh en foutpaden testen.
6. Webhook/reconciliation testen wanneer de browserreturn niet plaatsvindt.
7. Pas daarna legacy Stripe gecontroleerd verwijderen.
8. PayPal Live blijft geblokkeerd totdat staging, operations en launchchecks zijn goedgekeurd.

Zie [`PAYPAL_STAGING.md`](PAYPAL_STAGING.md) voor de volledige acceptatiechecklist.

## Validation

Run:

```bash
npm run validate:browser-checkout
npm run validate:order-return
npm test
npm run quality
```

De huidige quality chain bevat nog enkele Stripe-contracten zolang de legacy code bewust aanwezig blijft.
