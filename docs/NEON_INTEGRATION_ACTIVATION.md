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
- synthetische fixture-cleanup.

De volledige migrationketen omvat migrations `001` t/m `006`.

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
6. `006_grant_withdrawal_runtime.sql`.

Runtime grants gebruiken een expliciete `__LEGEND_RUNTIME_ROLE__` placeholder die door de migrationrunner veilig als identifier wordt ingevuld.

De runtime role krijgt:

- `orders`: SELECT, INSERT en UPDATE;
- `stripe_events`: SELECT en INSERT;
- `paypal_webhook_events`: SELECT en INSERT;
- `withdrawal_requests`: SELECT en INSERT;
- geen DELETE of TRUNCATE op de commerce-tabellen;
- geen UPDATE op de immutable Stripe-, PayPal-webhook- of withdrawal-ledgers.

## Production role model

Op 18 augustus 2026 zijn op de Neon production branch drie least-privilege NOLOGIN-rollen ingericht:

- `legendmural_runtime` — privilegegroep voor migrations `002`, `004` en `006`;
- `legendmural_app` — toekomstige applicatierol en lid van `legendmural_runtime`;
- `legendmural_migrator` — migration-owner met beperkte database-create capability en zonder CREATEDB, CREATEROLE, REPLICATION of BYPASSRLS.

Deze rollen zijn bewust NOLOGIN. Gate 5 kon zonder standalone migration password worden uitgevoerd via de geauthenticeerde Neon operator-sessie met `SET ROLE legendmural_migrator`. Daardoor zijn de production-objecten eigendom van de beperkte migratorrol zonder een extra langlevend migration-secret te creëren.

De echte `legendmural_app` logincredential blijft uitgesteld tot Gate 6 en wordt uitsluitend server-side opgeslagen. `neondb_owner` blijft een beheer/operatorrol en mag niet als Netlify applicatiecredential worden gebruikt.

## Vereiste secrets voor de handmatige echte-Neon regressierun

De bestaande `workflow_dispatch` integratieworkflow vereist uitsluitend test-/stagingcredentials:

- `NEON_TEST_DATABASE_URL`: runtimeverbinding voor de geïsoleerde Neon-branch;
- `NEON_TEST_MIGRATION_URL`: directe migrationverbinding voor dezelfde branch/database.

De URLs moeten verschillende database-rollen gebruiken. De migration-URL moet een directe, niet-gepoolde endpoint gebruiken. Secrets mogen nooit worden geprint of gecommit.

## Wat de handmatige integration workflow bewijst

De workflow:

1. weigert te starten wanneer een vereiste secret ontbreekt;
2. installeert de exacte dependency lock;
3. past migrations `001` t/m `006` toe;
4. ruimt alleen synthetische records op;
5. draait de provider-neutrale order-store conformance-suite;
6. bewijst PayPal provider-afleiding;
7. bewijst PayPal reconciliation en duplicate idempotency;
8. registreert een withdrawal idempotent via de runtime store;
9. controleert dat de runtime role de payment/withdrawal ledgers niet destructief kan muteren;
10. ruimt synthetische records ook na fouten op;
11. draait daarna de credential-free Neon architectuurvalidatie.

## Production-derived bootstrapbewijs — 18 augustus 2026

De repositorybaseline voor de Gate 5 preflight was Git SHA `5bb4783ec83438bb1ebe5f25922fbd2a8d50e4a4`.

Vanaf de toen lege production branch is tijdelijke branch `gate5-migration-validation-20260818` gemaakt. Op die branch zijn exact migrations `001` t/m `006` uitgevoerd onder `legendmural_migrator`, met `legendmural_runtime` als runtime-placeholderdoel.

Daarmee is bewezen dat:

- migrations `001` t/m `006` het volledige commerce-schema vanaf nul kunnen opbouwen;
- `orders`, historisch `stripe_events`, `paypal_webhook_events` en `withdrawal_requests` aanwezig zijn;
- alle commerce-tabellen en indexen eigendom zijn van `legendmural_migrator`;
- `legendmural_app` de runtimeprivileges via `legendmural_runtime` kan gebruiken;
- een synthetische PayPal order `payment_provider=paypal` oplevert;
- een synthetische PayPal webhook en withdrawal door het app-role contract kunnen worden geregistreerd;
- `orders` SELECT/INSERT/UPDATE toestaat maar DELETE/TRUNCATE weigert;
- de immutable Stripe-, PayPal-webhook- en withdrawal-ledgers SELECT/INSERT toestaan maar UPDATE/DELETE/TRUNCATE weigeren.

De tijdelijke validation branch is na succesvolle controle verwijderd.

## Production bootstrap — 18 augustus 2026

Na expliciete owner approval is Gate 5 uitgevoerd op production branch `br-misty-cloud-as0rofc8`.

Uitvoering:

- exact reviewed migrationketen `001 -> 006` uit Git SHA `5bb4783ec83438bb1ebe5f25922fbd2a8d50e4a4`;
- geauthenticeerde Neon operator-sessie;
- `SET ROLE legendmural_migrator` vóór schema/objectcreatie;
- `legendmural_runtime` als expliciet grant-doel;
- één atomaire production-transactie voor de migrationketen;
- geen standalone migration password of connection string gecreëerd of opgeslagen.

Post-migration verificatie bevestigde:

- `legend_commerce.orders` bestaat;
- `legend_commerce.stripe_events` bestaat voor historische compatibiliteit;
- `legend_commerce.paypal_webhook_events` bestaat;
- `legend_commerce.withdrawal_requests` bestaat;
- alle commerce-tabellen en indexen eigendom zijn van `legendmural_migrator`;
- `legendmural_app` exact de bedoelde SELECT/INSERT-rechten erft en alleen op `orders` UPDATE heeft;
- DELETE/TRUNCATE voor `legendmural_app` op alle vier commerce-tabellen ontbreekt;
- UPDATE op de immutable Stripe-, PayPal-webhook- en withdrawal-ledgers ontbreekt;
- een synthetische production PayPal order `payment_provider=paypal` opleverde;
- een synthetisch PayPal webhook-event en withdrawal-record konden worden geregistreerd;
- alle synthetische smoke records direct daarna werden verwijderd;
- eindtelling op `orders`, `stripe_events`, `paypal_webhook_events` en `withdrawal_requests` gelijk was aan nul.

Gate 5 heeft geen Netlify production secret, Resend production secret of PayPal Live instelling gewijzigd.

## Neon Free-plan compensating controls

De Neon organisatie `ALKAGroup` staat momenteel op het Free-plan.

De huidige Free-planbeperkingen die voor LegendMural relevant zijn:

- production kan niet als protected branch worden gemarkeerd;
- de project history-retention blijft 6 uur;
- een paid-plan branch-protection/longer-PITR model is dus niet beschikbaar zolang Free wordt gebruikt.

LegendMural accepteert dit voor de huidige launch-preparatiefase met compensating controls:

1. destructive production database actions vereisen expliciete operator approval;
2. migrations worden eerst op een production-derived child branch bewezen;
3. een persistente pre-change recovery branch wordt aangehouden;
4. runtime en migration ownership blijven gescheiden;
5. `neondb_owner` wordt niet als appcredential gebruikt;
6. production application credentials worden just-in-time gemaakt;
7. PayPal Live blijft een latere aparte gate;
8. een upgrade naar Neon Launch wordt opnieuw beoordeeld wanneer real-world volume/risk stijgt.

Zie `docs/NEON_FREE_PLAN_PRODUCTION_CONTROLS.md` voor de volledige Free-plan policy.

## Persistent pre-bootstrap recovery point

Op 18 augustus 2026 is vóór production schema-bootstrap een persistente child branch gemaakt:

- naam: `pre-prod-bootstrap-20260818`;
- branch ID: `br-long-field-aspnw4co`;
- parent: production `br-misty-cloud-as0rofc8`;
- inhoud: lege commerce-baseline plus de production role-architectuur vóór migrations `001–006`.

Deze branch blijft bestaan tot de eerste gecontroleerde end-to-end launchvalidatie is afgerond en de release operator hem bewust retireert.

De branch is een extra recovery/checkpoint-control en vervangt geen volledige backupstrategie.

## Huidige production-observaties

Inspectie na Gate 5 op 18 augustus 2026 bevestigt:

- project: `Legendmural`;
- primary/default root branch: `production`;
- production branch: niet protected omdat de organisatie Free gebruikt;
- project history-retention: 21.600 seconden (6 uur);
- production runtime/migration/app role-architectuur: ingericht als NOLOGIN;
- production migrations `001–006`: uitgevoerd;
- volledige `legend_commerce` schema aanwezig;
- alle vier commerce-tabellen leeg na synthetic smoke cleanup;
- persistente pre-bootstrap recovery branch: aanwezig;
- production appcredential/Netlify runtime URL: nog niet geactiveerd;
- PayPal Live: nog niet geactiveerd.

De compute-instelling `passwordless_access=true` is beoordeeld als Neons account-geauthenticeerde interactieve tooling en niet als applicatie-authenticatiemethode. De production app zal een aparte least-privilege credential gebruiken.

## Veiligheidsgrenzen

- De normale echte-Neon regressieworkflow is handmatig (`workflow_dispatch`) en repository-permissions blijven read-only.
- The manual Neon integration workflow does not touch Netlify or production deployment configuration.
- Testworkflows mogen geen productioncredentials gebruiken.
- PayPal Live wordt niet door database-integratietests geactiveerd.
- Full PayPal/customerpayloads worden niet in de event-ledger opgeslagen.
- Historische migrations worden niet herschreven om oude Stripe-schemahistorie cosmetisch te verwijderen.
- Production application credential/configuratie en restorebeleid blijven afzonderlijke operationele controls.
- De persistente pre-bootstrap branch mag niet als algemene ontwikkelbranch worden gebruikt.

## Volgende productiegrens

Gate 5 is afgerond. De volgende databasegerelateerde production boundary is Gate 6:

- just-in-time least-privilege `legendmural_app` logincredential creëren;
- production runtime connection string server-side opslaan;
- `neondb_owner` uitsluiten van Netlify runtime;
- same-origin API smoke checks uitvoeren zonder echte charge;
- PayPal Live uitgeschakeld houden totdat alle voorafgaande gates GO zijn.

Daarnaast blijven Gate 2/3 voor durable withdrawal acknowledgement, Gate 7 monitoring/incident readiness en Gate 1 final deployed-domain verification open.

Zie `docs/PRODUCTION_GO_NO_GO_CHECKLIST.md`, `docs/NEON_FREE_PLAN_PRODUCTION_CONTROLS.md` en `docs/PRODUCTION_READINESS_RUNBOOK.md` voor de volledige volgorde.
