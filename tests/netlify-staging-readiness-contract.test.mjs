import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const source = await readFile(
  new URL('../scripts/validate-netlify-staging-readiness.mjs', import.meta.url),
  'utf8',
);

test('staging readiness probe only accepts a credential-free HTTPS origin', () => {
  assert.match(source, /LEGENDMURAL_STAGING_BASE_URL/);
  assert.match(source, /baseUrl\.protocol !== 'https:'/);
  assert.match(source, /baseUrl\.username \|\| baseUrl\.password/);
});

test('staging readiness probe uses only non-mutating or intentionally invalid checkout requests', () => {
  assert.match(source, /path: '\/api\/checkout'[\s\S]*method: 'GET'[\s\S]*status: 405/);
  assert.match(source, /body: '\{'[\s\S]*code: 'INVALID_JSON'/);
  assert.match(source, /request: \{ items: \[\], countryCode: 'NL' \}/);
  assert.match(source, /code: 'EMPTY_CART'/);
  assert.doesNotMatch(source, /status:\s*201/);
  assert.doesNotMatch(source, /cs_test_[A-Za-z0-9]/);
  assert.doesNotMatch(source, /firstname|lastname|street|postal|@example\./i);
});

test('staging readiness probe verifies order-status and webhook bootstraps without valid payment events', () => {
  assert.match(source, /path: '\/api\/order-status'[\s\S]*method: 'GET'[\s\S]*status: 405/);
  assert.match(source, /path: '\/api\/stripe-webhook'[\s\S]*method: 'GET'[\s\S]*status: 405/);
  assert.match(source, /Stripe-Signature/);
  assert.match(source, /v1=0000000000000000000000000000000000000000000000000000000000000000/);
  assert.match(source, /body: '\{\}'/);
  assert.match(source, /webhookProbe\.response\.status !== 400/);
  assert.doesNotMatch(source, /checkout\.stripe\.com|\/v1\/checkout\/sessions|INSERT INTO|UPDATE legend_commerce/i);
});
