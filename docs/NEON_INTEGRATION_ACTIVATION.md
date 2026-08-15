# Neon integration validation

De echte geïsoleerde Neon Postgres-integratie is eerder uitgevoerd. Dit document beschrijft de blijvende testharness, de veiligheidsgrenzen en de voorwaarden voor een toekomstige regressierun.

## Status

De bestaande integratie heeft tegen echte PostgreSQL gevalideerd:

- schema-migraties;
- provider-neutrale order-store conformance;
- concurrent pending-ordergedrag;
- duplicate Stripe-eventgedrag;
- synthetische fixture-cleanup;
- Neon architectuurvalidatie.

Tijdens de eerste echte run zijn twee productiepadproblemen gevonden en daarna in PR #74 opgelost:

- JSONB-velden worden expliciet geserialiseerd voordat zij naar de PostgreSQL-driver gaan;
- retryable SERIALIZABLE-conflicten krijgen bounded retries met backoff.

De PayPal-architectuur voegt nu een aanvullende schemafundering toe die bij de eerstvolgende geïsoleerde Neon-regressierun expliciet moet worden bewezen:

- `payment_provider` wordt in PostgreSQL automatisch afgeleid uit de opgeslagen payment session/order ID;
- Stripe Checkout session IDs blijven ondersteund voor de tijdelijke legacy fallback;
- PayPal order IDs worden als `paypal` geclassificeerd zonder dat applicatiecode het providerlabel kan overschrijven;
- `legend_commerce.paypal_webhook_events` reserveert alleen minimale eventmetadata voor toekomstige idempotente reconciliation;
- de runtime-rol krijgt op de PayPal event-ledger alleen `SELECT` en `INSERT`.

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
3. past in volgorde de migraties `001` t/m `006` toe via de directe migration-URL, inclusief de withdrawal-ledger en expliciete runtime grants;
4. verwijdert alleen synthetische records uit de geïsoleerde testomgeving;
5. draait de complete provider-neutrale conformance-suite tegen de echte Neon-adapter;
6. bewijst aanvullend dat een PayPal order ID als `payment_provider=paypal` wordt opgeslagen;
7. bewijst dat de runtime-rol een PayPal webhook-event kan reserveren en een withdrawal-record idempotent kan vastleggen, maar deze ledgers niet kan deleten, truncaten of muteren;
8. ruimt synthetische records ook na een testfout op;
9. draait de normale credential-free Neon architectuurvalidatie.

## Veiligheidsgrenzen

- De workflow is `workflow_dispatch` only.
- Zij gebruikt `contents: read`.
- Zij maakt, verwijdert of reset geen Neon-branches.
- Zij mag alleen synthetische testdata gebruiken.
- Deze handmatige Neon-integratieworkflow does not touch Netlify; Netlify staging is een afzonderlijke operationele releasefase.
- Zij activeert geen PayPal Live-modus.
- `PAYPAL_ALLOW_LIVE=true` hoort niet in deze testomgeving.
- Productiecredentials horen nooit in de testenvironment.

## Productiegrens

Een geslaagde integratietest betekent niet dat de database automatisch productieklaar is. Voor productie blijven minimaal vereist:

- een gescheiden productiebranch;
- een dedicated least-privilege runtime-rol;
- vastgesteld backup- en restorebeleid;
- vastgesteld privacy- en retentiebeleid;
- gescheiden Netlify-productievariabelen;
- monitoring en incidentprocedures.

De eerstvolgende operationele stap na deze schemafundering is de PayPal webhook/reconciliationlaag implementeren. Pas daarna volgt PayPal Sandbox + Neon staging end-to-end validatie.
