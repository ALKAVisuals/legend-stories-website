# LegendMural first current production deploy checklist

Last reviewed: 18 August 2026.

Purpose: make the first production deployment after Netlify deploy capacity resumes deterministic and low-risk. This checklist **does not authorize PayPal Live or Resend production sending**.

Current prerequisite state before the deploy:

- reviewed `main` SHA: `b47da33573358fc6896233cba3e24f91ba5af900`;
- Neon production branch: `br-misty-cloud-as0rofc8`;
- production schema level: migrations `001–008`;
- production `NEON_DATABASE_URL` has been stored in the Netlify **Production** context using `legendmural_app`;
- Deploy Preview database value remains separate/staging-only;
- production row counts were 0 orders / 0 withdrawals / 0 acknowledgements immediately after the `007–008` migration verification;
- PayPal Live and Resend production activation remain outside this deploy scope.

## A. Before pressing Deploy

Do not change secrets while doing this review. Confirm the **context and non-secret values only**.

1. Target branch is `main` and intended SHA is known.
2. `NEON_DATABASE_URL`:
   - Production has a secret value;
   - Deploy Previews keeps its existing separate value;
   - Production connection uses `legendmural_app`, the pooled production endpoint, database `neondb` and TLS parameters;
   - never replace it with `neondb_owner` or `legendmural_runtime`.
3. Production checkout origin configuration:
   - `CHECKOUT_ALLOWED_ORIGINS` includes the definitive origin `https://legendmural.com`;
   - `CHECKOUT_SUCCESS_URL` targets the definitive LegendMural success page on HTTPS apex;
   - `CHECKOUT_CANCEL_URL` targets the definitive LegendMural cancellation page on HTTPS apex.
4. PayPal infrastructure validation remains Sandbox-only:
   - `PAYPAL_ALLOW_LIVE` is absent or exactly `false`;
   - `PAYPAL_API_BASE` is `https://api-m.sandbox.paypal.com`;
   - `PAYPAL_CLIENT_ID` and `PAYPAL_CLIENT_SECRET` are present only as server-side secrets for the intended Sandbox app;
   - `PAYPAL_WEBHOOK_ID` belongs to the intended Sandbox webhook for this validation phase.
5. Do not add `RESEND_API_KEY` or `RESEND_FROM` as part of this deploy unless Gate 3 is separately approved.
6. Do not set `LEGENDMURAL_CHECKOUT_PAUSED=true` merely for this smoke test unless containment is intentionally being tested. Its absence/`false` is the normal state.

## B. Deploy

1. Trigger one normal Netlify production deployment from the reviewed `main` state.
2. Record the Netlify deploy ID, deploy timestamp and deployed Git SHA.
3. Confirm the build completes successfully and the expected Functions are included:
   - `create-paypal-order`;
   - `capture-paypal-order`;
   - `paypal-webhook`;
   - `order-status`;
   - `create-withdrawal`.
4. If build or Function packaging fails, do not change PayPal/Neon credentials speculatively. Keep checkout closed/unlaunched and inspect the concrete build error first.

## C. Domain / redirect verification

Verify the current deployment, not the historical stale deployment:

- `https://legendmural.com` serves the intended current build;
- `http://legendmural.com/...` redirects to HTTPS apex;
- `http://www.legendmural.com/...` redirects to HTTPS apex;
- `https://www.legendmural.com/...` redirects to HTTPS apex;
- the Netlify subdomain redirects to the apex origin;
- canonical/OG output uses `https://legendmural.com`.

Any redirect loop, certificate error or old build is Gate 1 NO-GO.

## D. No-charge runtime smoke tests

These tests are deliberately chosen to avoid a real payment and avoid creating a PayPal order.

### D1. Read-only Neon connectivity through the public runtime

Send a syntactically valid order-status lookup for a deliberately nonexistent reference/session pair:

```bash
curl -i -X POST 'https://legendmural.com/api/order-status' \
  -H 'Content-Type: application/json' \
  --data '{"reference":"0000000000000000000000000000000000000000000000000000000000000000","sessionId":"SMOKETEST123"}'
```

Expected result:

- HTTP `404`;
- public error code `ORDER_NOT_FOUND`;
- **not** `500`/`503`;
- no database row is created.

Why this is useful: the handler performs a real lookup after validating the request, so the expected `404` proves the deployed Function can use the production `NEON_DATABASE_URL` to read the production order store without creating an order.

### D2. PayPal configuration bootstrap without contacting PayPal

Send an intentionally invalid empty checkout payload:

```bash
curl -i -X POST 'https://legendmural.com/api/paypal/checkout' \
  -H 'Content-Type: application/json' \
  --data '{"request":{},"customer":{}}'
```

Expected result:

- HTTP `400` from local checkout/quote validation;
- **not** `201`;
- **not** a PayPal `502`;
- **not** a configuration `503`.

The PayPal client configuration is constructed before the authoritative quote validation, while the actual PayPal `createOrder` call occurs only after a valid quote/customer payload exists. Therefore this invalid payload can prove the deployed server accepts the configured PayPal credentials/base/origin safety configuration without intentionally creating a PayPal order.

If this returns `201`, stop immediately and reconcile because the smoke payload unexpectedly created a checkout.

### D3. Confirm no side effects

Immediately after D1/D2, verify Neon production counts remain unchanged. Before any real launch order they should still be:

- orders: `0`;
- withdrawals: `0`;
- acknowledgements: `0`.

Also verify no new PayPal Sandbox order was created by D2.

## E. Function-log review

After D1/D2, inspect the logs for the exact deployment/window and confirm:

- no database URI/password is printed;
- no PayPal client secret/token is printed;
- no customer payload is printed;
- no unexpected bootstrap errors occurred;
- D1 correlates with the expected `ORDER_NOT_FOUND` outcome;
- D2 correlates with the expected local validation failure, not a PayPal network call.

If a secret or full customer payload appears in logs, treat as SEV-1 and do not proceed to Live.

## F. Gate 6 completion after deploy

Gate 6 can move to GO only when all of the following are recorded:

- deployed SHA/Netlify deploy ID;
- current apex/HTTPS redirects verified;
- production Neon read-only smoke returns expected `404`;
- invalid checkout smoke returns expected local `400` without PayPal order creation;
- production DB row counts unchanged;
- PayPal remains Sandbox-only / `PAYPAL_ALLOW_LIVE` disabled;
- production Function logs are clean of secrets/PII and unexpected errors.

Only after Gate 6 and the remaining Gate 2/3/7 work are GO may PayPal Live be considered under the separate Gate 8 approval.
