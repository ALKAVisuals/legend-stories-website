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
- `legendmural_migrator` — toekomstige migration-owner met beperkte database-create capability en zonder CREATEDB, CREATEROLE, REPLICATION of BYPASSRLS.

Deze rollen zijn bewust NOLOGIN. De echte production logincredentials worden pas just-in-time gemaakt wanneer Gate 5/6 daadwerkelijk wordt uitgevoerd. Daardoor bestaan er niet vroegtijdig ongebruikte langlevende secrets.

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

De actuele repositorybaseline voor deze test was Git SHA `5bb4783ec83438bb1ebe5f25922fbd2a8d50e4a4`.

Vanaf de actuele lege production branch is een tijdelijke branch `gate5-migration-validation-20260818` gemaakt. Op die branch zijn exact migrations `001` t/m `006` uitgevoerd onder `legendmural_migrator`, met `legendmural_runtime` als runtime-placeholderdoel.

Daarmee is opnieuw bewezen dat:

- migrations `001` t/m `006` het volledige commerce-schema vanaf nul kunnen opbouwen;
- `orders`, historisch `stripe_events`, `paypal_webhook_events` en `withdrawal_requests` aanwezig zijn;
- alle commerce-tabellen en indexen eigendom zijn van `legendmural_migrator`;
- `legendmural_app` de runtimeprivileges via `legendmural_runtime` kan gebruiken;
- een synthetische PayPal order `payment_provider=paypal` oplevert;
- een synthetische PayPal webhook en withdrawal door de app-role kunnen worden geregistreerd;
- `orders` SELECT/INSERT/UPDATE toestaat maar DELETE/TRUNCATE weigert;
- de immutable Stripe-, PayPal-webhook- en withdrawal-ledgers SELECT/INSERT toestaan maar UPDATE/DELETE/TRUNCATE weigeren.

De tijdelijke validation branch is na succesvolle controle verwijderd. Production bleef zonder commerce-schema of commerce-tabellen.

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
6. production credentials worden just-in-time gemaakt;
7. PayPal Live blijft een latere aparte gate;
8. een upgrade naar Neon Launch wordt opnieuw beoordeeld wanneer real-world volume/risk stijgt.

Zie `docs/NEON_FREE_PLAN_PRODUCTION_CONTROLS.md` voor de volledige Free-plan policy.

## Persistent pre-bootstrap recovery point

Op 18 augustus 2026 is vóór production schema-bootstrap een persistente child branch gemaakt:

- naam: `pre-prod-bootstrap-20260818`;
- branch ID: `br-long-field-aspnw4co`;
- parent: production `br-misty-cloud-as0rofc8`;
- inhoud: lege commerce-baseline plus de production role-architectuur vóór migrations `001–006`.

Deze branch moet blijven bestaan totdat de production bootstrap en de eerste gecontroleerde end-to-end launchvalidatie zijn afgerond en de release operator hem bewust retireert.

De branch is een extra recovery/checkpoint-control en vervangt geen volledige backupstrategie.

## Huidige production-observaties

Inspectie op 18 augustus 2026 bevestigt:

- project: `Legendmural`;
- primary/default root branch: `production`;
- production commerce-schema: nog leeg;
- production branch: niet protected omdat de organisatie Free gebruikt;
- project history-retention: 21.600 seconden (6 uur);
- production runtime/migration/app role-architectuur: ingericht als NOLOGIN;
- production migrations `001–006`: nog niet uitgevoerd;
- persistente pre-bootstrap recovery branch: aanwezig.

De compute-instelling `passwordless_access=true` is beoordeeld als Neons account-geauthenticeerde interactieve tooling en niet als applicatie-authenticatiemethode. De production app zal uiteindelijk een aparte credential gebruiken.

## Veiligheidsgrenzen

- De normale echte-Neon regressieworkflow is handmatig (`workflow_dispatch`) en repository-permissions blijven read-only.
- De manual Neon integration workflow raakt geen Netlify production deployment/configuratie.
- Testworkflows mogen geen productioncredentials gebruiken.
- PayPal Live wordt niet door database-integratietests geactiveerd.
- Full PayPal/customerpayloads worden niet in de event-ledger opgeslagen.
- Historische migrations worden niet herschreven om oude Stripe-schemahistorie cosmetisch te verwijderen.
- Production migration, credentialconfiguratie en restorebeleid blijven afzonderlijke operationele gates.
- De persistente pre-bootstrap branch mag niet als algemene ontwikkelbranch worden gebruikt.

## Productiegrens

Een groene production-derived preflight betekent niet dat production automatisch gemigreerd mag worden.

Voor de echte production bootstrap blijven vereist:

- exact reviewed `main` SHA;
- bestaand pre-change recovery checkpoint;
- just-in-time `legendmural_migrator` logincredential;
- directe, niet-gepoolde migrationverbinding;
- `legendmural_runtime` als expliciet grant-doel;
- expliciete toestemming vóór migrations `001–006` op production;
- post-migration verificatie van tabellen, constraints, ownership en privileges;
- aparte least-privilege `legendmural_app` runtimecredential voor Netlify;
- definitief privacy-/retentiebeleid;
- monitoring, incident- en rollbackprocedure;
- PayPal Live als aparte, latere expliciet goedgekeurde fase.

Zie `docs/PRODUCTION_GO_NO_GO_CHECKLIST.md`, `docs/NEON_FREE_PLAN_PRODUCTION_CONTROLS.md` en `docs/PRODUCTION_READINESS_RUNBOOK.md` voor de volledige volgorde.
