# Neon integration validation

Laatst inhoudelijk bijgewerkt: 15 augustus 2026.

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
- synthetische fixture-cleanup.

De legal/customer-operationsfase voegt migrations `005` en `006` toe voor een aparte immutable withdrawal-ledger. De testharness is daarom uitgebreid zodat de volledige migrationketen nu `001` t/m `006` omvat.

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

Runtime grants gebruiken een expliciete `__LEGEND_RUNTIME_ROLE__` placeholder die door de migrationrunner veilig als identifier wordt ingevuld. Migration `006` gebruikt dus niet `CURRENT_USER` als impliciete production-default.

De runtime role krijgt voor withdrawal-operaties alleen wat nodig is:

- order lookup via `SELECT` op `legend_commerce.orders`;
- `SELECT` en `INSERT` op `legend_commerce.withdrawal_requests`;
- geen `UPDATE`, `DELETE` of `TRUNCATE` op de withdrawal-ledger.

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

## Aanvullend production-bootstrapbewijs

Op 15 augustus 2026 is de daadwerkelijke Neon `production` branch read-only geïnspecteerd. Daar bestonden nog geen `legend_commerce` tabellen. Productie is dus een lege commerce-baseline en moet later volledig `001 -> 006` worden gebootstrapt.

Daarom is een tijdelijke branch rechtstreeks vanaf die lege production-baseline gemaakt. Op die tijdelijke branch is bewezen dat:

- migrations `001` t/m `006` het volledige schema vanaf nul kunnen opbouwen;
- de resulterende tabellen `orders`, historisch `stripe_events`, `paypal_webhook_events` en `withdrawal_requests` aanwezig zijn;
- een PayPal order ID als `payment_provider=paypal` wordt afgeleid;
- een withdrawal-record correct aan een bestaande order kan worden gekoppeld;
- de test-runtime-role noodzakelijke order/withdrawalrechten krijgt;
- die role geen withdrawal `UPDATE`, `DELETE` of `TRUNCATE` recht krijgt.

De tijdelijke preflightbranch is na de controle verwijderd. De production-branch zelf is niet gemuteerd.

## Huidige production-observaties

Read-only Neon-inspectie op 15 augustus 2026 liet zien:

- project: `Legendmural`;
- primary/default branch: `production`;
- production commerce-schema: nog leeg;
- production branch: momenteel niet protected;
- production compute: passwordless access momenteel enabled;
- project history-retention: momenteel 21.600 seconden (6 uur).

Dit zijn observaties, geen goedkeuring van deze instellingen. Branch protection, access policy, dedicated migration/runtimecredentials en recovery window moeten vóór Live expliciet worden beoordeeld.

## Veiligheidsgrenzen

- De normale echte-Neon regressieworkflow is handmatig (`workflow_dispatch`) en repository-permissions blijven read-only.
- The manual Neon integration workflow does not touch Netlify or production deployment configuration.
- Testworkflows mogen geen productioncredentials gebruiken.
- PayPal Live wordt niet door database-integratietests geactiveerd.
- Full PayPal/customerpayloads worden niet in de event-ledger opgeslagen.
- Historische migrations worden niet herschreven om oude Stripe-schemahistorie cosmetisch te verwijderen.
- Production migration, credentialconfiguratie en restorebeleid zijn afzonderlijke operationele gates.

## Productiegrens

Een groene staging/preflight betekent niet dat production automatisch mag worden geactiveerd. Voor de live databasefase blijven minimaal vereist:

- exact reviewed `main` SHA;
- protected/controlled production branch policy;
- dedicated migration-owner en least-privilege runtime credential;
- vastgesteld recovery/restorebeleid en voldoende restore window;
- definitief privacy-/retentiebeleid;
- gescheiden Netlify production secrets;
- monitoring, incident- en rollbackprocedure;
- expliciete toestemming vóór migrations `001–006` op production;
- PayPal Live als aparte, latere expliciet goedgekeurde fase.

Zie `docs/PRODUCTION_READINESS_RUNBOOK.md` voor de volledige volgorde.