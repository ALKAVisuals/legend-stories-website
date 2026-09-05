# LegendMural — Blocker C Dutch consumer-law verification request

**Date:** 5 September 2026  
**Repository:** `ALKAVisuals/legend-stories-website`  
**Scope:** public website launch-readiness / Dutch consumer payment-law gate  
**Status:** ready to send to a qualified Dutch consumer-law adviser; legal opinion not yet obtained

> This document is a factual request package, not legal advice. It does not authorize Production, PayPal Live, payment-flow changes or V3 changes.

## 1. Exact LegendMural model to be assessed

LegendMural sells standard physical wall-sticker catalogue products to consumers online.

Current intended Dutch consumer flow:

1. customer selects a standard catalogue sticker and variant;
2. LegendMural shows the final order total;
3. customer chooses `Continue to payment`;
4. customer is redirected to hosted PayPal;
5. the customer must pay **100% of the purchase price immediately** to place the order;
6. LegendMural treats the order as paid only after server-side payment verification;
7. processing/production starts after verified full payment;
8. the physical product is delivered later.

Owner policy for this question:

- PayPal only;
- 100% paid at order placement;
- no 50/50 split;
- no deposit plus later balance;
- no second payment request;
- no extra payment provider introduced merely to solve this issue.

The standard catalogue product is produced after the order, but it is not automatically a personalised or bespoke product merely because production occurs after ordering.

## 2. Legal issue requiring a professional answer

The central question is:

> **May LegendMural lawfully require a Dutch consumer buying a standard physical catalogue wall sticker online to pay 100% of the purchase price in advance through PayPal when the product is delivered later, without offering a route under which at least 50% is payable at delivery or afterwards?**

Please answer this question specifically under current Dutch law as of the date of the advice, including Article 7:26(2) BW and any relevant exceptions, case law, implementing rules or current authoritative interpretation.

## 3. Specific points we need answered

Please address each point expressly:

1. Does Article 7:26(2) BW apply to this online sale of standard physical wall stickers?
2. If yes, does it prevent LegendMural from making **100% advance payment mandatory** when delivery follows later?
3. Is it legally relevant that the sticker is printed/produced only after the order, where the catalogue design and offered variants are predefined and the product is not necessarily personalised for that consumer?
4. Does voluntary consumer use of PayPal, PayPal buyer protection or another protection mechanism change the Article 7:26(2) analysis if LegendMural itself offers no option to defer at least 50% until delivery or later?
5. Is there any applicable exception that would allow this exact mandatory 100%-upfront model for the standard catalogue?
6. If the exact model is **not** permitted, what is the minimum legal change required? In particular, is there any compliant implementation that can retain PayPal as the sole payment provider, or must the commercial/payment model itself change?
7. Are there any required checkout/terms disclosures that are separate from the 50%-advance-payment rule and that should be addressed before Dutch consumer launch?

We would like the conclusion stated clearly as one of:

- **CLEARED:** exact model can be used for Dutch consumers, with legal basis stated;
- **CLEARED WITH CONDITIONS:** exact model can be used only if the stated conditions are implemented;
- **NOT CLEARED:** exact mandatory 100%-upfront model conflicts with Dutch consumer law and the minimum required change should be stated.

## 4. Current authoritative-source baseline already identified

This is the background found before requesting professional advice. It is provided to make the question efficient; the adviser should independently verify the current law.

### ACM ConsuWijzer — aanbetaling

Current ACM ConsuWijzer guidance states that for a **product**, an advance payment is legally capped at 50% if the seller requires it; a consumer may voluntarily agree to more.

Source:

https://consument.acm.nl/rekeningen-en-incassoprocedures/wat-zijn-mijn-rechten-bij-een-aanbetaling

### ACM ConsuWijzer — online payment methods

Current ACM ConsuWijzer guidance states that an online seller does not need to offer multiple payment methods, but there must be at least one method under which the consumer can pay at least half at delivery; if payment at delivery is unavailable, an after-payment option must be available.

Source:

https://consument.acm.nl/online-winkelen/hoe-kan-ik-het-beste-betalen-bij-online-aankopen

### ACM ConsuWijzer — example letter refusing excessive advance payment

Current ACM ConsuWijzer consumer guidance states that a seller may not require more than half of the purchase amount as advance payment for a product and provides a route to challenge such a term.

Source:

https://consument.acm.nl/voorbeeldbrieven/rekeningen-en-incassoprocedures/voorbeeldbrief-aanbetaling-weigeren

### Dutch Government — 2026 confirmation of the 50% rule

A 2026 Dutch Government legislative document states that Article 7:26(2) BW means a consumer can be required to pay at most half of the purchase price in advance. It also records that the government's review of the 50% advance-payment rule was completed and that there was insufficient reason to change that rule.

Source:

https://open.overheid.nl/documenten/d6699918-b613-40da-8d91-78dff8c20cb0/file

This current official-source baseline therefore does **not** provide internal grounds to mark the LegendMural 100%-upfront Dutch consumer model as cleared. A qualified Dutch consumer-law opinion is still required before Blocker C can be closed under the unchanged model.

## 5. Ready-to-send message

**Subject:** Juridische toets webshop — verplichte 100% vooruitbetaling bij consumentenkoop

Geachte heer/mevrouw,

Voor onze Nederlandse webshop LegendMural willen wij één specifieke consumentenrechtelijke betaalvraag laten toetsen voordat wij commercieel live gaan.

Wij verkopen fysieke muurstickers uit een vaste online catalogus. De klant kiest een bestaand ontwerp en een vooraf aangeboden formaat. Na de bestelling wordt het product geproduceerd en later geleverd.

Onze gewenste betaalflow is: de consument betaalt bij het plaatsen van de bestelling 100% van het bedrag via PayPal. Pas na bevestigde volledige betaling starten wij de verwerking/productie. Er is geen aanbetaling met later saldo en er is geen mogelijkheid om 50% bij of na levering te betalen.

Kunt u bevestigen of wij dit model voor Nederlandse consumenten rechtsgeldig verplicht mogen toepassen, in het bijzonder gelet op artikel 7:26 lid 2 BW?

Wij ontvangen graag expliciet antwoord op de volgende punten:

- geldt artikel 7:26 lid 2 BW voor deze standaard fysieke catalogusproducten;
- maakt productie na bestelling juridisch verschil als het product niet individueel gepersonaliseerd is;
- mag 100% vooruitbetaling verplicht zijn als PayPal de enige betaalroute is;
- verandert PayPal-kopersbescherming iets aan de wettelijke vooruitbetalingsregel;
- bestaat er een relevante uitzondering voor dit model;
- indien dit model niet is toegestaan: wat is de minimaal noodzakelijke aanpassing en kan PayPal daarbij de enige betaalprovider blijven?

Wij ontvangen bij voorkeur een korte schriftelijke conclusie met de wettelijke grondslag, zodat wij deze als releasebeslissing kunnen vastleggen.

Met vriendelijke groet,

Alka Group, handelend via LegendMural

## 6. Evidence required to close Blocker C

Blocker C remains open until a qualified Dutch consumer-law adviser supplies a written answer that:

- addresses the exact model above rather than online payment in general;
- cites the current legal basis;
- states whether the model is cleared, conditionally cleared or not cleared;
- identifies any required changes before Dutch consumer Production launch.

When that answer is received, record the conclusion in the website handoff without publishing privileged/confidential legal correspondence to public storefront pages.

## 7. Scope boundary

Preparing or receiving this opinion does not itself authorize:

- changing PayPal/V3 code;
- Netlify Production deployment;
- PayPal Live activation;
- Production migrations;
- Production email/invoice activation;
- a real production payment.

Any implementation required by the legal answer must be separately scoped against the website/V3 workstream boundary before code is changed.
