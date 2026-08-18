# Neon integration validation

Laatst inhoudelijk bijgewerkt: 18 augustus 2026.

Dit document beschrijft de blijvende echte-Neon testharness, de bewezen databasecontracten en de grens tussen geïsoleerde validatie en production-activatie.

## Huidige status

De LegendMural paymentruntime is PayPal-only voor nieuwe checkouts. Historische Stripe-schemaonderdelen blijven alleen bestaan voor audit/read-compatibiliteit en zijn geen actieve paymentruntime.

De bestaande echte Neon-validatie heeft onder andere bewezen:

- provider-neutrale order-store conformance;
- concurrent pending-ordergedrag;
- expliciete JSONB-serialisatie;
- bounded retries voor retryable `SERIALIZABLE` conflicts;
- PayPal order IDs met database-afgeleide `payment_provider=paypal`;
- PayPal webhook-ledger en idempotente reconciliation;
- pending -> paid overgang met versiecontrole;
- duplicate PayPal webhook-idempotency;
- least-privilege event-ledgergrenzen;
- immutable withdrawal-ledgergrenzen;
- duurzame withdrawal-acknowledgement snapshot + afzonderlijke delivery-metadata;
- synthetische fixture-cleanup.

De actuele voorgestelde migrationketen in deze branch omvat migrations `001` t/m `008`. Production bevat op dit moment alleen de reeds goedgekeurde en uitgevoerde migrations `001` t/m `006`; migrations `007` en `008` zijn additive vervolg-migrations en zijn nog niet op production toegepast.

## Pinned runtime dependencies

De integratie gebruikt:

- `@neondatabase/serverless` `1.0.2`;
- `ws` `8.21.1`.

De Netlify-build en permanente Netlify-compatibiliteitscontrole draaien op Node.js 22.

## Migrationcontract

De migrationrunner verwerkt migrations strikt in numerieke volgorde:

1. `001_create_order_store.sql`;
2. `002_grant_order_store_runtime.sql`;
3. `003_add_paypal_reconciliation.sql`;
4. `004_grant_paypal_reconciliation_runtime.sql`;
5. `005_create_withdrawal_requests.sql`;
6. `006_grant_withdrawal_runtime.sql`;
7. `007_create_withdrawal_acknowledgements.sql`;
8. `008_grant_withdrawal_acknowledgement_runtime.sql`.

Runtime grants gebruiken een expliciete `__LEGEND_RUNTIME_ROLE__` placeholder die door de migrationrunner veilig als identifier wordt ingevuld.

De runtime role krijgt:

- `orders`: SELECT, INSERT en UPDATE;
- `stripe_events`: SELECT en INSERT;
- `paypal_webhook_events`: SELECT en INSERT;
- `withdrawal_requests`: SELECT en INSERT;
- `withdrawal_acknowledgements`: SELECT en INSERT;
- `withdrawal_acknowledgements`: UPDATE uitsluitend op delivery-metadata (`delivery_status`, attempts, delivery timestamps, provider message ID, sanitized error code en `updated_at`);
- geen DELETE of TRUNCATE op de commerce-tabellen;
- geen UPDATE op de immutable Stripe-, PayPal-webhook- of withdrawal-ledgers;
- geen UPDATE op de immutable acknowledgement statementvelden zoals naam, bevestigingsadres, declaration, confirmation code en withdrawal timestamp.

## Waarom acknowledgement data apart staat

`withdrawal_requests` blijft de immutable registratie van de herroepingshandeling. De nieuwe `withdrawal_acknowledgements`-tabel is een aparte durable snapshot/outbox voor de elektronische bevestiging. Daarin worden de gegevens bewaard die nodig zijn om dezelfde acknowledgement later gecontroleerd opnieuw te kunnen verzenden wanneer delivery faalt:

- consumentnaam;
- confirmation email;
- contract-identificerende PayPal Order ID en interne order reference;
- canonical confirmation code;
- declaration snapshot;
- oorspronkelijke withdrawal ontvangsttijd;
- afzonderlijke delivery-status en delivery-attempt metadata.

De runtime mag de statement snapshot niet muteren. Alleen delivery-metadata is updatebaar. Een acknowledgement die als `sent` is geregistreerd wordt door de normale withdrawal-flow niet automatisch opnieuw verstuurd.

## Production role model

Op 18 augustus 2026 zijn op de Neon production branch drie least-privilege rollen ingericht:

- `legendmural_runtime` — privilegegroep voor runtime grants;
- `legendmural_app` — applicatierol en lid van `legendmural_runtime`;
- `legendmural_migrator` — migration-owner met beperkte database-create capability en zonder CREATEDB, CREATEROLE, REPLICATION of BYPASSRLS.

`neondb_owner` blijft een beheer/operatorrol en mag niet als Netlify applicatiecredential worden gebruikt.

## Vereiste secrets voor de handmatige echte-Neon regressierun

De bestaande `workflow_dispatch` integratieworkflow vereist uitsluitend test-/stagingcredentials:

- `NEON_TEST_DATABASE_URL`: runtimeverbinding voor de geïsoleerde Neon-branch;
- `NEON_TEST_MIGRATION_URL`: directe migrationverbinding voor dezelfde branch/database.

De URLs moeten verschillende database-rollen gebruiken. De migration-URL moet een directe, niet-gepoolde endpoint gebruiken. Secrets mogen nooit worden geprint of gecommit.

## Wat de handmatige integration workflow bewijst

De workflow:

1. weigert te starten wanneer een vereiste secret ontbreekt;
2. installeert de exacte dependency lock;
3. past migrations `001` t/m `008` toe;
4. ruimt alleen synthetische records op;
5. draait de provider-neutrale order-store conformance-suite;
6. bewijst PayPal provider-afleiding;
7. bewijst PayPal reconciliation en duplicate idempotency;
8. registreert een withdrawal idempotent via de runtime store;
9. bewijst dat de acknowledgement statement snapshot duurzaam en idempotent wordt opgeslagen;
10. bewijst dat delivery failure metadata updatebaar is zonder de statement snapshot te muteren;
11. controleert dat de runtime role de payment/withdrawal ledgers niet destructief kan muteren;
12. controleert dat de runtime role immutable acknowledgementvelden niet kan wijzigen/verwijderen/truncaten;
13. ruimt synthetische records ook na fouten op;
14. draait daarna de credential-free Neon architectuurvalidatie.

## Gate 5 production bootstrap — historische uitvoering op 18 augustus 2026

De repositorybaseline voor de Gate 5 preflight was Git SHA `5bb4783ec83438bb1ebe5f25922fbd2a8d50e4a4`.

Vanaf de toen lege production branch is tijdelijke branch `gate5-migration-validation-20260818` gemaakt. Op die branch zijn exact migrations `001` t/m `006` uitgevoerd onder `legendmural_migrator`, met `legendmural_runtime` als runtime-placeholderdoel.

Na expliciete owner approval is dezelfde Gate 5-keten `001 -> 006` op production branch `br-misty-cloud-as0rofc8` uitgevoerd. Post-migration verificatie bevestigde:

- `legend_commerce.orders` bestaat;
- `legend_commerce.stripe_events` bestaat voor historische compatibiliteit;
- `legend_commerce.paypal_webhook_events` bestaat;
- `legend_commerce.withdrawal_requests` bestaat;
- alle toenmalige commerce-tabellen en indexen eigendom zijn van `legendmural_migrator`;
- `legendmural_app` exact de bedoelde least-privilege rechten erft;
- een synthetische production PayPal order `payment_provider=paypal` opleverde;
- een synthetisch PayPal webhook-event en withdrawal-record konden worden geregistreerd;
- alle synthetische smoke records direct daarna werden verwijderd;
- eindtelling op de vier toenmalige commerce-tabellen gelijk was aan nul.

Gate 5 heeft geen Netlify production secret, Resend production secret of PayPal Live instelling gewijzigd.

## Vervolg-migrations `007–008`

Migrations `007` en `008` horen bij de durable acknowledgement outbox en zijn **niet** onderdeel van de al afgeronde Gate 5-uitvoering. Voor production gelden opnieuw dezelfde veiligheidsgrenzen:

1. eerst exact-head code- en migrationvalidatie;
2. eerst uitvoering op een production-derived tijdelijke child branch;
3. verificatie van ownership, constraints en least-privilege grants;
4. expliciete owner approval vóór production SQL;
5. additive migration uitvoeren vóór een Netlify production deploy die de nieuwe acknowledgement store verwacht;
6. post-migration production verificatie zonder echte klantdata;
7. recovery checkpoint behouden totdat controlled launch validation is afgerond.

## Neon Free-plan compensating controls

De Neon organisatie `ALKAGroup` staat momenteel op het Free-plan.

Relevante beperkingen:

- production kan niet als protected branch worden gemarkeerd;
- project history-retention blijft 6 uur.

LegendMural compenseert dit in de huidige launch-preparatiefase met:

1. expliciete approval voor destructive/production database actions;
2. production-derived preflight branches voor migrations;
3. persistente pre-change recovery branch;
4. gescheiden runtime- en migration ownership;
5. geen `neondb_owner` als appcredential;
6. PayPal Live als aparte latere gate.

Zie `docs/NEON_FREE_PLAN_PRODUCTION_CONTROLS.md` voor de volledige Free-plan policy.

## Persistent pre-bootstrap recovery point

Voor de oorspronkelijke Gate 5 production schema-bootstrap is de persistente child branch `pre-prod-bootstrap-20260818` (`br-long-field-aspnw4co`) gemaakt vanaf production `br-misty-cloud-as0rofc8`.

Deze branch blijft bestaan tot de eerste gecontroleerde end-to-end launchvalidatie is afgerond en de release operator hem bewust retireert. Hij is een extra recovery/checkpoint-control en vervangt geen volledige backupstrategie.

## Huidige production-observaties

Production bevat momenteel:

- migrations `001–006` uitgevoerd;
- `orders`, historisch `stripe_events`, `paypal_webhook_events` en `withdrawal_requests`;
- nog **geen** `withdrawal_acknowledgements`, omdat `007–008` niet zijn uitgevoerd;
- Free-plan 6-uurs history-retention;
- persistente pre-bootstrap recovery branch;
- PayPal Live nog niet geactiveerd;
- Netlify Production `NEON_DATABASE_URL` volgens de owner-screenshot nog leeg; de bestaande Deploy Preview secret hoort bij de geïsoleerde stagingomgeving en mag niet naar Production worden gekopieerd.

## Veiligheidsgrenzen

- De normale echte-Neon regressieworkflow is handmatig (`workflow_dispatch`) en repository-permissions blijven read-only.
- The manual Neon integration workflow does not touch Netlify or production deployment configuration.
- Testworkflows mogen geen productioncredentials gebruiken.
- PayPal Live wordt niet door database-integratietests geactiveerd.
- Full PayPal/customerpayloads worden niet in de payment event-ledger opgeslagen.
- Historische migrations worden niet herschreven.
- De acknowledgement outbox slaat alleen de data op die nodig is om de wettelijke acknowledgement duurzaam te reproduceren en delivery op te volgen.
- Production migration, production application credential/configuratie en Resend activation blijven afzonderlijke operationele gates.
- De persistente pre-bootstrap branch mag niet als algemene ontwikkelbranch worden gebruikt.

## Volgende productiegrens

Voordat de nieuwe acknowledgement-outboxcode production kan worden gedeployed:

- migrations `007–008` exact-head valideren op een production-derived child branch;
- na aparte approval `007–008` op production uitvoeren en verifiëren;
- least-privilege `legendmural_app` Production connection veilig in Netlify configureren;
- Resend sending identity/API key pas na Gate 3 configureren en testen;
- same-origin API smoke checks uitvoeren zonder echte charge;
- PayPal Live uitgeschakeld houden totdat alle voorafgaande gates GO zijn.

Zie `docs/PRODUCTION_GO_NO_GO_CHECKLIST.md`, `docs/NEON_FREE_PLAN_PRODUCTION_CONTROLS.md` en `docs/PRODUCTION_READINESS_RUNBOOK.md` voor de volledige volgorde.
