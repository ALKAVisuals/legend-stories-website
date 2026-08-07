# Neon integration validation

De echte geïsoleerde Neon Postgres-integratie is uitgevoerd. Dit document beschrijft de blijvende testharness, de veiligheidsgrenzen en de voorwaarden voor een toekomstige regressierun.

## Status

De integratie heeft tegen echte PostgreSQL gevalideerd:

- schema-migraties;
- provider-neutrale order-store conformance;
- concurrent pending-ordergedrag;
- duplicate Stripe-eventgedrag;
- synthetische fixture-cleanup;
- Neon architectuurvalidatie.

Tijdens de eerste echte run zijn twee productiepadproblemen gevonden en daarna in PR #74 opgelost:

- JSONB-velden worden nu expliciet geserialiseerd voordat zij naar de PostgreSQL-driver gaan;
- retryable SERIALIZABLE-conflicten krijgen bounded retries met backoff.

## Pinned runtime dependencies

De integratie gebruikt:

- `@neondatabase/serverless` `1.0.2`;
- `ws` `8.21.1`.

De hoofd-repository-CI draait op Node.js 20. De Netlify-build en Netlify-compatibiliteitscontrole draaien op Node.js 22.

## Vereiste testsecrets voor een herhaalde run

De handmatige integratieworkflow vereist:

- `NEON_TEST_DATABASE_URL`: gepoolde TLS-URL voor de geïsoleerde runtimebranch;
- `NEON_TEST_MIGRATION_URL`: directe TLS-URL voor schema-migraties en fixture-cleanup.

Print of commit deze waarden nooit. De workflow geeft ze uitsluitend via environment variables door.

## Handmatige integratieworkflow

Run **Neon order-store integration** alleen wanneer een echte regressietest tegen de geïsoleerde testomgeving nodig is.

De workflow:

1. weigert te starten wanneer een vereiste secret ontbreekt;
2. installeert de exacte dependency lock;
3. past `server/db/migrations/001_create_order_store.sql` toe via de directe migration-URL;
4. verwijdert alleen synthetische records uit de geïsoleerde testomgeving;
5. draait de complete provider-neutrale conformance-suite tegen de echte Neon-adapter;
6. ruimt synthetische records ook na een testfout op;
7. draait de normale credential-free Neon architectuurvalidatie.

## Veiligheidsgrenzen

- De workflow is `workflow_dispatch` only.
- Zij gebruikt `contents: read`.
- Zij maakt, verwijdert of reset geen Neon-branches.
- Zij mag alleen synthetische testdata gebruiken.
- Zij activeert geen Stripe live-modus.
- Productiecredentials horen nooit in de testenvironment.

## Productiegrens

Een geslaagde integratietest betekent niet dat de database automatisch productieklaar is. Voor productie blijven minimaal vereist:

- een gescheiden productiebranch;
- een dedicated least-privilege runtime-rol;
- vastgesteld backup- en restorebeleid;
- vastgesteld privacy- en retentiebeleid;
- gescheiden Netlify-productievariabelen;
- monitoring en incidentprocedures.

De eerstvolgende operationele stap is niet opnieuw Neon provisionen, maar de bestaande Netlify Function-adapters end-to-end valideren in staging met Stripe-testmodus.
